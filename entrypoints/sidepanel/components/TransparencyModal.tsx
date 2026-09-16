import { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Bell,
  Target,
  Wrench,
  Banknote,
  MapPin,
  CheckCircle2,
  Sliders,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import type { UserProfile } from '../../../src/types';
import { saveProfile, clearNotifiedJobs } from '../../../src/utils/storage';

interface TransparencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export default function TransparencyModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
}: TransparencyModalProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    profile?.preferences?.notificationsEnabled ?? true
  );
  const [threshold, setThreshold] = useState(
    profile?.preferences?.minMatchNotificationThreshold || 80
  );
  const [clearedNotifs, setClearedNotifs] = useState(false);

  useEffect(() => {
    if (profile?.preferences) {
      setNotificationsEnabled(profile.preferences.notificationsEnabled ?? true);
      setThreshold(profile.preferences.minMatchNotificationThreshold || 80);
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleToggleNotifications = async () => {
    if (!profile) return;
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    const updated: UserProfile = {
      ...profile,
      preferences: {
        ...profile.preferences,
        notificationsEnabled: nextVal,
      },
    };
    await saveProfile(updated);
    if (onProfileUpdated) onProfileUpdated(updated);
  };

  const handleChangeThreshold = async (newVal: number) => {
    if (!profile) return;
    setThreshold(newVal);
    const updated: UserProfile = {
      ...profile,
      preferences: {
        ...profile.preferences,
        minMatchNotificationThreshold: newVal,
      },
    };
    await saveProfile(updated);
    if (onProfileUpdated) onProfileUpdated(updated);
  };

  const handleClearHistory = async () => {
    await clearNotifiedJobs();
    setClearedNotifs(true);
    setTimeout(() => setClearedNotifs(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] bg-surface-100 border border-surface-300/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300/40 bg-surface-200/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-la-600/20 flex items-center justify-center border border-la-500/30">
              <ShieldCheck className="w-4 h-4 text-la-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Job Matching & Notifier Transparency
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                  100% Private
                </span>
              </h3>
              <p className="text-xs text-gray-400">How recommendations work and what you need to do</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-300/50 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 space-y-5 text-sm text-gray-300">
          {/* Executive Summary */}
          <div className="glass-card p-4 border border-la-500/20 bg-la-600/5 space-y-2">
            <div className="flex items-center gap-2 text-la-400 font-semibold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>How The Match Notifier Works</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-300">
              When you browse Internshala listing pages, Let's Apply analyzes visible internship cards in{' '}
              <strong>real-time and completely client-side</strong>. It scores each opportunity against your verified resume data using our deterministic multi-factor rubric, triggering a desktop notification only when an internship meets your high-compatibility threshold.
            </p>
          </div>

          {/* 4 Pillars Scoring Rubric */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-la-400" />
              The 4 Evaluation Pillars
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-surface-200/60 border border-surface-300/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-la-400" />
                    Role & Title (35%)
                  </span>
                  <span className="text-[10px] text-la-400 font-mono">0-35 pts</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Evaluates alignment with your target roles, past projects, and domain specialization.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-200/60 border border-surface-300/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-accent-green" />
                    Verified Skills (40%)
                  </span>
                  <span className="text-[10px] text-accent-green font-mono">0-40 pts</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Matches explicit job skill tags against your verified resume skills and project tech stacks.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-200/60 border border-surface-300/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-accent-yellow" />
                    Stipend Threshold (15%)
                  </span>
                  <span className="text-[10px] text-accent-yellow font-mono">0-15 pts</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Ensures offered compensation meets or exceeds your minimum monthly stipend preference.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-200/60 border border-surface-300/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-accent-purple" />
                    Work Mode (10%)
                  </span>
                  <span className="text-[10px] text-accent-purple font-mono">0-10 pts</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Checks remote suitability or geographic match with your preferred city.
                </p>
              </div>
            </div>
          </div>

          {/* User Guide: What you need to do */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" />
              What You Need To Do
            </h4>

            <ol className="space-y-2 text-xs text-gray-300">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-surface-300 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  <strong>Keep Your Resume Updated:</strong> Upload your latest resume so the AI has access to all your verified skills and recent projects.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-surface-300 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  <strong>Set Your Target Roles:</strong> In Preferences, specify roles you want (e.g. <em>Frontend Developer, Full Stack Intern</em>).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-surface-300 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong>Browse Internshala As Usual:</strong> Open Internshala search or listings. Let's Apply highlights top matches on-screen and sends desktop alerts.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-surface-300 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  4
                </span>
                <span>
                  <strong>1-Click Apply:</strong> Click any desktop notification or on-page badge to jump directly to the internship with the AI ready to auto-fill.
                </span>
              </li>
            </ol>
          </div>

          {/* Controls: Toggle & Threshold Picker */}
          <div className="p-4 rounded-xl bg-surface-200/70 border border-surface-300/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-la-400" />
                <span className="text-xs font-semibold text-white">Browser Notifications</span>
              </div>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  notificationsEnabled ? 'bg-la-500' : 'bg-surface-400'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    notificationsEnabled ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400">Notification Threshold</label>
                <span className="text-xs font-bold text-accent-green">{threshold}% and above</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[70, 75, 80, 85, 90].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleChangeThreshold(val)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      threshold === val
                        ? 'bg-la-600/30 border-la-500 text-white shadow-sm'
                        : 'bg-surface-100 border-surface-300/40 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">
                We recommend <strong>80% or 85%</strong> to ensure you only get notified for high-probability, high-quality matches.
              </p>
            </div>

            <div className="pt-2 border-t border-surface-300/30 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Zero-Spam Deduplication Active</span>
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-[11px] text-la-400 hover:text-la-300 underline"
              >
                {clearedNotifs ? 'History Cleared!' : 'Reset Alerted Jobs'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-300/40 bg-surface-200/40 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
            }}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>Edit Full Profile in Settings</span>
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gradient-la text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
