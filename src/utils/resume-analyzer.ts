import type { ResumeAtsAnalysis, ResumeAtsCategoryScores, ResumePlatformRecommendation } from '../types';
import type { ParsedResumeData } from './groq-service';

export const RECOMMENDED_RESUME_PLATFORMS: ResumePlatformRecommendation[] = [
  {
    name: "Overleaf (Jake's Resume LaTeX Template)",
    url: 'https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs',
    description:
      'The industry gold standard for Software Engineers and Data Scientists. Clean, single-column, mathematically balanced typography with a guaranteed 100% ATS parse rate.',
    bestFor: 'Software Engineering, Data Science, LaTeX precision, FAANG & top tech',
    isRecommended: true,
  },
  {
    name: 'Reactive Resume (rxresu.me)',
    url: 'https://rxresu.me',
    description:
      'A 100% free and open-source, privacy-first web resume builder. Lets you easily manage sections, export to ATS-friendly PDF, and import/export JSON Resume.',
    bestFor: 'Quick visual editing, open-source privacy, no paywalls or watermarks',
  },
  {
    name: 'FlowCV (flowcv.com)',
    url: 'https://flowcv.com',
    description:
      'Modern, highly polished drag-and-drop resume builder with pre-configured ATS-safe margins, clean section hierarchy, and multi-format export.',
    bestFor: 'Design flexibility without breaking ATS readability',
  },
];

const STRONG_ACTION_VERBS = [
  'engineered',
  'architected',
  'implemented',
  'automated',
  'optimized',
  'developed',
  'built',
  'deployed',
  'designed',
  'scaled',
  'spearheaded',
  'orchestrated',
  'constructed',
  'integrated',
  'delivered',
  'refactored',
  'reduced',
  'accelerated',
  'created',
  'executed',
  'resolved',
  'formulated',
  'established',
];

