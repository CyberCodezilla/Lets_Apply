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
  // 1. Check for visible modal / popup dialogs first
  const modalCandidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.modal.show, .modal.in, [role="dialog"], .application_modal, #apply_modal, #easy_apply_modal, .modal-dialog, .modal-content, [class*="modal"][class*="open"], [class*="modal"][class*="active"], [class*="popup"]'
    )
  );

  for (const el of modalCandidates) {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 200 &&
      rect.height > 150
    ) {
      return el;
    }
  }

  // 2. Check for any container with "Applying to ... internship" heading
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, div'));
  for (const h of headings) {
    if (/Applying to\s+.*?\s+internship/i.test(h.textContent || '')) {
      const container = h.closest<HTMLElement>('.modal, [role="dialog"], div[class*="modal"], div[class*="popup"], div[style*="z-index"]');
      if (container) return container;
    }
  }

  // 3. Detail page container fallback
  const detailContainer = document.querySelector<HTMLElement>(
    '.internship_details_container, .individual_internship_details, #internship_details'
  );
  if (detailContainer) return detailContainer;

  return document;
}

async function scrapeJobPage(): Promise<JobContext> {
  const scope = getActiveScope();

  // Extract Title
  let title = '';
  // Check modal heading first (e.g., "Applying to Student Marketing internship")
  const headingEls = Array.from(scope.querySelectorAll('h1, h2, h3, h4, .modal-title, [class*="heading"]'));
  for (const h of headingEls) {
    const match = (h.textContent || '').trim().match(/Applying to\s+(.*?)\s+internship/i);
    if (match && match[1]) {
      title = match[1].trim();
      break;
    }
  }
  if (!title) {
    const titleSelectors = [
      '.job-internship-name',
      '.profile_name',
      '.heading_4_5 a',
      '.heading_4_5',
      '.profile',
      'h1',
      'h2'
    ];
    for (const sel of titleSelectors) {
      const el = scope.querySelector(sel);
      if (el?.textContent?.trim()) {
        title = el.textContent.trim();
        break;
      }
    }
  }
  if (!title) title = 'Unknown Position';

  // Extract Company
  let company = '';
  const companySelectors = [
    '.company-name',
    '.company_name a',
    '.company_name',
    '.link_display_like_text',
    '[class*="company"]'
  ];
  for (const sel of companySelectors) {
    const el = scope.querySelector(sel);
    const txt = el?.textContent?.trim();
    if (txt && !txt.toLowerCase().includes('actively hiring') && !txt.toLowerCase().includes('internshala')) {
      company = txt;
      break;
    }
  }
  if (!company) company = 'Unknown Company';

  // Extract Location, Duration, Stipend
  let location = '';
  let duration = '';
  let stipend = '';

  const metaItems = scope.querySelectorAll(
    '.internship_details .detail_outer, .other_detail_item_row .item_body, .internship_other_details_container .other_detail_item, [class*="detail_item"]'
  );

  metaItems.forEach((item) => {
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

  // Regex-based fallbacks from scope text
  const scopeText = scope.textContent || '';
  if (!stipend) {
    const stipendMatch = scopeText.match(/(?:₹|INR)\s*[\d,]+(?:\s*-\s*[\d,]+)?\s*(?:\/\s*month|\/month)?/i);
    if (stipendMatch) stipend = stipendMatch[0].trim();
  }
  if (!location) {
    if (/work from home/i.test(scopeText)) {
      location = 'Work from home';
    } else {
      const locMatch = scope.querySelector('.location_link, #location_names a, [class*="location"]');
      if (locMatch?.textContent?.trim()) location = locMatch.textContent.trim();
    }
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
    scope.querySelector('[class*="role_overview"]');
  
  let description = descriptionEl?.textContent?.trim() || '';
  if (!description && scopeText.length > 50) {
    // Collect paragraphs or bullet points inside scope
    const pElements = Array.from(scope.querySelectorAll('p, li, .item_body'));
    description = pElements.map((p) => p.textContent?.trim() || '').filter(Boolean).join('\n');
  }

  // Extract Requirements & Skills
  const requirements: string[] = [];
  const skillEls = scope.querySelectorAll(
    '.round_tabs, .skill_tag, .required_skills_container .round_tabs_container .round_tabs, [class*="skill"]'
  );
  skillEls.forEach((el) => {
    const text = el.textContent?.trim();
    if (text && text.length < 50 && !requirements.includes(text)) {
      requirements.push(text);
    }
  });

  // Check for inline Skills requirement text (e.g., "Skills: Leadership, Teamwork, ...")
  const skillsInlineMatch = scopeText.match(/Skills:\s*([^\n\r.]+)/i);
  if (skillsInlineMatch && skillsInlineMatch[1]) {
    const inlineSkills = skillsInlineMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    inlineSkills.forEach((s) => {
      if (!requirements.includes(s)) requirements.push(s);
    });
  }

  // Screening questions (search inside scope and entire document)
  const screeningQuestions = extractScreeningQuestions(scope);

  // Generate job ID
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

  // 1. Cover Letter
  const coverLetterEl =
    scope.querySelector('#cover_letter_holder textarea, #cover_letter, textarea[name="cover_letter"], textarea[placeholder*="Why should you be hired"]') ||
    document.querySelector('#cover_letter_holder textarea, #cover_letter, textarea[name="cover_letter"]');
  if (coverLetterEl) {
    questions.push({
      id: 'cover_letter',
      questionText: 'Cover Letter / Why should you be hired for this role?',
      inputType: 'textarea',
    });
    seenIds.add('cover_letter');
    if (coverLetterEl.id) seenIds.add(coverLetterEl.id);
  }

  // 2. Custom question containers
  const questionContainers = Array.from(
    (scope === document ? document : scope).querySelectorAll(
      '.assessment_question, .form-group:has(textarea), .application_question, .custom_question_container, [class*="question_container"], .form-group'
    )
  );

  questionContainers.forEach((container, index) => {
    const labelEl =
      container.querySelector('label') ||
      container.querySelector('.assessment_label') ||
      container.querySelector('.question_text') ||
      container.querySelector('p, h4');
    const label = labelEl?.textContent?.trim();
    if (!label || label.toLowerCase().includes('cover letter')) return;

    const textarea = container.querySelector('textarea');
    const textInput = container.querySelector('input[type="text"]');
    const radioInputs = container.querySelectorAll('input[type="radio"]');

    if (!textarea && !textInput && radioInputs.length === 0) return;

    let inputType: ScreeningQuestion['inputType'] = 'textarea';
    const options: string[] = [];

    if (radioInputs.length > 0) {
      inputType = 'radio';
      radioInputs.forEach((radio) => {
        const radioLabel = container.querySelector(`label[for="${radio.id}"]`)?.textContent?.trim();
        if (radioLabel) options.push(radioLabel);
      });
    } else if (textInput && !textarea) {
      inputType = 'text';
    }

    const elementId = textarea?.id || textInput?.id || `question_${index}`;
    if (!seenIds.has(elementId)) {
      seenIds.add(elementId);
      questions.push({
        id: elementId,
        questionText: label,
        inputType,
        ...(options.length > 0 ? { options } : {}),
      });
    }
  });

  // 3. Fallback: catch any standalone textareas inside the scope that might have been missed
  const allTextareas = Array.from(scope.querySelectorAll('textarea'));
  allTextareas.forEach((ta, idx) => {
    const id = ta.id || ta.name || `textarea_${idx}`;
    if (seenIds.has(id) || seenIds.has(ta.id)) return;
    if (id.toLowerCase().includes('cover')) return;

    // Find nearest question label or preceding element text
    const label =
      ta.closest('label')?.textContent?.trim() ||
      ta.previousElementSibling?.textContent?.trim() ||
      ta.parentElement?.querySelector('label, p, .item_heading')?.textContent?.trim() ||
      ta.placeholder ||
      `Question ${questions.length + 1}`;

    seenIds.add(id);
    questions.push({
      id: ta.id || id,
      questionText: label,
      inputType: 'textarea',
    });
  });

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
