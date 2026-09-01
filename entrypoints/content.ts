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
async function scrapeJobPage(): Promise<JobContext> {
  // Title
  const title =
    getTextContent('.job-internship-name') ||
    getTextContent('.heading_4_5 a') ||
    getTextContent('h1') ||
    'Unknown Position';

  // Company
  const company =
    getTextContent('.company-name') ||
    getTextContent('.link_display_like_text') ||
    getTextContent('.company_name a') ||
    'Unknown Company';

  // Location, Duration, Stipend from metadata
  const metaItems = document.querySelectorAll(
    '.internship_details .detail_outer, .other_detail_item_row .item_body, .internship_other_details_container .other_detail_item'
  );

  let location = '';
  let duration = '';
  let stipend = '';

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

  // Fallback: try different selectors for metadata
  if (!location) location = getTextContent('.location_link') || getTextContent('#location_names a') || '';
  if (!duration) duration = getTextContent('.other_detail_item_row:nth-child(2) .item_body') || '';
  if (!stipend) stipend = getTextContent('.stipend_container_post498, .stipend') || getTextContent('.other_detail_item_row:nth-child(3) .item_body') || '';

  // Description
  const descriptionEl =
    document.querySelector('.internship_details_container .text-container') ||
    document.querySelector('.internship_details_container') ||
    document.querySelector('.individual_internship_details .text-container') ||
    document.querySelector('.detail_view .text-container');
  const description = descriptionEl?.textContent?.trim() || '';

  // Requirements (extract from "Who can apply" or "Skill(s) required" sections)
  const requirements: string[] = [];
  const skillEls = document.querySelectorAll('.round_tabs, .skill_tag, .required_skills_container .round_tabs_container .round_tabs');
  skillEls.forEach((el) => {
    const text = el.textContent?.trim();
    if (text) requirements.push(text);
  });

  // Screening questions
  const screeningQuestions = extractScreeningQuestions();

  // Generate job ID from URL or title
  const jobId = window.location.pathname.replace(/\//g, '_') || `job_${Date.now()}`;

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

function extractScreeningQuestions(): ScreeningQuestion[] {
  const questions: ScreeningQuestion[] = [];

  // Cover letter
  const coverLetterEl = document.querySelector('#cover_letter_holder, #cover_letter, textarea[name="cover_letter"]');
  if (coverLetterEl) {
    questions.push({
      id: 'cover_letter',
      questionText: 'Cover Letter / Why should you be hired for this role?',
      inputType: 'textarea',
    });
  }

  // Custom assessment questions (Internshala uses .assessment_question or similar)
  const questionContainers = document.querySelectorAll(
    '.assessment_question, .form-group:has(textarea), .application_question, .custom_question_container'
  );

  questionContainers.forEach((container, index) => {
    const labelEl =
      container.querySelector('label') ||
      container.querySelector('.assessment_label') ||
      container.querySelector('.question_text');
    const label = labelEl?.textContent?.trim();
    if (!label || label.toLowerCase().includes('cover letter')) return;

    const textarea = container.querySelector('textarea');
    const textInput = container.querySelector('input[type="text"]');
    const radioInputs = container.querySelectorAll('input[type="radio"]');

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

    questions.push({
      id: elementId,
      questionText: label,
      inputType,
      ...(options.length > 0 ? { options } : {}),
    });
  });

  return questions;
}

// ─── Form Auto-Fill ─────────────────────────────────────────
async function fillForm(payload: FillFormPayload): Promise<FillResultPayload> {
  let filledCount = 0;

  for (const [fieldId, answerText] of Object.entries(payload.answers)) {
    let element: HTMLElement | null = null;

    if (fieldId === 'cover_letter') {
      // Try multiple selectors for cover letter
      element =
        document.querySelector('#cover_letter_holder textarea') ||
        document.querySelector('#cover_letter') ||
        document.querySelector('textarea[name="cover_letter"]');
    } else {
      element =
        document.getElementById(fieldId) ||
        document.querySelector(`textarea[name="${fieldId}"]`) ||
        document.querySelector(`input[name="${fieldId}"]`);
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
    document.querySelector('#application_form') ||
    document.querySelector('.apply_form_container') ||
    document.querySelector('#cover_letter_holder');
  if (formArea) {
    formArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return {
    success: filledCount > 0,
    filledCount,
  };
}

// ─── Helpers ────────────────────────────────────────────────
function getTextContent(selector: string): string {
  return document.querySelector(selector)?.textContent?.trim() || '';
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
