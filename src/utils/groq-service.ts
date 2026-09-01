import type { UserProfile, JobContext, MatchResult, ScreeningQuestion } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
4. Keep all responses concise, punchy, and under 120 words per question.
5. Avoid generic boilerplate (e.g., "I am a hard-working student"). Lead with direct project names and technical outcomes.

CANDIDATE PROFILE:
${JSON.stringify(safeProfile, null, 2)}`;
}

async function callGroq(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Match Scoring ──────────────────────────────────────────
export async function computeMatchScore(
  profile: UserProfile,
  jobContext: JobContext
): Promise<MatchResult> {
  const systemPrompt = buildSystemPrompt(profile);

  const userPrompt = `Evaluate the compatibility between the candidate and this internship. Return a JSON object with EXACTLY this format (no markdown, no extra text):
{"score": <number 0-100>, "rationale": ["<reason 1>", "<reason 2>"]}

JOB DETAILS:
Title: ${jobContext.title}
Company: ${jobContext.company}
Location: ${jobContext.location}
Duration: ${jobContext.duration}
Stipend: ${jobContext.stipend}

Description:
${jobContext.description}

Requirements:
${jobContext.requirements.join(', ')}

Candidate's target roles: ${profile.preferences.targetRoles.join(', ')}
Candidate's preferred work mode: ${profile.preferences.workMode}
Candidate's minimum stipend: ₹${profile.preferences.minStipend}/month`;

  const raw = await callGroq(
    profile.config.groqApiKey,
    profile.config.selectedModel,
    systemPrompt,
    userPrompt,
    0.2
  );

  try {
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      rationale: Array.isArray(parsed.rationale) ? parsed.rationale.slice(0, 2) : [],
    };
  } catch {
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
Each answer should be specific, metric-backed when possible, and under 120 words. Lead with project names and technical outcomes.

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
    0.4
  );

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    const parsed = JSON.parse(jsonMatch[0]);
    // Validate all keys are strings
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = String(value);
    }
    return result;
  } catch {
    console.error('Failed to parse answers:', raw);
    // Return empty answers with error indication
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
The answer should be specific, metric-backed when possible, and under 120 words. Lead with project names and technical outcomes.

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
  const start = Date.now();
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
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
