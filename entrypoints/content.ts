import type { JobContext, ScreeningQuestion, FillFormPayload, ScrapeResultPayload, FillResultPayload } from '@/src/types';

export default defineContentScript({
  matches: ['*://*.internshala.com/*'],
  runAt: 'document_idle',

  main() {
    // Listen for messages from side panel / background
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SCRAPE_PAGE') {
        scrapeJobPage()
          .then((data) => {
            const payload: ScrapeResultPayload = { success: true, data };
            sendResponse(payload);
          })
          .catch((err) => {
            const payload: ScrapeResultPayload = {
              success: false,
              error: err instanceof Error ? err.message : 'Unknown scraping error',
            };
            sendResponse(payload);
          });
        return true; // keep message channel open for async response
      }

      if (message.type === 'FILL_FORM') {
        const fillPayload = message.payload as FillFormPayload;
        fillForm(fillPayload)
          .then((result) => sendResponse(result))
          .catch((err) => {
            const payload: FillResultPayload = {
              success: false,
              filledCount: 0,
              error: err instanceof Error ? err.message : 'Unknown fill error',
            };
            sendResponse(payload);
          });
        return true;
      }
    });
  },
});

// ─── DOM Scraping ───────────────────────────────────────────
function getActiveScope(): HTMLElement | Document {
  // 1. Check for visible application modal dialogs
  const modalSelectors = [
    '.modal.show .modal-content',
    '.modal.in .modal-content',
    '.modal-content',
    '#application_modal',
    '#apply_modal',
    '#easy_apply_modal',
    '.application_modal',
    '[role="dialog"]',
    '.modal.show',
  ];

  for (const sel of modalSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) {
      const style = window.getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden' && el.clientHeight > 50) {
        return el;
      }
    }
  }

  // 2. Detail page container fallback (ignore search filters)
  const detailContainer = document.querySelector<HTMLElement>(
    '.internship_details_container, .individual_internship_details, #internship_details, .detail_view'
  );
  if (detailContainer) return detailContainer;

  return document;
}

function isInsideFilterOrNav(el: Element): boolean {
  return Boolean(
    el.closest('#filters_container, #filter_form, .filter_form, .filters, .filter_section, aside, nav, .navbar, header, footer, #header, #footer')
  );
}

