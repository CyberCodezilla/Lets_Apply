import type { UserProfile, JobContext, MatchResult, ScreeningQuestion } from '../types';

const GROQ_BASE_URL = (import.meta.env?.WXT_GROQ_BASE_URL as string) || 'https://api.groq.com/openai/v1';
const GROQ_API_URL = `${GROQ_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
const DEFAULT_MAX_TOKENS = Number(import.meta.env?.WXT_AI_MAX_TOKENS) || 2048;
const MAX_WORDS = Number(import.meta.env?.WXT_MAX_ANSWER_WORDS) || 120;
const DEFAULT_TEMPERATURE = Number(import.meta.env?.WXT_AI_TEMPERATURE) || 0.3;

function buildSystemPrompt(profile: UserProfile): string {
  const safeProfile = {
    personal: {
      fullName: profile.personal.fullName,
      location: profile.personal.location,
      portfolioUrl: profile.personal.portfolioUrl,
      githubUrl: profile.personal.githubUrl,
      linkedinUrl: profile.personal.linkedinUrl,
    },
    education: profile.education,
    skills: profile.skills,
    projects: profile.projects.map((p) => ({
      title: p.title,
      techStack: p.techStack,
      description: p.description,
      metricsOrImpact: p.metricsOrImpact || 'N/A',
      repoUrl: p.repoUrl,
      liveUrl: p.liveUrl,
    })),
    experience: profile.experience.map((e) => ({
      role: e.role,
      company: e.company,
      duration: e.duration,
      contributions: e.contributions,
    })),
    preferences: profile.preferences,
  };

  return `You are Let's Apply, an elite career agent assisting an internship candidate on Internshala.
Your mission is to generate high-conversion, professional, and completely hallucination-free application answers based STRICTLY on the candidate's verified profile.

CORE GROUND RULES:
1. STRICT GROUNDING: Use ONLY the candidate's verified skills, projects, metrics, education, and experience below. NEVER invent, assume, or extrapolate technologies, company names, tools, or metrics not explicitly listed.
2. TAILORED RELEVANCE: When answering, connect the candidate's most relevant verified project and metrics directly to the job requirements.
3. CONCISENESS: Keep answers punchy, natural, and under ${MAX_WORDS} words per question. Avoid fluff or generic openings like "I am a passionate student". Lead directly with project achievements and technical outcomes.
4. HONESTY: If a specific niche skill is missing from the profile, highlight the closest verified skill they have mastered and their demonstrated rapid learning ability.
5. URLS & LINKS: If a question asks for a GitHub link, portfolio, LinkedIn, or personal website, output the candidate's exact URL from their profile.
6. AVAILABILITY & LOGISTICS: If asked about joining immediately, duration, or work mode, provide a clear, professional affirmative response aligning with their profile and graduation timeline.

CANDIDATE VERIFIED PROFILE:
${JSON.stringify(safeProfile, null, 2)}`;
}

function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  // 1. Direct parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {}

  // 2. Strip markdown code fence blocks (```json ... ```)
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {}
  }

  // 3. Balanced brace finder
  const firstBrace = trimmed.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    for (let i = firstBrace; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++;
      else if (trimmed[i] === '}') {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.substring(firstBrace, i + 1);
          try {
            return JSON.parse(candidate) as T;
          } catch {}
        }
      }
    }
  }

  // 4. Regex fallback
  const regexMatch = trimmed.match(/\{[\s\S]*\}/);
  if (regexMatch) {
    return JSON.parse(regexMatch[0]) as T;
  }

  throw new Error('Could not parse JSON from model output');
}

const DEPRECATED_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
]);

export function resolveGroqModel(model?: string): string {
  const envDefault = (import.meta.env?.WXT_GROQ_MODEL as string) || 'openai/gpt-oss-120b';
  if (!model || DEPRECATED_MODELS.has(model) || model.includes('llama')) {
    return envDefault;
  }
  return model;
}

async function callGroq(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = DEFAULT_TEMPERATURE,
  jsonMode: boolean = false
): Promise<string> {
  const activeModel = resolveGroqModel(model);
  const body: Record<string, unknown> = {
    model: activeModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: DEFAULT_MAX_TOKENS,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Match Scoring Cache ─────────────────────────────────────
const matchScoreCache = new Map<string, { result: MatchResult; timestamp: number }>();

// ─── Match Scoring ──────────────────────────────────────────
export async function computeMatchScore(
  profile: UserProfile,
  jobContext: JobContext
): Promise<MatchResult> {
  // Fast cache check: avoids duplicate LLM network latency if analyzing the same job posting
  const cacheKey = `${jobContext.title}::${jobContext.company}::${jobContext.requirements.join(',')}::${profile.skills.join(',')}::${profile.projects.map((p) => p.title).join(',')}::${profile.experience.length}`;
  const cached = matchScoreCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.result;
  }

  const systemPrompt = buildSystemPrompt(profile);

  const userPrompt = `You are a strict, deterministic hiring compatibility evaluator. 
