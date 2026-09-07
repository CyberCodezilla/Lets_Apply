// ─── User Profile ───────────────────────────────────────────
export interface UserProfile {
  personal: {
    fullName: string;
    email: string;
    phone: string;
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    location: string;
  };
  education: {
    degree: string;
    institution: string;
    graduationYear: number;
    cgpaOrPercentage?: string;
  };
  skills: string[];
  projects: ProjectEntry[];
  experience: ExperienceEntry[];
  preferences: {
    targetRoles: string[];
    minStipend: number;
    workMode: 'Remote' | 'In-Office' | 'Hybrid' | 'Any';
  };
  config: {
    groqApiKey: string;
    selectedModel: string;
  };
}

export interface ProjectEntry {
  title: string;
  techStack: string[];
  description: string;
  metricsOrImpact?: string;
  repoUrl?: string;
  liveUrl?: string;
}

export interface ExperienceEntry {
  role: string;
  company: string;
  duration: string;
  contributions: string;
}

// ─── Job Context ────────────────────────────────────────────
export interface ScreeningQuestion {
  id: string;
  questionText: string;
  inputType: 'textarea' | 'radio' | 'text';
  options?: string[];
}

export interface JobContext {
  jobId: string;
  title: string;
  company: string;
  location: string;
  stipend: string;
  duration: string;
  postedDate?: string;
  description: string;
  requirements: string[];
  screeningQuestions: ScreeningQuestion[];
  scrapedAt: number;
}

// ─── Application History ────────────────────────────────────
export interface ApplicationRecord {
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  generatedAnswers: Record<string, string>;
  appliedAt: string;
  status: 'APPLIED' | 'DRAFTED' | 'SKIPPED';
}

// ─── Groq API Types ────────────────────────────────────────
export interface MatchResult {
  score: number;
  rationale: string[];
}

export interface GeneratedAnswers {
  answers: Record<string, string>;
}

// ─── Message Types (Chrome Runtime) ────────────────────────
export type MessageType =
  | 'SCRAPE_PAGE'
  | 'SCRAPE_RESULT'
  | 'FILL_FORM'
  | 'FILL_RESULT'
  | 'OPEN_OPTIONS';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ScrapeResultPayload {
  success: boolean;
  data?: JobContext;
  error?: string;
}

export interface FillFormPayload {
  answers: Record<string, string>;
  coverLetter?: string;
}

export interface FillResultPayload {
  success: boolean;
  filledCount: number;
  error?: string;
}

// ─── Default Profile ────────────────────────────────────────
export const DEFAULT_PROFILE: UserProfile = {
  personal: {
    fullName: '',
    email: '',
    phone: '',
    portfolioUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    location: '',
  },
  education: {
    degree: '',
    institution: '',
    graduationYear: new Date().getFullYear(),
    cgpaOrPercentage: '',
  },
  skills: [],
  projects: [],
  experience: [],
  preferences: {
    targetRoles: [],
    minStipend: 0,
    workMode: 'Any',
  },
  config: {
    groqApiKey: (import.meta.env.WXT_GROQ_API_KEY as string) || '',
    selectedModel: (import.meta.env.WXT_GROQ_MODEL as string) || 'openai/gpt-oss-120b',
  },
};