async function scrapeJobPage(): Promise<JobContext> {
  const scope = getActiveScope();

  // Extract Title
  let title = '';
  // Check modal heading first (e.g., "Applying to Student Marketing internship")
  const headingEls = Array.from(scope.querySelectorAll('h1, h2, h3, h4, .modal-title, [class*="heading"]'));
  for (const h of headingEls) {
    if (isInsideFilterOrNav(h)) continue;
    const text = (h.textContent || '').trim();
    const match = text.match(/Applying to\s+(.*?)\s+internship/i);
    if (match && match[1]) {
      title = match[1].trim();
      break;
    }
  }

  if (!title) {
    // Look inside active scope first, avoiding filter sidebar
    const titleSelectors = [
      '.job-internship-name',
      '.heading_4_5 a',
      '.heading_4_5',
      '.profile_name',
      'h1'
    ];
    for (const sel of titleSelectors) {
      const els = Array.from(scope.querySelectorAll(sel));
      for (const el of els) {
        if (!isInsideFilterOrNav(el) && el.textContent?.trim()) {
          title = el.textContent.trim();
          break;
        }
      }
      if (title) break;
    }
  }

  // Fallback if scope was an apply modal that only says "Apply now"
  if (!title || title.toLowerCase() === 'apply now') {
    const detailTitle = document.querySelector('.internship_details_container h1, .individual_internship_details .heading_4_5 a, .heading_4_5 a');
    if (detailTitle && !isInsideFilterOrNav(detailTitle)) {
      title = detailTitle.textContent?.trim() || '';
    }
  }
  if (!title || title.toLowerCase() === 'apply now') title = 'Internship Role';

  // Extract Company
  let company = '';
  const companySelectors = [
    '.company-name',
    '.company_name a',
    '.company_name',
    '.link_display_like_text'
  ];
  for (const sel of companySelectors) {
    const els = Array.from(scope.querySelectorAll(sel));
    for (const el of els) {
      if (isInsideFilterOrNav(el)) continue;
      const txt = el.textContent?.trim();
      if (txt && !txt.toLowerCase().includes('actively hiring') && !txt.toLowerCase().includes('internshala')) {
        company = txt;
        break;
      }
    }
    if (company) break;
  }
  if (!company) {
    const pageCompany = document.querySelector('.individual_internship_details .company_name, .company-name');
    if (pageCompany && !isInsideFilterOrNav(pageCompany)) {
      company = pageCompany.textContent?.trim() || '';
    }
  }
  if (!company) company = 'Hiring Company';

  // Extract Location, Duration, Stipend
  let location = '';
  let duration = '';
  let stipend = '';

  const metaItems = scope.querySelectorAll(
    '.internship_details .detail_outer, .other_detail_item_row .item_body, .internship_other_details_container .other_detail_item, [class*="detail_item"]'
  );

  metaItems.forEach((item) => {
    if (isInsideFilterOrNav(item)) return;
    const label =
      item.querySelector('.ic-location, .location_link, [class*="location"]')?.textContent?.trim() ||
      item.querySelector('.item_heading')?.textContent?.trim()?.toLowerCase() || '';
    const value = item.querySelector('.item_body')?.textContent?.trim() ||
      item.textContent?.trim() || '';

    if (label.includes('location') || item.querySelector('.ic-location, .location_link')) {
      location = location || value;
    } else if (label.includes('duration') || item.querySelector('[class*="duration"]')) {
      duration = duration || value;
    } else if (label.includes('stipend') || label.includes('salary') || item.querySelector('[class*="stipend"]')) {
      stipend = stipend || value;
    }
  });

  const scopeText = scope.textContent || '';
  if (!stipend) {
    const stipendMatch = scopeText.match(/(?:₹|INR)\s*[\d,]+(?:\s*-\s*[\d,]+)?\s*(?:\/\s*month|\/month)?/i);
    if (stipendMatch && !stipendMatch[0].includes('999')) stipend = stipendMatch[0].trim();
  }
  if (!location && /work from home/i.test(scopeText)) {
    location = 'Work from home';
  }
  if (!duration) {
    const durMatch = scopeText.match(/\b\d+\s*(?:Month|Months|Week|Weeks)\b/i);
    if (durMatch) duration = durMatch[0].trim();
  }

  // Extract Description
  const descriptionEl =
    scope.querySelector('.internship_details_container .text-container') ||
    scope.querySelector('.internship_details_container') ||
    scope.querySelector('.individual_internship_details .text-container') ||
    scope.querySelector('.detail_view .text-container') ||
    scope.querySelector('[class*="about_internship"]') ||
    document.querySelector('.internship_details_container .text-container');
  
  let description = descriptionEl?.textContent?.trim() || '';
  if (!description && scopeText.length > 80 && scope !== document) {
    const pElements = Array.from(scope.querySelectorAll('p, li, .item_body'));
    description = pElements
      .filter((p) => !isInsideFilterOrNav(p))
      .map((p) => p.textContent?.trim() || '')
      .filter(Boolean)
      .join('\n');
  }

  // Extract Requirements & Skills
  const requirements: string[] = [];
  const skillEls = scope.querySelectorAll(
    '.round_tabs, .skill_tag, .required_skills_container .round_tabs_container .round_tabs'
  );
  skillEls.forEach((el) => {
    if (isInsideFilterOrNav(el)) return;
    const text = el.textContent?.trim();
    if (text && text.length < 50 && !requirements.includes(text)) {
      requirements.push(text);
    }
  });

  const skillsInlineMatch = scopeText.match(/Skills:\s*([^\n\r.]+)/i);
  if (skillsInlineMatch && skillsInlineMatch[1]) {
    const inlineSkills = skillsInlineMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    inlineSkills.forEach((s) => {
      if (!requirements.includes(s)) requirements.push(s);
    });
  }

  // Screening questions (ONLY real application questions, NEVER search filters!)
  const screeningQuestions = extractScreeningQuestions(scope);

  const jobId = `${cleanText(title).replace(/\s+/g, '_')}_${Date.now()}`;

  return {
    jobId,
    title: cleanText(title),
    company: cleanText(company),
    location: cleanText(location),
    stipend: cleanText(stipend),
    duration: cleanText(duration),
    description: cleanText(description),
    requirements,
    screeningQuestions,
    scrapedAt: Date.now(),
  };
}

