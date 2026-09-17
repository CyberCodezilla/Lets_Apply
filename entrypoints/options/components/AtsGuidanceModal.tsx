import React from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Award,
  Layers,
  Sparkles,
  Link2,
  TrendingUp,
  FileCheck,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import type { ResumeAtsAnalysis } from '../../../src/types';

interface AtsGuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: ResumeAtsAnalysis;
  fileName?: string;
}

export default function AtsGuidanceModal({
  isOpen,
  onClose,
  analysis,
  fileName,
}: AtsGuidanceModalProps) {
  if (!isOpen) return null;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-accent-green';
    if (score >= 75) return 'text-la-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-accent-red';
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'bg-accent-green/10 border-accent-green/30 text-accent-green';
    if (score >= 75) return 'bg-la-600/10 border-la-500/30 text-la-400';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    return 'bg-accent-red/10 border-accent-red/30 text-accent-red';
  };

  const getProgressColor = (score: number) => {
    if (score >= 85) return 'bg-accent-green';
    if (score >= 75) return 'bg-la-500';
    if (score >= 60) return 'bg-amber-400';
    return 'bg-accent-red';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-3xl max-h-[90vh] flex flex-col border border-surface-300/40 shadow-2xl rounded-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-surface-300/40 flex items-center justify-between bg-surface-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-la flex items-center justify-center shadow-glow shrink-0">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Industry Resume Quality & ATS Scorecard
              </h2>
              <p className="text-xs text-gray-400">
                Evaluating {fileName || 'your resume'} against modern engineering hiring standards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-300/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-300">
          {/* Top Score Banner */}
          <div className="p-5 rounded-2xl border border-surface-300/30 bg-surface-100/40 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-surface-300/40 flex items-center justify-center">
                  <span className={`text-2xl font-extrabold ${getScoreColor(analysis.overallScore)}`}>
                    {analysis.overallScore}%
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getScoreBg(analysis.overallScore)}`}>
                    Grade {analysis.grade} • {analysis.isIndustryReady ? 'Industry Ready' : 'Allowed with Recommendations'}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mt-1.5">
                  {analysis.statusText}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  80–85% is our benchmark tolerance: resumes passing 75%+ are fully accepted and synced into your profile!
                </p>
              </div>
            </div>
          </div>

          {/* 5-Dimension Category Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-la-400" />
              Evaluation Breakdown Across 5 Industry Dimensions
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Section Structure */}
              <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300/20 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-200 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-la-400" />
                    Section Structure & Headings
                  </span>
                  <span className={`font-semibold ${getScoreColor(analysis.categoryScores.sectionStructure)}`}>
                    {analysis.categoryScores.sectionStructure}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(analysis.categoryScores.sectionStructure)} transition-all duration-500`}
                    style={{ width: `${analysis.categoryScores.sectionStructure}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Standard headings: Education, Skills, Projects, Experience, and Certifications.
                </p>
              </div>

              {/* Action Verbs & Metrics */}
              <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300/20 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-200 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-accent-green" />
                    Impact & Quantifiable Metrics
                  </span>
                  <span className={`font-semibold ${getScoreColor(analysis.categoryScores.impactAndMetrics)}`}>
                    {analysis.categoryScores.impactAndMetrics}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(analysis.categoryScores.impactAndMetrics)} transition-all duration-500`}
                    style={{ width: `${analysis.categoryScores.impactAndMetrics}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Google X-Y-Z formula: Strong active verbs + numbers, percentages, and latencies.
                </p>
              </div>

              {/* Contact & Links */}
              <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300/20 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-200 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-blue-400" />
                    Contact & Professional Links
                  </span>
                  <span className={`font-semibold ${getScoreColor(analysis.categoryScores.contactAndLinks)}`}>
                    {analysis.categoryScores.contactAndLinks}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(analysis.categoryScores.contactAndLinks)} transition-all duration-500`}
                    style={{ width: `${analysis.categoryScores.contactAndLinks}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Verified email, phone number, LinkedIn, and GitHub/Portfolio handles.
                </p>
              </div>

              {/* Skills Categorization */}
              <div className="p-3.5 rounded-xl bg-surface-200/40 border border-surface-300/20 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-gray-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Skills Categorization & Depth
                  </span>
                  <span className={`font-semibold ${getScoreColor(analysis.categoryScores.skillsCategorization)}`}>
                    {analysis.categoryScores.skillsCategorization}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(analysis.categoryScores.skillsCategorization)} transition-all duration-500`}
                    style={{ width: `${analysis.categoryScores.skillsCategorization}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Categorized into Languages, Frameworks, Tools, and Databases for ATS scanners.
                </p>
              </div>
            </div>
          </div>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Strengths */}
            <div className="p-4 rounded-xl bg-accent-green/5 border border-accent-green/20 space-y-2.5">
              <h5 className="text-xs font-bold text-accent-green uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Key Strengths Detected
              </h5>
              <ul className="space-y-1.5 text-xs text-gray-300">
                {analysis.strengths.length > 0 ? (
                  analysis.strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-accent-green mt-0.5">•</span>
                      <span>{str}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-400">Baseline resume format detected.</li>
                )}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
              <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Actionable Optimization Tips
              </h5>
              <ul className="space-y-1.5 text-xs text-gray-300">
                {analysis.improvements.length > 0 ? (
                  analysis.improvements.map((imp, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{imp}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-accent-green">
                    Your resume already adheres to all key industry and ATS presentation guidelines!
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Recommended Platforms */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-la-400" />
              Recommended Free Platforms for ATS-Standard Resumes
            </h4>
            <p className="text-xs text-gray-400">
              If you wish to convert or polish your resume into a 100% ATS-compliant single-column layout, we recommend these industry-trusted tools:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysis.recommendedPlatforms.map((p, idx) => (
                <a
                  key={idx}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between group hover:scale-[1.02] ${
                    p.isRecommended
                      ? 'bg-la-600/10 border-la-500/40 hover:border-la-400 shadow-glow/30'
                      : 'bg-surface-200/40 border-surface-300/30 hover:border-surface-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-white group-hover:text-la-400 transition-colors flex items-center gap-1">
                        {p.name}
                      </h5>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-la-400" />
                    </div>
                    {p.isRecommended && (
                      <span className="inline-block mt-1 text-[10px] font-semibold text-la-400 px-1.5 py-0.5 rounded bg-la-500/20">
                        Gold Standard
                      </span>
                    )}
                    <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{p.description}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-surface-300/20 text-[10px] text-gray-500 font-medium">
                    Best for: {p.bestFor}
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Conversion Guide */}
          <div className="p-4 rounded-xl bg-surface-200/50 border border-surface-300/30 space-y-2">
            <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-la-400" />
              How to Convert Your Resume in 5 Minutes:
            </h5>
            <ol className="space-y-1.5 text-xs text-gray-300 list-decimal list-inside">
              {analysis.conversionTips.map((tip, idx) => (
                <li key={idx} className="leading-relaxed">
                  {tip}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-surface-300/40 bg-surface-200/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-la text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-glow"
          >
            Got It, Back to Profile
          </button>
        </div>
      </div>
    </div>
  );
}
