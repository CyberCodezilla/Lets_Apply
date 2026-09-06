import { useState, useEffect, useCallback } from 'react';
import {
  User, GraduationCap, Wrench, FolderGit2, Briefcase, Settings2, Target,
  Save, CheckCircle2, Send, Sparkles
} from 'lucide-react';
import type { UserProfile } from '../../src/types';
import { DEFAULT_PROFILE } from '../../src/types';
import { getProfile, saveProfile } from '../../src/utils/storage';
import ResumeUploader from './components/ResumeUploader';
import TagInput from './components/TagInput';
import ProjectForm from './components/ProjectForm';
import ExperienceForm from './components/ExperienceForm';
import ApiKeyTester from './components/ApiKeyTester';

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
  const [loaded, setLoaded] = useState(false);

  // Load profile from storage on mount
  useEffect(() => {
    getProfile().then((stored) => {
      if (stored) {
        if (!stored.config?.groqApiKey && import.meta.env.WXT_GROQ_API_KEY) {
          stored.config = {
            ...stored.config,
            groqApiKey: import.meta.env.WXT_GROQ_API_KEY as string,
          };
        }
        if (!stored.config?.selectedModel && import.meta.env.WXT_GROQ_MODEL) {
          stored.config = {
            ...(stored.config || {}),
            selectedModel: import.meta.env.WXT_GROQ_MODEL as string,
          };
        }
        setProfile(stored);
      }
      setLoaded(true);
    });
  }, []);

  // Update a nested field in profile
  const updateField = useCallback(
    <K extends keyof UserProfile>(section: K, field: string, value: unknown) => {
      setProfile((prev) => ({
        ...prev,
        [section]: { ...(prev[section] as Record<string, unknown>), [field]: value },
      }));
    },
    []
  );

  // Save profile to storage
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    await saveProfile(profile);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [profile]);

  // Handle resume text extraction
  const handleResumeExtracted = useCallback((_text: string) => {
    // For now, just show success — user fills details manually
  }, []);

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
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="la-btn flex items-center gap-2"
          >
            {saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved!
              </>
            ) : saveStatus === 'saving' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <nav className="flex flex-wrap gap-2 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
                  Upload your resume to get started. We'll extract the text — then verify and edit your details below.
                </p>
              </div>
              <ResumeUploader onExtracted={handleResumeExtracted} />
              <div className="glass-card p-5">
                <p className="text-sm text-gray-400">
                  💡 After uploading, navigate through the tabs above to fill in or verify each section of your profile.
                  The more detail you provide, the better your AI-generated applications will be.
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
                      value={profile.education.graduationYear}
                      onChange={(e) => updateField('education', 'graduationYear', parseInt(e.target.value) || 0)}
                      placeholder="2025"
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
                      value={profile.preferences.minStipend}
                      onChange={(e) => updateField('preferences', 'minStipend', parseInt(e.target.value) || 0)}
                      placeholder="5000"
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