// ─── Cover Letter Helper ────────────────────────────────────
function findCoverLetterTextarea(scope: HTMLElement | Document): HTMLTextAreaElement | null {
  const selectors = [
    'textarea#cover_letter',
    '#cover_letter textarea',
    '#cover_letter_holder textarea',
    '.cover_letter_holder textarea',
    '#cover_letter_container textarea',
    '.cover_letter_container textarea',
    'textarea[name="cover_letter"]',
    'textarea[name*="cover"]',
    'textarea[id*="cover"]',
    'textarea[placeholder*="Mention in detail"]',
    'textarea[placeholder*="relevant skill"]',
    'textarea[placeholder*="Why should you be hired"]',
    'textarea[placeholder*="cover letter"]',
    'textarea[placeholder*="experience"]',
    '.cover_letter textarea',
    '.cover-letter textarea',
    '#application_form textarea',
    '.application_modal textarea',
    '.modal-body textarea',
    '.modal-content textarea',
  ];

  // Try in scope first
  for (const sel of selectors) {
    const el = scope.querySelector<HTMLTextAreaElement>(sel);
    if (el && el instanceof HTMLTextAreaElement && !isInsideFilterOrNav(el)) {
      return el;
    }
  }

  // Try document-wide
  for (const sel of selectors) {
    const el = document.querySelector<HTMLTextAreaElement>(sel);
    if (el && el instanceof HTMLTextAreaElement && !isInsideFilterOrNav(el)) {
      return el;
    }
  }

  // Fallback: look in container with "cover letter" or "why should you be hired" in its text
  const headings = Array.from(document.querySelectorAll('label, h1, h2, h3, h4, h5, h6, .heading_6, p, div'));
  for (const h of headings) {
    if (isInsideFilterOrNav(h)) continue;
    const txt = (h.textContent || '').toLowerCase();
    if (txt.includes('why should you be hired') || txt.includes('cover letter')) {
      const container = h.closest('.form-group, .custom_question_container, .modal-body, div');
      const ta = container?.querySelector<HTMLTextAreaElement>('textarea');
      if (ta && ta instanceof HTMLTextAreaElement && !isInsideFilterOrNav(ta)) {
        return ta;
      }
    }
  }

  // Fallback: first visible textarea in modal
  const allTextareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('.modal textarea, [role="dialog"] textarea, #application_modal textarea, textarea'));
  for (const ta of allTextareas) {
    if (!isInsideFilterOrNav(ta) && ta.clientHeight > 20) {
      return ta;
    }
  }

  return null;
}

