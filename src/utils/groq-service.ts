import type { UserProfile, JobContext, MatchResult, ScreeningQuestion } from '../types';

const GROQ_BASE_URL = (import.meta.env.WXT_GROQ_BASE_URL as string) || 'https://api.groq.com/openai/v1';
const GROQ_API_URL = `${GROQ_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
const DEFAULT_MAX_TOKENS = Number(import.meta.env.WXT_AI_MAX_TOKENS) || 2048;
const MAX_WORDS = Number(import.meta.env.WXT_MAX_ANSWER_WORDS) || 120;
const DEFAULT_TEMPERATURE = Number(import.meta.env.WXT_AI_TEMPERATURE) || 0.3;

function buildSystemPrompt(profile: UserProfile): string {
  // Omit API key from the profile data sent in prompts
  const safeProfile = {
    personal: profile.personal,
    education: profile.education,
    skills: profile.skills,
    projects: profile.projects,
    experience: profile.experience,
    preferences: profile.preferences,
  };

  return `You are Let's Apply, a high-precision career assistant. Your job is to answer internship application questions for the candidate based STRICTLY on their verified profile.

GROUND RULES:
1. Use ONLY the skills, projects, metrics, and experiences provided in the Candidate Profile.
2. NEVER fabricate, exaggerate, or assume any experience, company, tool, or metric not explicitly listed.
3. If the candidate profile does not possess a requested skill, answer honestly by highlighting the closest related verified skill and eagerness to learn.
4. Keep all responses concise, punchy, and under ${MAX_WORDS} words per question.
5. Avoid generic boilerplate (e.g., "I am a hard-working student"). Lead with direct project names and technical outcomes.

CANDIDATE PROFILE:
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
  const envDefault = (import.meta.env.WXT_GROQ_MODEL as string) || 'openai/gpt-oss-120b';
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
  const cacheKey = `${jobContext.title}::${jobContext.company}::${jobContext.requirements.join(',')}::${profile.skills.join(',')}`;
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

Description:
${jobContext.description}

Requirements:
${jobContext.requirements.join(', ') || 'None specified'}

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
    .map((q, i) => `Q${i + 1} (id: "${q.id}"): ${q.questionText}`)
    .join('\n');

  const userPrompt = `Answer these screening questions for the internship at ${jobContext.company} (${jobContext.title}).
Each answer should be specific, metric-backed when possible, and under ${MAX_WORDS} words. Lead with project names and technical outcomes.

Return a JSON object mapping question IDs to answers (no markdown, no extra text):
{"<question_id>": "<answer>", ...}

JOB CONTEXT:
${jobContext.title} at ${jobContext.company}
Description: ${jobContext.description.slice(0, 500)}

QUESTIONS:
${questionsBlock}`;

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

  const userPrompt = `Answer this screening question for the internship at ${jobContext.company} (${jobContext.title}).
The answer should be specific, metric-backed when possible, and under ${MAX_WORDS} words. Lead with project names and technical outcomes.

Return ONLY the answer text, no JSON, no quotes, no markdown.

JOB CONTEXT:
${jobContext.title} at ${jobContext.company}
Description: ${jobContext.description.slice(0, 500)}

QUESTION: ${question.questionText}`;

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
