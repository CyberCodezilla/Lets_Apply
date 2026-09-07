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

function extractScreeningQuestions(scope: HTMLElement | Document): ScreeningQuestion[] {
  const questions: ScreeningQuestion[] = [];
  const seenIds = new Set<string>();

  // Helper to check if element is part of search/filter UI
  const isExcluded = (el: Element) => {
    return isInsideFilterOrNav(el) ||
      Boolean(el.closest('#filters_container, .filters_container, #filter_form, [class*="filter"]'));
  };

  // 1. Cover Letter textarea
  const coverLetterEl =
    scope.querySelector('#cover_letter_holder textarea, #cover_letter, textarea[name="cover_letter"], textarea[placeholder*="Why should you be hired"]') ||
    document.querySelector('#cover_letter_holder textarea, #cover_letter, textarea[name="cover_letter"]');
  
  if (coverLetterEl && !isExcluded(coverLetterEl)) {
    questions.push({
      id: 'cover_letter',
      questionText: 'Cover Letter / Why should you be hired for this role?',
      inputType: 'textarea',
    });
    seenIds.add('cover_letter');
    if (coverLetterEl.id) seenIds.add(coverLetterEl.id);
  }

  // 2. Custom employer assessment questions
  // Internshala places custom assessment questions in containers with classes like .assessment_question, .additional_question
  const questionContainers = Array.from(
    document.querySelectorAll(
      '.assessment_question, .additional_question, #assessment_questions .form-group, .application_question, .custom_question_container'
    )
  );

  questionContainers.forEach((container, index) => {
    if (isExcluded(container)) return;

    const labelEl =
      container.querySelector('.assessment_label') ||
      container.querySelector('.question_text') ||
      container.querySelector('label');
    
    const label = labelEl?.textContent?.trim();
    if (!label || label.toLowerCase().includes('cover letter')) return;

    // Must NOT be a search filter label (Profile, Location, Stipend, Duration)
    const lowerLabel = label.toLowerCase();
    if (
      lowerLabel === 'profile' ||
      lowerLabel === 'location' ||
      lowerLabel.includes('stipend') ||
      lowerLabel.includes('duration')
    ) {
      return;
    }

    const textarea = container.querySelector('textarea');
    const textInput = container.querySelector('input[type="text"]');

    if (!textarea && !textInput) return;

    const elementId = textarea?.id || textInput?.id || `question_${index}`;
    if (!seenIds.has(elementId)) {
      seenIds.add(elementId);
      questions.push({
        id: elementId,
        questionText: label,
        inputType: textarea ? 'textarea' : 'text',
      });
    }
  });

  // 3. Fallback: only check textareas specifically within the application modal or form
  const appContainers = Array.from(
    document.querySelectorAll(
      '#application_form, .application_modal, #apply_modal, .modal-content:has(button[type="submit"]), .modal-content:has(#cover_letter_holder)'
    )
  );

  for (const appContainer of appContainers) {
    const textareas = Array.from(appContainer.querySelectorAll('textarea'));
    textareas.forEach((ta, idx) => {
      if (isExcluded(ta)) return;
      const id = ta.id || ta.name || `app_ta_${idx}`;
      if (seenIds.has(id) || seenIds.has(ta.id) || id.toLowerCase().includes('cover')) return;

      const label =
        ta.closest('.form-group')?.querySelector('label, p, .item_heading')?.textContent?.trim() ||
        ta.previousElementSibling?.textContent?.trim() ||
        ta.placeholder ||
        `Screening Question ${questions.length + 1}`;

      seenIds.add(id);
      questions.push({
        id: ta.id || id,
        questionText: label,
        inputType: 'textarea',
      });
    });
  }

  return questions;
}

// ─── Form Auto-Fill ─────────────────────────────────────────
async function fillForm(payload: FillFormPayload): Promise<FillResultPayload> {
  const scope = getActiveScope();
  let filledCount = 0;

  for (const [fieldId, answerText] of Object.entries(payload.answers)) {
    let element: HTMLElement | null = null;

    if (fieldId === 'cover_letter') {
      element =
        scope.querySelector('#cover_letter_holder textarea') ||
        scope.querySelector('#cover_letter') ||
        scope.querySelector('textarea[name="cover_letter"]') ||
        document.querySelector('#cover_letter_holder textarea') ||
        document.querySelector('#cover_letter') ||
        document.querySelector('textarea[name="cover_letter"]');
    } else {
      element =
        scope.querySelector(`#${fieldId}`) ||
        scope.querySelector(`textarea[name="${fieldId}"]`) ||
        scope.querySelector(`input[name="${fieldId}"]`) ||
        document.getElementById(fieldId) ||
        document.querySelector(`textarea[name="${fieldId}"]`) ||
        document.querySelector(`input[name="${fieldId}"]`);
    }

    // Fallback: if fieldId is an index or generic id, try matching by position
    if (!element && fieldId.startsWith('textarea_')) {
      const idx = parseInt(fieldId.replace('textarea_', ''), 10);
      const allTas = scope.querySelectorAll('textarea');
      if (allTas[idx]) element = allTas[idx];
    }

    if (element && (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
      // Set value via native setter to bypass framework getter/setter traps
      const nativeInputValueSetter =
        element instanceof HTMLTextAreaElement
          ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
          : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, answerText);
      } else {
        element.value = answerText;
      }

      // Dispatch synthetic events for React/jQuery/Angular detection
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));

      // Visual feedback: green highlight animation
      element.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
      element.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.4)';
      element.style.borderColor = '#22c55e';
      setTimeout(() => {
        element!.style.boxShadow = '';
        element!.style.borderColor = '';
      }, 2000);

      filledCount++;
    }
  }

  // Scroll to the application form area
  const formArea =
    scope.querySelector('#application_form') ||
    scope.querySelector('.apply_form_container') ||
    scope.querySelector('#cover_letter_holder') ||
    scope.querySelector('textarea');
  if (formArea) {
    formArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