function extractScreeningQuestions(scope: HTMLElement | Document): ScreeningQuestion[] {
  const questions: ScreeningQuestion[] = [];
  const seenIds = new Set<string>();

  const isExcluded = (el: Element) => {
    return isInsideFilterOrNav(el) ||
      Boolean(el.closest('#filters_container, .filters_container, #filter_form, [class*="filter"]'));
  };

  // 1. Cover Letter textarea
  const coverLetterEl = findCoverLetterTextarea(scope);
  if (coverLetterEl && !isExcluded(coverLetterEl)) {
    coverLetterEl.setAttribute('data-lets-apply-id', 'cover_letter');
    questions.push({
      id: 'cover_letter',
      questionText: 'Cover Letter / Why should you be hired for this role?',
      inputType: 'textarea',
    });
    seenIds.add('cover_letter');
    if (coverLetterEl.id) seenIds.add(coverLetterEl.id);
    if (coverLetterEl.name) seenIds.add(coverLetterEl.name);
  }

  // 2. Custom employer assessment questions and availability containers
  const questionContainers = Array.from(
    document.querySelectorAll(
      '.assessment_question, .additional_question, #assessment_questions .form-group, .application_question, .custom_question_container, #availability_holder, .availability_container, .form-group:has(input[type="radio"]), .form-group:has(select)'
    )
  );

  questionContainers.forEach((container, index) => {
    if (isExcluded(container)) return;

    // Skip if container already holds the cover letter textarea
    if (coverLetterEl && container.contains(coverLetterEl)) return;

    const labelEl =
      container.querySelector('.assessment_label') ||
      container.querySelector('.question_text') ||
      container.querySelector('.item_heading') ||
      container.querySelector('label');
    
    const label = labelEl?.textContent?.trim();
    if (!label) return;

    // Must NOT be a search filter label
    const lowerLabel = label.toLowerCase();
    if (
      lowerLabel === 'profile' ||
      lowerLabel === 'location' ||
      lowerLabel.includes('desired minimum') ||
      lowerLabel.includes('max. duration')
    ) {
      return;
    }

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    const select = container.querySelector<HTMLSelectElement>('select');
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const textInput = container.querySelector<HTMLInputElement>('input[type="text"]');

    // Case A: Radio buttons group
    if (radios.length > 0 && radios[0]) {
      const radioName = radios[0].name || `radio_q_${index}`;
      const elementId = `radio_${radioName}`;
      if (!seenIds.has(elementId)) {
        seenIds.add(elementId);
        const options: string[] = [];

        radios.forEach((r) => {
          const optText =
            r.parentElement?.textContent?.trim() ||
            container.querySelector(`label[for="${r.id}"]`)?.textContent?.trim() ||
            r.value;
          if (optText && !options.includes(optText)) {
            options.push(optText);
          }
          r.setAttribute('data-lets-apply-id', elementId);
          r.setAttribute('data-lets-apply-option', optText);
        });

        questions.push({
          id: elementId,
          questionText: label,
          inputType: 'radio',
          options,
        });
      }
      return;
    }

    // Case B: Select dropdown
    if (select) {
      const elementId = select.id || select.name || `select_q_${index}`;
      if (!seenIds.has(elementId)) {
        seenIds.add(elementId);
        select.setAttribute('data-lets-apply-id', elementId);
        const options = Array.from(select.options)
          .map((o) => o.text.trim())
          .filter((t) => Boolean(t) && !t.toLowerCase().includes('select'));

        questions.push({
          id: elementId,
          questionText: label,
          inputType: 'select',
          options,
        });
      }
      return;
    }

    // Case C: Textarea or Text Input
    const targetEl = textarea || textInput;
    if (targetEl) {
      const elementId = targetEl.id || targetEl.name || `text_q_${index}`;
      if (!seenIds.has(elementId)) {
        seenIds.add(elementId);
        targetEl.setAttribute('data-lets-apply-id', elementId);
        questions.push({
          id: elementId,
          questionText: label,
          inputType: textarea ? 'textarea' : 'text',
        });
      }
    }
  });

  // 3. Fallback: textareas inside application modal
  const appContainers = Array.from(
    document.querySelectorAll(
      '#application_form, .application_modal, #apply_modal, .modal-content:has(button[type="submit"]), .modal-content:has(#cover_letter_holder)'
    )
  );

  for (const appContainer of appContainers) {
    const textareas = Array.from(appContainer.querySelectorAll('textarea'));
    textareas.forEach((ta, idx) => {
      if (isExcluded(ta)) return;
      if (coverLetterEl && ta === coverLetterEl) return;

      const id = ta.id || ta.name || `app_ta_${idx}`;
      if (seenIds.has(id) || seenIds.has(ta.id)) return;

      const label =
        ta.closest('.form-group')?.querySelector('label, p, .item_heading')?.textContent?.trim() ||
        ta.previousElementSibling?.textContent?.trim() ||
        ta.placeholder ||
        `Screening Question ${questions.length + 1}`;

      seenIds.add(id);
      ta.setAttribute('data-lets-apply-id', id);
      questions.push({
        id,
        questionText: label,
        inputType: 'textarea',
      });
    });
  }

  return questions;
}

