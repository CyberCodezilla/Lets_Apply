import type { UserProfile, JobContext, ApplicationRecord } from '../types';

const STORAGE_KEYS = {
  PROFILE: 'user_profile',
  JOB_CONTEXT: 'current_job_context',
  HISTORY: 'applied_history',
} as const;

// ─── Profile ────────────────────────────────────────────────
export async function getProfile(): Promise<UserProfile | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
  return (result[STORAGE_KEYS.PROFILE] as UserProfile) ?? null;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILE]: profile });
}

// ─── Job Context ────────────────────────────────────────────
export async function getJobContext(): Promise<JobContext | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.JOB_CONTEXT);
  return (result[STORAGE_KEYS.JOB_CONTEXT] as JobContext) ?? null;
}

export async function saveJobContext(context: JobContext): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.JOB_CONTEXT]: context });
}

// ─── Application History ────────────────────────────────────
export async function getHistory(): Promise<ApplicationRecord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
  return (result[STORAGE_KEYS.HISTORY] as ApplicationRecord[]) ?? [];
}

export async function addToHistory(record: ApplicationRecord): Promise<void> {
  const history = await getHistory();
  // Prevent duplicates by jobId
  const filtered = history.filter((r) => r.jobId !== record.jobId);
  filtered.unshift(record);
  // Keep last 200 records
  if (filtered.length > 200) filtered.length = 200;
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: filtered });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.HISTORY);
}
