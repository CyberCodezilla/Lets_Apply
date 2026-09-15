import { useState, useEffect, useCallback, useRef } from 'react';
import {
  User, GraduationCap, Wrench, FolderGit2, Briefcase, Settings2, Target,
  Save, CheckCircle2, Send, Sparkles, Loader2, Check, ExternalLink
} from 'lucide-react';
import type { UserProfile } from '../../src/types';
import { DEFAULT_PROFILE } from '../../src/types';
import { getProfile, saveProfile } from '../../src/utils/storage';
import ResumeUploader from './components/ResumeUploader';
import TagInput from './components/TagInput';
import ProjectForm from './components/ProjectForm';
import ExperienceForm from './components/ExperienceForm';
import ApiKeyTester from './components/ApiKeyTester';
import { parseResumeWithAI } from '../../src/utils/groq-service';

type TabId = 'resume' | 'personal' | 'education' | 'skills' | 'projects' | 'experience' | 'preferences' | 'api';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'resume', label: 'Resume', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'personal', label: 'Personal', icon: <User className="w-4 h-4" /> },
  { id: 'education', label: 'Education', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'skills', label: 'Skills', icon: <Wrench className="w-4 h-4" /> },
  { id: 'projects', label: 'Projects', icon: <FolderGit2 className="w-4 h-4" /> },
  { id: 'experience', label: 'Experience', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'preferences', label: 'Preferences', icon: <Target className="w-4 h-4" /> },
  { id: 'api', label: 'API Settings', icon: <Settings2 className="w-4 h-4" /> },
];

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [activeTab, setActiveTab] = useState<TabId>('resume');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [resumeSuccessSummary, setResumeSuccessSummary] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const profileRef = useRef<UserProfile>(DEFAULT_PROFILE);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadedRef = useRef(false);

  // Keep profileRef in sync with profile state
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Load profile from storage on mount with deep merge
  useEffect(() => {
    Promise.all([
      getProfile(),
      chrome.storage.local.get('last_active_options_tab'),
    ]).then(([stored, tabResult]) => {
      const merged: UserProfile = {
        ...DEFAULT_PROFILE,
        ...(stored || {}),
        personal: {
          ...DEFAULT_PROFILE.personal,
          ...(stored?.personal || {}),
        },
        education: {
          ...DEFAULT_PROFILE.education,
          ...(stored?.education || {}),
        },
        skills: Array.isArray(stored?.skills) ? stored.skills : DEFAULT_PROFILE.skills,
        projects: Array.isArray(stored?.projects) ? stored.projects : DEFAULT_PROFILE.projects,
        experience: Array.isArray(stored?.experience) ? stored.experience : DEFAULT_PROFILE.experience,
        preferences: {
          ...DEFAULT_PROFILE.preferences,
          ...(stored?.preferences || {}),
          targetRoles: Array.isArray(stored?.preferences?.targetRoles)
            ? stored.preferences.targetRoles
            : DEFAULT_PROFILE.preferences.targetRoles,
        },
        config: {
          ...DEFAULT_PROFILE.config,
          ...(stored?.config || {}),
          groqApiKey:
            stored?.config?.groqApiKey || (import.meta.env.WXT_GROQ_API_KEY as string) || '',
          selectedModel:
            !stored?.config?.selectedModel || stored?.config?.selectedModel.includes('llama')
              ? (import.meta.env.WXT_GROQ_MODEL as string) || 'openai/gpt-oss-120b'
              : stored.config.selectedModel,
        },
        resumeMeta:
          stored?.resumeMeta ||
          (stored?.skills?.length || stored?.projects?.length
            ? {
                fileName: 'Uploaded_Resume.pdf',
                fileSize: 1024 * 1024,
                uploadedAt: 'Active Resume',
                skillsCount: stored?.skills?.length || 0,
                projectsCount: stored?.projects?.length || 0,
                experienceCount: stored?.experience?.length || 0,
              }
            : undefined),
      };

      setProfile(merged);
      profileRef.current = merged;

      const savedTab = tabResult?.last_active_options_tab as TabId | undefined;
      if (savedTab && TABS.some((t) => t.id === savedTab)) {
        setActiveTab(savedTab);
      }

      setLoaded(true);
      // Allow state to settle before enabling auto-save listener
      setTimeout(() => {
        isLoadedRef.current = true;
      }, 50);
    });
  }, []);

  // Flush save on page close / blur / unload so inputs are never lost
  useEffect(() => {
    const flushSave = () => {
      if (isLoadedRef.current) {
        saveProfile(profileRef.current).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', flushSave);
    window.addEventListener('pagehide', flushSave);
    return () => {
      window.removeEventListener('beforeunload', flushSave);
      window.removeEventListener('pagehide', flushSave);
    };
  }, []);

  // Auto-save whenever profile changes (debounced by 250ms)
  useEffect(() => {
    if (!isLoadedRef.current) return;

    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveProfile(profileRef.current);
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 1500);
      } catch (err) {
        console.error('Auto-save error:', err);
        setSaveStatus('idle');
      }
    }, 250);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [profile]);

  // Switch tab and immediately persist tab selection & flush pending saves
  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    chrome.storage.local.set({ last_active_options_tab: tabId }).catch(console.error);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveProfile(profileRef.current).catch(console.error);
  }, []);

  // Update a nested field in profile (triggers auto-save)
  const updateField = useCallback(
    <K extends keyof UserProfile>(section: K, field: string, value: unknown) => {
      setProfile((prev) => {
        const next = {
          ...prev,
          [section]: { ...(prev[section] as Record<string, unknown>), [field]: value },
        };
        profileRef.current = next;
        return next;
      });
    },
    []
  );

  // Manual save profile to storage
  const handleSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSaveStatus('saving');
    await saveProfile(profileRef.current);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  // Handle resume text extraction & AI auto-population
  const handleResumeExtracted = useCallback(
    async (text: string, fileMeta: { name: string; size: number }) => {
      setResumeSuccessSummary(null);

      const apiKey = profile.config?.groqApiKey || (import.meta.env.WXT_GROQ_API_KEY as string);
      if (!apiKey) {
        throw new Error('Please configure your Groq API key in the "API Settings" tab first so AI can parse your resume.');
      }

      const parsed = await parseResumeWithAI(text, apiKey, profile.config?.selectedModel);

      const countSkills = parsed.skills?.length || 0;
      const countProjects = parsed.projects?.length || 0;
      const countExp = parsed.experience?.length || 0;

      const now = new Date();
      const formattedDate =
        now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) +
        ' at ' +
        now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

      // Replace profile fields with newly extracted resume data
      setProfile((prev) => {
        const updated: UserProfile = {
          ...prev,
          personal: {
            fullName: parsed.personal?.fullName || prev.personal.fullName,
            email: parsed.personal?.email || prev.personal.email,
            phone: parsed.personal?.phone || prev.personal.phone,
            location: parsed.personal?.location || prev.personal.location,
            portfolioUrl: parsed.personal?.portfolioUrl || prev.personal.portfolioUrl,
            githubUrl: parsed.personal?.githubUrl || prev.personal.githubUrl,
            linkedinUrl: parsed.personal?.linkedinUrl || prev.personal.linkedinUrl,
          },
          education: {
            degree: parsed.education?.degree || prev.education.degree,
            institution: parsed.education?.institution || prev.education.institution,
            graduationYear: Number(parsed.education?.graduationYear) || prev.education.graduationYear,
            cgpaOrPercentage: parsed.education?.cgpaOrPercentage || prev.education.cgpaOrPercentage,
          },
          skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : prev.skills,
          projects: parsed.projects && parsed.projects.length > 0 ? parsed.projects : prev.projects,
          experience: parsed.experience && parsed.experience.length > 0 ? parsed.experience : prev.experience,
          preferences: {
            ...prev.preferences,
            targetRoles:
              parsed.preferences?.targetRoles && parsed.preferences.targetRoles.length > 0
                ? parsed.preferences.targetRoles
                : prev.preferences.targetRoles,
          },
          resumeMeta: {
            fileName: fileMeta.name,
            fileSize: fileMeta.size,
            uploadedAt: formattedDate,
            skillsCount: countSkills,
            projectsCount: countProjects,
            experienceCount: countExp,
          },
        };
        // Auto-save parsed profile
        profileRef.current = updated;
        saveProfile(updated).catch(console.error);
        return updated;
      });

      setResumeSuccessSummary(
        `Extracted ${countSkills} skills, ${countProjects} projects, ${countExp} experiences, and contact details from ${fileMeta.name}! Profile has been updated with the new resume.`
      );
    },
    [profile]
  );

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-la-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 border-b border-surface-300/30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-la flex items-center justify-center shadow-glow">
              <Send className="w-5 h-5 text-white -rotate-12 translate-x-0.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Let's Apply</h1>
              <p className="text-xs text-gray-500">Profile Setup & Settings</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Auto-save status indicator */}
            {saveStatus === 'saving' && (
              <span className="text-xs text-la-400 flex items-center gap-1.5 bg-la-600/10 px-2.5 py-1.5 rounded-xl border border-la-500/20 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-la-400" />
                <span className="hidden xs:inline">Auto-saving...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-accent-green flex items-center gap-1.5 bg-accent-green/10 px-2.5 py-1.5 rounded-xl border border-accent-green/20 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" />
                <span className="hidden xs:inline">Auto-saved</span>
              </span>
            )}
            {saveStatus === 'idle' && (
              <span className="text-xs text-gray-400 items-center gap-1.5 bg-surface-100/60 px-2.5 py-1.5 rounded-xl border border-surface-300/30 hidden sm:flex">
                <Check className="w-3.5 h-3.5 text-accent-green" />
                <span>Auto-save on</span>
              </span>
            )}

            {/* Open in full tab button */}
            <button
              type="button"
              onClick={() => window.open(chrome.runtime.getURL('/options.html'), '_blank')}
              title="Open settings in a full browser tab"
              className="p-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-gray-400 hover:text-white transition-all flex items-center gap-1 text-xs"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden md:inline">Full Tab</span>
            </button>

            {/* Manual Save Profile button */}
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="la-btn flex items-center gap-2 text-sm px-4 py-2"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save Profile</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <nav className="flex flex-wrap gap-2 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`la-tab flex items-center gap-2 ${
                activeTab === tab.id ? 'la-tab-active' : ''
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'resume' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Upload Resume</h2>
                <p className="text-sm text-gray-400">
                  Upload your resume to get started. AI will automatically parse your contact info, education, skills, projects, and experience into your profile!
                </p>
              </div>
              <ResumeUploader
                onExtracted={handleResumeExtracted}
                successSummary={resumeSuccessSummary}
                currentResumeMeta={profile.resumeMeta}
              />

              {resumeSuccessSummary && (
                <div className="glass-card p-5 border border-accent-green/30 bg-accent-green/5 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-accent-green font-medium">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Profile auto-populated & saved successfully!</span>
                  </div>
                  <p className="text-sm text-gray-300">{resumeSuccessSummary}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => setActiveTab('personal')}
                      className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs font-medium text-white transition-colors"
                    >
                      Review Personal Info →
                    </button>
                    <button
                      onClick={() => setActiveTab('skills')}
                      className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs font-medium text-white transition-colors"
                    >
                      Review Skills ({profile.skills.length}) →
                    </button>
                    <button
                      onClick={() => setActiveTab('projects')}
                      className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs font-medium text-white transition-colors"
                    >
                      Review Projects ({profile.projects.length}) →
                    </button>
                    <button
                      onClick={() => setActiveTab('experience')}
                      className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs font-medium text-white transition-colors"
                    >
                      Review Experience ({profile.experience.length}) →
                    </button>
                  </div>
                </div>
              )}

              <div className="glass-card p-5">
                <p className="text-sm text-gray-400">
                  💡 After uploading, verify each section using the tabs above.
                  The more detail you provide, the higher your match score and the better your AI-generated screening answers will be.
                </p>
              </div>
            </section>
          )}

          {activeTab === 'personal' && (
            <section className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Personal Information</h2>
              <div className="glass-card p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="la-label">Full Name *</label>
                    <input
                      type="text"
                      value={profile.personal.fullName}
                      onChange={(e) => updateField('personal', 'fullName', e.target.value)}
                      placeholder="John Doe"
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">Email *</label>
                    <input
                      type="email"
                      value={profile.personal.email}
                      onChange={(e) => updateField('personal', 'email', e.target.value)}
                      placeholder="john@example.com"
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">Phone *</label>
                    <input
                      type="tel"
                      value={profile.personal.phone}
                      onChange={(e) => updateField('personal', 'phone', e.target.value)}
                      placeholder="+91 9876543210"
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">Location</label>
                    <input
                      type="text"
                      value={profile.personal.location}
                      onChange={(e) => updateField('personal', 'location', e.target.value)}
                      placeholder="Mumbai, India"
                      className="la-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="la-label">GitHub URL</label>
                    <input
                      type="url"
                      value={profile.personal.githubUrl || ''}
                      onChange={(e) => updateField('personal', 'githubUrl', e.target.value)}
                      placeholder="https://github.com/..."
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">LinkedIn URL</label>
                    <input
                      type="url"
                      value={profile.personal.linkedinUrl || ''}
                      onChange={(e) => updateField('personal', 'linkedinUrl', e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">Portfolio URL</label>
                    <input
                      type="url"
                      value={profile.personal.portfolioUrl || ''}
                      onChange={(e) => updateField('personal', 'portfolioUrl', e.target.value)}
                      placeholder="https://..."
                      className="la-input"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'education' && (
            <section className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Education</h2>
              <div className="glass-card p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="la-label">Degree *</label>
                    <input
                      type="text"
                      value={profile.education.degree}
                      onChange={(e) => updateField('education', 'degree', e.target.value)}
                      placeholder="B.Tech in Computer Science"
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">Institution *</label>
                    <input
                      type="text"
                      value={profile.education.institution}
                      onChange={(e) => updateField('education', 'institution', e.target.value)}
                      placeholder="IIT Bombay"
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">Graduation Year</label>
                    <input
                      type="number"
                      min="1900"
                      max="2100"
                      value={profile.education.graduationYear || ''}
                      onKeyDown={(e) => {
                        if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                        const trimmed = digitsOnly.slice(0, 4);
                        updateField('education', 'graduationYear', trimmed === '' ? 0 : parseInt(trimmed, 10) || 0);
                      }}
                      placeholder="e.g. 2025"
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">CGPA / Percentage</label>
                    <input
                      type="text"
                      value={profile.education.cgpaOrPercentage || ''}
                      onChange={(e) => updateField('education', 'cgpaOrPercentage', e.target.value)}
                      placeholder="8.5 CGPA"
                      className="la-input"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'skills' && (
            <section className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Skills</h2>
              <div className="glass-card p-6">
                <TagInput
                  label="Technical Skills"
                  tags={profile.skills}
                  onChange={(skills) => setProfile((p) => ({ ...p, skills }))}
                  placeholder="e.g. React, Python, Machine Learning"
                />
                <p className="text-xs text-gray-500 mt-3">
                  Add all relevant technical skills. These are used to match against job requirements and generate targeted answers.
                </p>
              </div>
            </section>
          )}

          {activeTab === 'projects' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Projects</h2>
                <p className="text-sm text-gray-400">
                  Add your most impactful projects. Include metrics and tech stack for better AI responses.
                </p>
              </div>
              <ProjectForm
                projects={profile.projects}
                onChange={(projects) => setProfile((p) => ({ ...p, projects }))}
              />
            </section>
          )}

          {activeTab === 'experience' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Experience</h2>
                <p className="text-sm text-gray-400">
                  Add internships, freelance work, or any relevant experience.
                </p>
              </div>
              <ExperienceForm
                experiences={profile.experience}
                onChange={(experience) => setProfile((p) => ({ ...p, experience }))}
              />
            </section>
          )}

          {activeTab === 'preferences' && (
            <section className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Application Preferences</h2>
              <div className="glass-card p-6 space-y-5">
                <TagInput
                  label="Target Roles"
                  tags={profile.preferences.targetRoles}
                  onChange={(targetRoles) => updateField('preferences', 'targetRoles', targetRoles)}
                  placeholder="e.g. Frontend Developer, Data Analyst"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="la-label">Minimum Stipend (₹/month)</label>
                    <input
                      type="number"
                      min="0"
                      value={profile.preferences.minStipend || ''}
                      onKeyDown={(e) => {
                        if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                        updateField('preferences', 'minStipend', digitsOnly === '' ? 0 : parseInt(digitsOnly, 10) || 0);
                      }}
                      placeholder="0 (e.g. 15000)"
                      className="la-input"
                    />
                  </div>
                  <div>
                    <label className="la-label">Work Mode</label>
                    <select
                      value={profile.preferences.workMode}
                      onChange={(e) => updateField('preferences', 'workMode', e.target.value)}
                      className="la-input cursor-pointer"
                    >
                      <option value="Any">Any</option>
                      <option value="Remote">Remote</option>
                      <option value="In-Office">In-Office</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'api' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">API Settings</h2>
                <p className="text-sm text-gray-400">
                  Configure your Groq Cloud API key for AI-powered answer generation.
                </p>
              </div>
              <div className="glass-card p-6">
                <ApiKeyTester
                  apiKey={profile.config.groqApiKey}
                  model={profile.config.selectedModel}
                  onApiKeyChange={(key) => updateField('config', 'groqApiKey', key)}
                  onModelChange={(model) => updateField('config', 'selectedModel', model)}
                />
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