export function analyzeResumeStructureAndIndustryFit(
  rawText: string,
  parsed?: ParsedResumeData
): ResumeAtsAnalysis {
  const text = rawText || '';
  const lowerText = text.toLowerCase();

  // ─── 1. Section Structure Analysis (Max 25 pts) ─────────────
  let sectionScore = 0;
  const missingSections: string[] = [];
  const foundSections: string[] = [];

  // Education
  if (/\b(education|academic|qualifications|degree|bachelor|master|b\.tech|b\.e\.)\b/i.test(text)) {
    sectionScore += 5;
    foundSections.push('Education');
  } else {
    missingSections.push('Education');
  }

  // Skills
  if (/\b(skills|technical skills|technologies|proficiencies|competencies|tech stack)\b/i.test(text)) {
    sectionScore += 5;
    foundSections.push('Technical Skills');
  } else {
    missingSections.push('Technical Skills');
  }

  // Projects
  if (/\b(projects|technical projects|academic projects|key projects|personal projects)\b/i.test(text)) {
    sectionScore += 5;
    foundSections.push('Projects');
  } else {
    missingSections.push('Key Projects');
  }

  // Experience / Internships / Leadership
  if (/\b(experience|work experience|employment|internships?|leadership|positions of responsibility|work history)\b/i.test(text)) {
    sectionScore += 5;
    foundSections.push('Experience / Roles');
  } else {
    // If student has rich projects, it's common to lack formal corporate experience
    sectionScore += 3;
  }

  // Contact header
  if (/\b(email|phone|contact|mobile|github|linkedin)\b/i.test(text)) {
    sectionScore += 3;
    foundSections.push('Contact Information');
  }

  // Honors / Certifications / Activities
  if (/\b(certifications?|honors?|awards?|achievements?|publications?|activities)\b/i.test(text)) {
    sectionScore += 2;
    foundSections.push('Certifications / Honors');
  }

  sectionScore = Math.min(25, sectionScore);

  // ─── 2. Contact & Professional Links (Max 15 pts) ───────────
  let contactScore = 0;
  const contactStrengths: string[] = [];
  const contactImprovements: string[] = [];

  // Email check
  const hasEmail = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/i.test(text) || Boolean(parsed?.personal?.email);
  if (hasEmail) {
    contactScore += 4;
    contactStrengths.push('Valid email detected');
  } else {
    contactImprovements.push('Add a direct contact email address at the top header');
  }

  // Phone check
  const hasPhone =
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/i.test(text) ||
    Boolean(parsed?.personal?.phone);
  if (hasPhone) {
    contactScore += 3;
  } else {
    contactImprovements.push('Add your phone number with country code (e.g. +91)');
  }

  // LinkedIn link
  const hasLinkedIn = /linkedin\.com\/(in\/)?[\w-]+/i.test(text) || Boolean(parsed?.personal?.linkedinUrl);
  if (hasLinkedIn) {
    contactScore += 4;
    contactStrengths.push('LinkedIn profile linked');
  } else {
    contactImprovements.push('Include your LinkedIn profile link to verify your professional background');
  }

  // GitHub / Portfolio
  const hasDevLink =
    /github\.com\/[\w-]+|gitlab\.com|\.dev|\.io|\.app|portfolio/i.test(text) ||
    Boolean(parsed?.personal?.githubUrl || parsed?.personal?.portfolioUrl);
  if (hasDevLink) {
    contactScore += 4;
    contactStrengths.push('GitHub / Dev Portfolio linked');
  } else {
    contactImprovements.push('Include your active GitHub profile or Portfolio URL');
  }

  contactScore = Math.min(15, contactScore);

  // ─── 3. Action Verbs & Quantifiable Metrics (Max 25 pts) ────
  let impactScore = 0;
  const verbMatches = STRONG_ACTION_VERBS.filter((verb) => lowerText.includes(verb));
  const verbCount = verbMatches.length;

  if (verbCount >= 6) {
    impactScore += 12;
  } else if (verbCount >= 3) {
    impactScore += 8;
  } else if (verbCount >= 1) {
    impactScore += 4;
  }

  // Measurable metrics detection:
  // - percentages: e.g. 100%, 40%
  // - latency: e.g. 3.5s, sub-2s, 100ms
  // - quantities: e.g. 22+ PII, 15+ sub-portals, 59-test, 10K+
  // - academic: e.g. SGPA: 9.5, 9.2 CGPA
  const metricPatterns = [
    /\b\d+(\.\d+)?%/g, // 100%, 45%
    /\b\d+(\.\d+)?\s*(s|ms|seconds?|milliseconds?)\b/gi, // 3.5s, 40ms
    /\b\d+\+?\s*(pii|sub-portals|users|clients|tests?|stars|downloads|requests|hours?|queries)\b/gi,
    /\b(sub-\d+s|\d+[\+kKmM])\b/gi, // sub-2s, 10K+
    /\b(sgpa|cgpa|gpa)\s*[:=]?\s*\d+(\.\d+)?\b/gi, // SGPA: 9.5
  ];

  let detectedMetricCount = 0;
  for (const pattern of metricPatterns) {
    const matches = text.match(pattern);
    if (matches) detectedMetricCount += matches.length;
  }

  if (detectedMetricCount >= 5) {
    impactScore += 13;
  } else if (detectedMetricCount >= 2) {
    impactScore += 9;
  } else if (detectedMetricCount >= 1) {
    impactScore += 5;
  }

  impactScore = Math.min(25, impactScore);

  // ─── 4. Technical Skills Categorization (Max 15 pts) ─────────
  let skillsScore = 0;
  const hasSkillCategories =
    /(languages|frameworks|libraries|tools|kernels|databases|storage|platforms|devops|cloud)\s*:/i.test(text);

  if (hasSkillCategories) {
    skillsScore += 8;
  } else {
    skillsScore += 4;
  }

  const extractedSkillCount = parsed?.skills?.length || 0;
  if (extractedSkillCount >= 10 && extractedSkillCount <= 40) {
    skillsScore += 7;
  } else if (extractedSkillCount >= 5) {
    skillsScore += 5;
  } else {
    skillsScore += 2;
  }

  skillsScore = Math.min(15, skillsScore);

  // ─── 5. ATS Layout & Readability (Max 20 pts) ───────────────
  let readabilityScore = 0;
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Standard tech resume length: 300 to 1200 words
  if (wordCount >= 300 && wordCount <= 1200) {
    readabilityScore += 8;
  } else if (wordCount >= 200 && wordCount <= 1500) {
    readabilityScore += 5;
  } else {
    readabilityScore += 2;
  }

  // Check character clean ratio (ensures no corrupted OCR or PDF font glyph errors)
  const printableChars = text.replace(/[\r\n\t]/g, '').length;
  const alphanumericChars = (text.match(/[a-zA-Z0-9.,;:()/-]/g) || []).length;
  const cleanRatio = printableChars > 0 ? alphanumericChars / printableChars : 0;
  if (cleanRatio > 0.8) {
    readabilityScore += 7;
  } else if (cleanRatio > 0.6) {
    readabilityScore += 4;
  }

  // Bullet structure detection
  const hasBulletLists = /[•·\-\*]\s+[A-Z]/m.test(text);
  if (hasBulletLists) {
    readabilityScore += 5;
  } else {
    readabilityScore += 2;
  }

  readabilityScore = Math.min(20, readabilityScore);

  // ─── Compute Total Score ────────────────────────────────────
  const overallScore = Math.min(100, Math.max(0, sectionScore + contactScore + impactScore + skillsScore + readabilityScore));

  // Industry Readiness Evaluation (80% benchmark, tolerant threshold down to 75%)
  const isIndustryReady = overallScore >= 75;

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'C';
  let statusText = '';

  if (overallScore >= 85) {
    grade = 'A+';
    statusText = 'Industry Standard & ATS Optimized (Ready for Top Tech Applications)';
  } else if (overallScore >= 75) {
    grade = 'A';
    statusText = 'Industry Ready (Meets 80%+ Tech Recruitment Standard)';
  } else if (overallScore >= 60) {
    grade = 'B';
    statusText = 'Good Baseline (Scraped & Accepted — Minor Formatting Suggested)';
  } else if (overallScore >= 45) {
    grade = 'C';
    statusText = 'Needs Structural Improvement (Non-Standard Headings or Low Metrics)';
  } else {
    grade = 'D';
    statusText = 'Format Optimization Required (Low Text Density or Corrupted Layout)';
  }

  // Strengths identification
  const strengths: string[] = [];
  if (sectionScore >= 20) {
    strengths.push(`Clear section hierarchy: Identified ${foundSections.join(', ')}.`);
  }
  if (verbCount >= 4) {
    strengths.push(`Strong engineering action verbs: e.g. ${verbMatches.slice(0, 4).join(', ')}.`);
  }
  if (detectedMetricCount >= 3) {
    strengths.push(`Quantifiable engineering metrics and outcomes present (e.g. latencies, percentages, test pass rates).`);
  }
  if (hasSkillCategories) {
    strengths.push('Technical skills are categorized (Languages, Frameworks, Tools, Databases) for high ATS parseability.');
  }
  strengths.push(...contactStrengths);

  // Actionable improvements
  const improvements: string[] = [];
  if (missingSections.length > 0) {
    improvements.push(`Consider adding standard headings for: ${missingSections.join(', ')}.`);
  }
  if (detectedMetricCount < 3) {
    improvements.push('Incorporate the Google X-Y-Z formula: "Accomplished [X], measured by [Y], by doing [Z]" to include more quantifiable numbers.');
  }
  if (!hasSkillCategories) {
    improvements.push('Group your skills into labeled categories (e.g., Languages: Python; Frameworks: React; Tools: Git) so recruiters and ATS bots can index them instantly.');
  }
  improvements.push(...contactImprovements);

  const categoryScores: ResumeAtsCategoryScores = {
    sectionStructure: Math.round((sectionScore / 25) * 100),
    contactAndLinks: Math.round((contactScore / 15) * 100),
    impactAndMetrics: Math.round((impactScore / 25) * 100),
    skillsCategorization: Math.round((skillsScore / 15) * 100),
    atsReadability: Math.round((readabilityScore / 20) * 100),
  };

  const conversionTips = [
    'Use a single-column layout. Two-column or graphic table layouts often cause ATS software to read across columns and jumble your text.',
    'Stick to standard web-safe or LaTeX fonts (Computer Modern, Inter, Roboto, Arial, Calibri) sized between 10pt and 12pt.',
    'Use standard bullet points (•) starting each line with an active verb (Engineered, Architected, Automated) followed by specific tech stack and numbers.',
    'Ensure links (GitHub, LinkedIn, Portfolio) have clickable hyperlinks and visible clean handles (e.g. github.com/username).',
  ];

  return {
    overallScore,
    isIndustryReady,
    grade,
    statusText,
    categoryScores,
    strengths,
    improvements,
    recommendedPlatforms: RECOMMENDED_RESUME_PLATFORMS,
    conversionTips,
  };
}