Calculate an objective compatibility score (0-100) using EXACTLY this scoring rubric:
1. Technical & Required Skills Match (0-50 pts): Pro-rated strictly by the proportion of required job skills explicitly present in candidate's skills and projects. If 0 required skills match, award 0 pts.
2. Direct Domain & Project Experience (0-30 pts): Award points only if candidate has built projects or held roles in this exact functional domain (e.g., marketing projects for marketing roles, software for software roles). Unrelated technical experience earns at most 5 pts.
3. Field of Study / Role Match (0-10 pts): 10 pts if candidate's degree/target roles directly match the job function, otherwise 0 pts.
4. Preferences & Logistics (0-10 pts): 5 pts if work mode matches, 5 pts if stipend >= candidate's minimum.
Total score = sum of all 4 criteria (0 to 100).

Return a JSON object with EXACTLY this format (no markdown, no extra text):
{"score": <integer 0-100>, "rationale": ["<concise bullet point 1>", "<concise bullet point 2>"]}

JOB DETAILS:
Title: ${jobContext.title}
Company: ${jobContext.company}
Location: ${jobContext.location}
Duration: ${jobContext.duration}
Stipend: ${jobContext.stipend}

Required Skills:
${jobContext.requirements.join(', ') || 'None specified'}

Description:
${jobContext.description.slice(0, 2000)}

Candidate's target roles: ${profile.preferences.targetRoles.join(', ') || 'Any'}
Candidate's preferred work mode: ${profile.preferences.workMode}
Candidate's minimum stipend: ₹${profile.preferences.minStipend}/month`;

  const raw = await callGroq(
    profile.config.groqApiKey,
    profile.config.selectedModel,
    systemPrompt,
    userPrompt,
    0.0, // Deterministic greedy decoding
    true // jsonMode: enforce strict JSON object format from Groq
  );

  try {
    const parsed = extractJson<{ score: number | string; rationale?: string[] }>(raw);
    const result: MatchResult = {
      score: Math.min(100, Math.max(0, Math.round(Number(parsed.score)) || 0)),
      rationale: Array.isArray(parsed.rationale) ? parsed.rationale.slice(0, 2) : [],
    };
    matchScoreCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  } catch {
    const scoreMatch = raw.match(/"score"\s*:\s*(\d+)/i);
    if (scoreMatch && scoreMatch[1]) {
      const result: MatchResult = {
        score: Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))),
        rationale: ['Compatibility score computed based on profile and requirements.'],
      };
      matchScoreCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
    console.error('Failed to parse match score:', raw);
    return { score: 0, rationale: ['Unable to compute match score'] };
  }
}

