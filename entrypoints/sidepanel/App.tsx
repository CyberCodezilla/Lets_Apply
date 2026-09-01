import { useState, useCallback, useEffect } from 'react';
import {
  Send, Settings, AlertTriangle, Globe, Loader2, CheckCircle2,
  Sparkles, Building2, MapPin, Clock, BanknoteIcon
} from 'lucide-react';
import type { UserProfile, JobContext, ScrapeResultPayload, FillResultPayload } from '../../src/types';
import { getProfile } from '../../src/utils/storage';
import { addToHistory } from '../../src/utils/storage';
import { computeMatchScore, generateAnswers, regenerateAnswer } from '../../src/utils/groq-service';
import MatchScoreBadge from './components/MatchScoreBadge';
import AnswerCard from './components/AnswerCard';
import ActionFooter from './components/ActionFooter';

type PanelState = 'loading-profile' | 'no-profile' | 'not-internshala' | 'ready' | 'analyzing' | 'review' | 'success' | 'error';

export default function App() {
  const [panelState, setPanelState] = useState<PanelState>('loading-profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [jobContext, setJobContext] = useState<JobContext | null>(null);
  const [matchScore, setMatchScore] = useState(0);
  const [rationale, setRationale] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isFillingForm, setIsFillingForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load profile on mount
  useEffect(() => {
    getProfile().then((p) => {
      if (!p || !p.config.groqApiKey) {
        setPanelState('no-profile');
      } else {
        setProfile(p);
        setPanelState('ready');
      }
    });
  }, []);

  // Scrape & Analyze the current page
  const handleAnalyze = useCallback(async () => {
    if (!profile) return;

    setPanelState('analyzing');
    setErrorMessage('');

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.includes('internshala.com')) {
        setPanelState('not-internshala');
        return;
      }

      // Scrape the page via content script
      const scrapeResult = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PAGE' }) as ScrapeResultPayload;

      if (!scrapeResult.success || !scrapeResult.data) {
        throw new Error(scrapeResult.error || 'Failed to scrape page');
      }

      const job = scrapeResult.data;
      setJobContext(job);

      // Call Groq API for match score and answers in parallel
      const [matchResult, generatedAnswers] = await Promise.all([
        computeMatchScore(profile, job),
        generateAnswers(profile, job, job.screeningQuestions),
      ]);

      setMatchScore(matchResult.score);
      setRationale(matchResult.rationale);
      setAnswers(generatedAnswers);
      setPanelState('review');
    } catch (err) {
      console.error('Analysis error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error occurred');
      setPanelState('error');
    }
  }, [profile]);

  // Regenerate a single answer
  const handleRegenerate = useCallback(
    async (questionId: string) => {
      if (!profile || !jobContext) return;

      const question = jobContext.screeningQuestions.find((q) => q.id === questionId);
      if (!question) return;

      setRegeneratingId(questionId);
      try {
        const newAnswer = await regenerateAnswer(profile, jobContext, question);
        setAnswers((prev) => ({ ...prev, [questionId]: newAnswer }));
      } catch (err) {
        console.error('Regenerate error:', err);
      }
      setRegeneratingId(null);
    },
    [profile, jobContext]
  );

  // Update answer text (from user editing)
  const handleAnswerChange = useCallback((id: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [id]: answer }));
  }, []);

  // Auto-fill the form on the page
  const handleAutoFill = useCallback(async () => {
    if (!jobContext) return;

    setIsFillingForm(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      const result = await chrome.tabs.sendMessage(tab.id, {
        type: 'FILL_FORM',
        payload: { answers },
      }) as FillResultPayload;

      if (result.success) {
        // Save to history
        await addToHistory({
          jobId: jobContext.jobId,
          jobTitle: jobContext.title,
          company: jobContext.company,
          matchScore,
          generatedAnswers: answers,
          appliedAt: new Date().toISOString(),
          status: 'APPLIED',
        });
        setPanelState('success');
      } else {
        throw new Error(result.error || 'Failed to fill form');
      }
    } catch (err) {
      console.error('Auto-fill error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fill form');
    }
    setIsFillingForm(false);
  }, [jobContext, answers, matchScore]);

  // Skip this application
  const handleSkip = useCallback(async () => {
    if (!jobContext) return;

    await addToHistory({
      jobId: jobContext.jobId,
      jobTitle: jobContext.title,
      company: jobContext.company,
      matchScore,
      generatedAnswers: answers,
      appliedAt: new Date().toISOString(),
      status: 'SKIPPED',
    });

    // Reset to ready state
    setJobContext(null);
    setAnswers({});
    setMatchScore(0);
    setRationale([]);
    setPanelState('ready');
  }, [jobContext, answers, matchScore]);

  // Open options page
  const openOptions = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  }, []);

  return (
    <div className="min-h-screen bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-la flex items-center justify-center shadow-glow">
            <Send className="w-4 h-4 text-white -rotate-12 translate-x-0.5" />
          </div>
          <span className="text-base font-bold text-white">Let's Apply</span>
        </div>
        <button
          onClick={openOptions}
          className="p-2 rounded-lg hover:bg-surface-300/40 text-gray-400 hover:text-white transition-all"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* ── Loading Profile ── */}
      {panelState === 'loading-profile' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-8 h-8 text-la-500 animate-spin" />
          <p className="text-sm text-gray-400">Loading profile...</p>
        </div>
      )}

      {/* ── No Profile ── */}
      {panelState === 'no-profile' && (
        <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-la-600/10 flex items-center justify-center">
            <Send className="w-8 h-8 text-la-400 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Welcome to Let's Apply!</h2>
            <p className="text-sm text-gray-400 max-w-[260px]">
              Set up your profile and Groq API key to start auto-filling applications.
            </p>
          </div>
          <button onClick={openOptions} className="la-btn">
            Open Setup Page
          </button>
        </div>
      )}

      {/* ── Not Internshala ── */}
      {panelState === 'not-internshala' && (
        <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-yellow/10 flex items-center justify-center">
            <Globe className="w-8 h-8 text-accent-yellow" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Navigate to Internshala</h2>
            <p className="text-sm text-gray-400 max-w-[260px]">
              Open an internship detail page on internshala.com to start analyzing.
            </p>
          </div>
          <button
            onClick={() => setPanelState('ready')}
            className="la-btn-secondary text-sm"
          >
            I'm on Internshala — Try Again
          </button>
        </div>
      )}

      {/* ── Ready to Analyze ── */}
      {panelState === 'ready' && (
        <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-la-600/10 flex items-center justify-center animate-pulse-soft">
            <Sparkles className="w-8 h-8 text-la-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Ready to Analyze</h2>
            <p className="text-sm text-gray-400 max-w-[260px]">
              Navigate to an Internshala internship page, then click below to analyze and generate answers.
            </p>
          </div>
          <button onClick={handleAnalyze} className="la-btn flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Analyze Page
          </button>
        </div>
      )}

      {/* ── Analyzing ── */}
      {panelState === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-la-600/10 flex items-center justify-center">
              <Send className="w-8 h-8 text-la-400 -rotate-12 translate-x-0.5" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-la-500 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white mb-1">Analyzing internship...</p>
            <p className="text-xs text-gray-500">Scraping page & generating AI answers</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-la-500 animate-pulse-soft"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {panelState === 'error' && (
        <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-red/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-accent-red" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-400 max-w-[280px]">{errorMessage}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setPanelState('ready')} className="la-btn-secondary text-sm">
              Dismiss
            </button>
            <button onClick={handleAnalyze} className="la-btn text-sm">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Review (Main UI) ── */}
      {panelState === 'review' && jobContext && (
        <div className="space-y-5 animate-fade-in">
          {/* Job Header + Score */}
          <div className="glass-card p-4">
            <div className="flex gap-4">
              <MatchScoreBadge score={matchScore} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-white truncate">{jobContext.title}</h2>
                <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="truncate">{jobContext.company}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                  {jobContext.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {jobContext.location}
                    </span>
                  )}
                  {jobContext.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {jobContext.duration}
                    </span>
                  )}
                  {jobContext.stipend && (
                    <span className="flex items-center gap-1">
                      <BanknoteIcon className="w-3 h-3" />
                      {jobContext.stipend}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Rationale */}
            {rationale.length > 0 && (
              <div className="mt-3 pt-3 border-t border-surface-300/30">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Why you match</p>
                <ul className="space-y-1">
                  {rationale.map((r, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-la-400 mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Answers */}
          {jobContext.screeningQuestions.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Screening Questions ({jobContext.screeningQuestions.length})
              </p>
              <div className="space-y-3">
                {jobContext.screeningQuestions.map((q) => (
                  <AnswerCard
                    key={q.id}
                    questionId={q.id}
                    questionText={q.questionText}
                    answer={answers[q.id] || ''}
                    onAnswerChange={handleAnswerChange}
                    onRegenerate={handleRegenerate}
                    isRegenerating={regeneratingId === q.id}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-400">No screening questions detected on this page.</p>
            </div>
          )}

          {/* Action Footer */}
          <ActionFooter
            onAutoFill={handleAutoFill}
            onSkip={handleSkip}
            isFillingForm={isFillingForm}
          />
        </div>
      )}

      {/* ── Success ── */}
      {panelState === 'success' && (
        <div className="flex flex-col items-center justify-center py-12 gap-5 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-accent-green/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-accent-green" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Form Filled Successfully!</h2>
            <p className="text-sm text-gray-400 max-w-[260px]">
              Review the filled form on the page and click Internshala's Submit button to apply.
            </p>
          </div>
          <button
            onClick={() => {
              setJobContext(null);
              setAnswers({});
              setMatchScore(0);
              setRationale([]);
              setPanelState('ready');
            }}
            className="la-btn-secondary text-sm"
          >
            Analyze Another Internship
          </button>
        </div>
      )}
    </div>
  );
}