// ─── Form Auto-Fill ─────────────────────────────────────────
function setNativeValue(element: HTMLElement, value: string): boolean {
  // Unpack container if a wrapper div was passed
  let target: HTMLTextAreaElement | HTMLInputElement;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    target = element;
  } else {
    const inner = element.querySelector<HTMLTextAreaElement | HTMLInputElement>('textarea, input[type="text"]');
    if (inner) {
      target = inner;
    } else {
      console.warn('[Lets Apply] Cannot set value: element is not a text input or textarea', element);
      return false;
    }
  }

  const isTextArea = target instanceof HTMLTextAreaElement;
  const prototype = isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  target.focus();
  if ('select' in target) {
    try {
      (target as HTMLInputElement | HTMLTextAreaElement).select();
    } catch {}
  }

  // 1. Attempt document.execCommand('insertText') - native browser simulation
  let execSuccess = false;
  try {
    target.selectionStart = 0;
    target.selectionEnd = target.value.length;
    execSuccess = document.execCommand('insertText', false, value);
  } catch {}

  // 2. Set value directly via native prototype setter and reset React's valueTracker
  if (!execSuccess || target.value !== value) {
    const tracker = (target as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
    if (tracker) {
      tracker.setValue('');
    }

    if (descriptor?.set) {
      descriptor.set.call(target, value);
    } else {
      target.value = value;
    }
  }

  // 3. Dispatch full event cascade (focus -> keydown -> keypress -> input -> keyup -> change -> blur)
  target.dispatchEvent(new Event('focus', { bubbles: true }));
  target.dispatchEvent(new Event('keydown', { bubbles: true }));
  target.dispatchEvent(new Event('keypress', { bubbles: true }));

  try {
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  } catch {
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  target.dispatchEvent(new Event('keyup', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
  target.dispatchEvent(new Event('blur', { bubbles: true }));

  // 4. Visual feedback: bright green outline and glowing box-shadow
  target.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease, outline 0.3s ease';
  target.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.4)';
  target.style.borderColor = '#22c55e';
  target.style.outline = '2px solid #22c55e';
  setTimeout(() => {
    target.style.boxShadow = '';
    target.style.borderColor = '';
    target.style.outline = '';
  }, 2500);

  return true;
}

async function fillForm(payload: FillFormPayload): Promise<FillResultPayload> {
  const scope = getActiveScope();
  let filledCount = 0;

  console.log('[Lets Apply] fillForm started. Answers:', payload.answers);

  for (const [fieldId, rawAnswer] of Object.entries(payload.answers)) {
    const answerText = (rawAnswer || '').trim();
    if (!answerText) continue;

    // 1. Cover letter
    if (fieldId === 'cover_letter' || fieldId.toLowerCase().includes('cover')) {
      const clEl = findCoverLetterTextarea(scope);
      if (clEl) {
        if (setNativeValue(clEl, answerText)) {
          filledCount++;
          continue;
        }
      }
    }

    // 2. Radio button questions
    const radios = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][data-lets-apply-id="${fieldId}"], input[type="radio"][name="${fieldId.replace('radio_', '')}"]`
      )
    );

    if (radios.length > 0) {
      const normalized = answerText.toLowerCase();
      let matchedRadio: HTMLInputElement | null = null;

      for (const r of radios) {
        const optAttr = (r.getAttribute('data-lets-apply-option') || '').toLowerCase();
        const parentText = (r.parentElement?.textContent || '').toLowerCase();
        const rVal = (r.value || '').toLowerCase();

        if (
          (optAttr && (optAttr.includes(normalized) || normalized.includes(optAttr))) ||
          (parentText && (parentText.includes(normalized) || normalized.includes(parentText))) ||
          (rVal && (rVal.includes(normalized) || normalized.includes(rVal)))
        ) {
          matchedRadio = r;
          break;
        }

        // Fuzzy match for common Yes/No
        if (normalized.startsWith('yes') && (parentText.includes('yes') || optAttr.includes('yes') || rVal === 'yes')) {
          matchedRadio = r;
          break;
        }
        if (normalized.startsWith('no') && (parentText.includes('no') || optAttr.includes('no') || rVal === 'no')) {
          matchedRadio = r;
          break;
        }
      }

      if (!matchedRadio && radios.length > 0) {
        matchedRadio = radios[0] || null;
      }

      if (matchedRadio) {
        matchedRadio.checked = true;
        matchedRadio.click();
        matchedRadio.dispatchEvent(new Event('change', { bubbles: true }));
        matchedRadio.dispatchEvent(new Event('input', { bubbles: true }));

        const parent = matchedRadio.closest('label, .radio, div') || matchedRadio;
        (parent as HTMLElement).style.transition = 'outline 0.3s ease';
        (parent as HTMLElement).style.outline = '2px solid #22c55e';
        setTimeout(() => {
          (parent as HTMLElement).style.outline = '';
        }, 2500);

        filledCount++;
        continue;
      }
    }

    // 3. Select dropdowns
    const selectEl = document.querySelector<HTMLSelectElement>(
      `select[data-lets-apply-id="${fieldId}"], select#${fieldId}, select[name="${fieldId}"]`
    );
    if (selectEl) {
      const normalized = answerText.toLowerCase();
      for (const opt of Array.from(selectEl.options)) {
        if (
          opt.text.toLowerCase().includes(normalized) ||
          normalized.includes(opt.text.toLowerCase()) ||
          opt.value.toLowerCase() === normalized
        ) {
          selectEl.value = opt.value;
          break;
        }
      }
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      filledCount++;
      continue;
    }

    // 4. Stamped Textarea or Text input
    let textEl =
      scope.querySelector<HTMLElement>(`[data-lets-apply-id="${fieldId}"], #${fieldId}, textarea[name="${fieldId}"], input[name="${fieldId}"]`) ||
      document.querySelector<HTMLElement>(`[data-lets-apply-id="${fieldId}"], #${fieldId}, textarea[name="${fieldId}"], input[name="${fieldId}"]`);

    // Fallback: match by index
    if (!textEl) {
      const idxMatch = fieldId.match(/_(\d+)$/);
      if (idxMatch && idxMatch[1]) {
        const idx = parseInt(idxMatch[1], 10);
        const allTextareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('#application_form textarea, .application_modal textarea, .modal textarea'));
        if (allTextareas[idx]) textEl = allTextareas[idx] || null;
      }
    }

    if (textEl) {
      if (setNativeValue(textEl, answerText)) {
        filledCount++;
        continue;
      }
    }
  }

  // 5. Ultimate Fallback: If cover letter is still empty, and payload has a cover_letter answer (or first answer), fill the cover letter textarea!
  const coverEl = findCoverLetterTextarea(scope);
  if (coverEl && coverEl.value.trim() === '') {
    const coverAnswer = payload.answers['cover_letter'] || Object.values(payload.answers)[0];
    if (coverAnswer && coverAnswer.trim()) {
      if (setNativeValue(coverEl, coverAnswer.trim())) {
        filledCount++;
      }
    }
  }

  // Scroll to first filled element or form area
  const firstFilled = document.querySelector<HTMLElement>('[data-lets-apply-id], #application_form, #cover_letter_holder, textarea');
  if (firstFilled) {
    firstFilled.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return {
    success: filledCount > 0,
    filledCount,
  };
}

// ─── Helpers ────────────────────────────────────────────────
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