// ─── Screening Question Answers ─────────────────────────────
export async function generateAnswers(
  profile: UserProfile,
  jobContext: JobContext,
  questions: ScreeningQuestion[]
): Promise<Record<string, string>> {
  if (questions.length === 0) return {};

  const systemPrompt = buildSystemPrompt(profile);

  const questionsBlock = questions
    .map((q, i) => {
      const typeStr = q.inputType || 'textarea';
      const optionsStr = q.options && q.options.length > 0 ? `\nAvailable options: ${JSON.stringify(q.options)}` : '';
      return `Q${i + 1} (id: "${q.id}", type: "${typeStr}"):\nQuestion: "${q.questionText}"${optionsStr}`;
    })
    .join('\n\n');

  const userPrompt = `Answer these screening questions for the internship application at ${jobContext.company} (${jobContext.title}).

JOB CONTEXT:
Title: ${jobContext.title}
Company: ${jobContext.company}
Location: ${jobContext.location || 'Not specified'}
Duration: ${jobContext.duration || 'Not specified'}
Stipend: ${jobContext.stipend || 'Not specified'}
Required Skills: ${jobContext.requirements.join(', ') || 'None specified'}

Job Description Summary:
${jobContext.description.slice(0, 2500)}

SPECIAL INSTRUCTIONS PER QUESTION TYPE:
- COVER LETTER / "Why should you be hired": Write a high-converting, tailored response (100–140 words) that leads with the candidate's top 1-2 verified projects matching the job's required skills, citing exact metrics and outcomes, and showing clear interest in ${jobContext.company}.
- RADIO / SELECT / MULTIPLE CHOICE: Your answer MUST be an EXACT MATCH to one of the provided "Available options". Do NOT add extra words or explanation.
- REPOSITORY / PORTFOLIO / URL QUESTIONS: Provide the exact URL directly from the candidate's profile.
- AVAILABILITY QUESTIONS: State clearly that the candidate is available for ${jobContext.duration || 'the internship'} and work mode.
- OTHER QUESTIONS: Answer directly, metric-backed when possible, and strictly under ${MAX_WORDS} words.

QUESTIONS TO ANSWER:
${questionsBlock}

Return a JSON object mapping question IDs to the drafted answer string (no extra markdown):
{"<question_id>": "<answer>", ...}`;

  const raw = await callGroq(
    profile.config.groqApiKey,
    profile.config.selectedModel,
    systemPrompt,
    userPrompt,
    0.3,
    true // jsonMode
  );

  try {
    const parsed = extractJson<Record<string, unknown>>(raw);
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = String(value);
    }
    return result;
  } catch {
    console.error('Failed to parse answers:', raw);
    const result: Record<string, string> = {};
    for (const q of questions) {
      result[q.id] = '[Error generating answer — please try again]';
    }
    return result;
  }
}

// ─── Regenerate Single Answer ───────────────────────────────
export async function regenerateAnswer(
  profile: UserProfile,
  jobContext: JobContext,
  question: ScreeningQuestion
): Promise<string> {
  const systemPrompt = buildSystemPrompt(profile);
  const typeStr = question.inputType || 'textarea';
  const optionsStr =
    question.options && question.options.length > 0
      ? `\nAvailable options: ${JSON.stringify(question.options)}`
      : '';

  const userPrompt = `Answer this single screening question for the internship application at ${jobContext.company} (${jobContext.title}).

JOB CONTEXT:
Title: ${jobContext.title}
Company: ${jobContext.company}
Location: ${jobContext.location || 'Not specified'}
Duration: ${jobContext.duration || 'Not specified'}
Stipend: ${jobContext.stipend || 'Not specified'}
Required Skills: ${jobContext.requirements.join(', ') || 'None specified'}

Job Description Summary:
${jobContext.description.slice(0, 2000)}

QUESTION [id: "${question.id}", type: "${typeStr}"]:
"${question.questionText}"${optionsStr}

SPECIAL RULES:
- If this is a radio or select question, return ONLY the exact chosen option string from the available options list.
- If this is a cover letter / "Why should you be hired" question, highlight the candidate's top matching verified projects with metrics, under 140 words.
- If asking for a link/URL, return the exact URL from candidate profile.
- Return ONLY the drafted answer text, no JSON, no quotes, no markdown fences.`;

  const raw = await callGroq(
    profile.config.groqApiKey,
    profile.config.selectedModel,
    systemPrompt,
    userPrompt,
    0.5
  );

  return raw.trim();
}

// ─── Test API Connection ────────────────────────────────────
export async function testApiConnection(
  apiKey: string,
  model: string
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const activeModel = resolveGroqModel(model);
  const start = Date.now();
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        message: `API Error (${response.status}): ${errorBody.slice(0, 200)}`,
      };
    }

    return {
      success: true,
      message: `Connected successfully (${latencyMs}ms latency)`,
      latencyMs,
    };
  } catch (err) {
    return {
      success: false,
      message: `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

// ─── AI Resume Parsing ──────────────────────────────────────
export interface ParsedResumeData {
  personal?: {
    fullName?: string;
    email?: string;
    phone?: string;
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    location?: string;
  };
  education?: {
    degree?: string;
    institution?: string;
    graduationYear?: number;
    cgpaOrPercentage?: string;
  };
  skills?: string[];
  projects?: Array<{
    title: string;
    techStack: string[];
    description: string;
    metricsOrImpact?: string;
    repoUrl?: string;
    liveUrl?: string;
  }>;
  experience?: Array<{
    role: string;
    company: string;
    duration: string;
    contributions: string;
  }>;
  preferences?: {
    targetRoles?: string[];
  };
}

/**
 * Defensively cleans, type-checks, and normalizes AI-parsed resume data.
 * Guarantees that skills, techStack, and targetRoles are strictly string[],
 * links have https:// prefixes, numbers are valid, and no fields cause runtime crashes.
 */
export function normalizeParsedResumeData(raw: unknown): ParsedResumeData {
  if (!raw || typeof raw !== 'object') {
    return {
      skills: [],
      projects: [],
      experience: [],
      preferences: { targetRoles: [] },
    };
  }

  const data = raw as Record<string, unknown>;

  // Helper to safely parse string arrays from either arrays or delimited strings
  const toStringArray = (val: unknown): string[] => {
    if (Array.isArray(val)) {
      return val
        .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
        .filter(Boolean);
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      return val
        .split(/[,;\n•|]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  // Helper to ensure valid URL with protocol
  const formatUrl = (url: unknown): string | undefined => {
    if (typeof url !== 'string') return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('github.com') || trimmed.startsWith('linkedin.com') || trimmed.includes('.')) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  // 1. Personal info
  const rawPersonal = (data.personal && typeof data.personal === 'object' ? data.personal : {}) as Record<string, unknown>;
  const personal = {
    fullName: typeof rawPersonal.fullName === 'string' ? rawPersonal.fullName.trim() : '',
    email: typeof rawPersonal.email === 'string' ? rawPersonal.email.trim() : '',
    phone: typeof rawPersonal.phone === 'string' ? rawPersonal.phone.trim() : '',
    location: typeof rawPersonal.location === 'string' ? rawPersonal.location.trim() : '',
    portfolioUrl: formatUrl(rawPersonal.portfolioUrl),
    githubUrl: formatUrl(rawPersonal.githubUrl),
    linkedinUrl: formatUrl(rawPersonal.linkedinUrl),
  };

  // 2. Education
  const rawEducation = (data.education && typeof data.education === 'object' ? data.education : {}) as Record<string, unknown>;
  let gradYear = 0;
  if (typeof rawEducation.graduationYear === 'number') {
    gradYear = Math.round(rawEducation.graduationYear);
  } else if (typeof rawEducation.graduationYear === 'string') {
    const yearMatch = rawEducation.graduationYear.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch && yearMatch[1]) gradYear = parseInt(yearMatch[1], 10);
  }

  const education = {
    degree: typeof rawEducation.degree === 'string' ? rawEducation.degree.trim() : '',
    institution: typeof rawEducation.institution === 'string' ? rawEducation.institution.trim() : '',
    graduationYear: gradYear > 1950 && gradYear < 2100 ? gradYear : new Date().getFullYear(),
    cgpaOrPercentage: typeof rawEducation.cgpaOrPercentage === 'string' ? rawEducation.cgpaOrPercentage.trim() : '',
  };

  // 3. Skills (atomic, deduplicated)
  const rawSkills = toStringArray(data.skills);
  const uniqueSkills: string[] = [];
  const seenSkill = new Set<string>();
  for (const s of rawSkills) {
    const lower = s.toLowerCase();
    if (!seenSkill.has(lower)) {
      seenSkill.add(lower);
      uniqueSkills.push(s);
    }
  }

  // 4. Projects
  const rawProjects = Array.isArray(data.projects) ? data.projects : [];
  const projects: Array<{
    title: string;
    techStack: string[];
    description: string;
    metricsOrImpact?: string;
    repoUrl?: string;
    liveUrl?: string;
  }> = [];

  for (const p of rawProjects) {
    if (!p || typeof p !== 'object') continue;
    const proj = p as Record<string, unknown>;
    const title = typeof proj.title === 'string' ? proj.title.trim() : '';
    if (!title) continue;

    projects.push({
      title,
      techStack: toStringArray(proj.techStack),
      description: typeof proj.description === 'string' ? proj.description.trim() : '',
      metricsOrImpact: typeof proj.metricsOrImpact === 'string' ? proj.metricsOrImpact.trim() : '',
      repoUrl: formatUrl(proj.repoUrl),
      liveUrl: formatUrl(proj.liveUrl),
    });
  }

  // 5. Experience
  const rawExp = Array.isArray(data.experience) ? data.experience : [];
  const experience: Array<{
    role: string;
    company: string;
    duration: string;
    contributions: string;
  }> = [];

  for (const e of rawExp) {
    if (!e || typeof e !== 'object') continue;
    const exp = e as Record<string, unknown>;
    const role = typeof exp.role === 'string' ? exp.role.trim() : '';
    const company = typeof exp.company === 'string' ? exp.company.trim() : '';
    if (!role && !company) continue;

    experience.push({
      role,
      company,
      duration: typeof exp.duration === 'string' ? exp.duration.trim() : '',
      contributions: typeof exp.contributions === 'string' ? exp.contributions.trim() : '',
    });
  }

  // 6. Preferences
  const rawPref = (data.preferences && typeof data.preferences === 'object' ? data.preferences : {}) as Record<string, unknown>;
  const targetRoles = toStringArray(rawPref.targetRoles);

  return {
    personal,
    education,
    skills: uniqueSkills,
    projects,
    experience,
    preferences: {
      targetRoles,
    },
  };
}

export async function parseResumeWithAI(
  resumeText: string,
  apiKey: string,
  model?: string
): Promise<ParsedResumeData> {
  const activeModel = resolveGroqModel(model);
  const systemPrompt = `You are an expert AI resume parser. Your job is to extract comprehensive, high-fidelity candidate profile information from raw resume text into structured JSON.
Return ONLY a valid JSON object strictly matching this schema:
{
  "personal": {
    "fullName": "Full Name",
    "email": "email@example.com",
    "phone": "+91...",
    "location": "City, Country",
    "portfolioUrl": "https://...",
    "githubUrl": "https://github.com/...",
    "linkedinUrl": "https://linkedin.com/in/..."
  },
  "education": {
    "degree": "B.Tech in Computer Science",
    "institution": "University / College Name",
    "graduationYear": 2025,
    "cgpaOrPercentage": "8.5 CGPA or 85%"
  },
  "skills": ["React", "TypeScript", "Node.js", "Python"],
  "projects": [
    {
      "title": "Project Name",
      "techStack": ["React", "Python", "Tailwind CSS"],
      "description": "Clear description of the problem solved, architecture, and features.",
      "metricsOrImpact": "Reduced latency by 40%, 10K+ monthly active users, or measurable metric.",
      "repoUrl": "https://github.com/...",
      "liveUrl": "https://..."
    }
  ],
  "experience": [
    {
      "role": "Software Engineering Intern",
      "company": "Company Name",
      "duration": "Jun 2024 - Aug 2024",
      "contributions": "Key achievements, systems built, and measurable impact."
    }
  ],
  "preferences": {
    "targetRoles": ["Frontend Developer", "Full Stack Developer"]
  }
}

EXTRACTION RULES:
1. SKILLS: Extract individual, atomic technical and domain skills into clean strings in the "skills" array. Un-nest categories (e.g. if the resume says "Languages: C++, Python; Tools: Git, Docker", produce ["C++", "Python", "Git", "Docker"]).
2. PROJECTS: Extract each project's title, tech stack used as an array of strings, detailed description, and any quantifiable metrics (users, speedup, accuracy, stars, cost reduction) into "metricsOrImpact".
3. EXPERIENCE: Extract full role title, company name, start & end dates (or duration), and bulleted contributions with metrics into "contributions".
4. EDUCATION: Extract degree name, college/university, 4-digit graduation year (number), and CGPA or percentage if present.
5. LINKS: If GitHub, LinkedIn, or portfolio usernames/URLs are present, extract them into full URLs with https://.
6. TARGET ROLES: Infer 2-4 appropriate internship/job roles the candidate is best suited for based on their skills and projects (e.g. ["Full Stack Developer", "Backend Engineer"]).
7. ZERO HALLUCINATION: Do NOT fabricate details, metrics, or experiences not in the resume. Leave empty or omit if not found. Output strictly valid JSON.`;

  const userPrompt = `Extract structured profile information from this resume text:\n\n${resumeText.slice(0, 28000)}`;

  const raw = await callGroq(apiKey, activeModel, systemPrompt, userPrompt, 0.1, true);
  const parsed = extractJson<unknown>(raw);
  return normalizeParsedResumeData(parsed);
}

