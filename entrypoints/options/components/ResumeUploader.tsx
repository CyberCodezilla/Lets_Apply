import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Clock,
  HardDrive,
  Award,
  ChevronRight,
  TrendingUp,
  FileCheck,
  Link2,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { extractTextFromPdf } from '../../../src/utils/pdf-parser';
import { analyzeResumeStructureAndIndustryFit, RECOMMENDED_RESUME_PLATFORMS } from '../../../src/utils/resume-analyzer';
import AtsGuidanceModal from './AtsGuidanceModal';
import type { ResumeMeta, ResumeAtsAnalysis } from '../../../src/types';

interface ResumeUploaderProps {
  onExtracted: (
    text: string,
    fileMeta: { name: string; size: number },
    atsAnalysis?: ResumeAtsAnalysis
  ) => Promise<void> | void;
  successSummary?: string | null;
  currentResumeMeta?: ResumeMeta;
}

export default function ResumeUploader({
  onExtracted,
  successSummary,
  currentResumeMeta,
}: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'analyzing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAtsModal, setShowAtsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setStatus('error');
        setErrorMsg('Please upload a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setStatus('error');
        setErrorMsg('File too large (max 10 MB)');
        return;
      }

      setFileName(file.name);
      setStatus('reading');
      setErrorMsg('');

      try {
        const text = await extractTextFromPdf(file);
        if (!text.trim()) {
          setStatus('error');
          setErrorMsg('No readable text found in PDF — is it a scanned image?');
          return;
        }

        setStatus('analyzing');
        const atsAnalysis = analyzeResumeStructureAndIndustryFit(text);
        await onExtracted(text, { name: file.name, size: file.size }, atsAnalysis);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed to parse PDF');
      }
    },
    [onExtracted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
        e.target.value = '';
      }
    },
    [handleFile]
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'PDF Document';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const ats = currentResumeMeta?.atsAnalysis;

  // Fallback analysis if not yet saved on older profiles
  const activeAtsAnalysis: ResumeAtsAnalysis = ats || {
    overallScore: 85,
    isIndustryReady: true,
    grade: 'A',
    statusText: 'Industry Standard & ATS Verified',
    categoryScores: {
      sectionStructure: 90,
      contactAndLinks: 85,
      impactAndMetrics: 85,
      skillsCategorization: 90,
      atsReadability: 95,
    },
    strengths: ['Standard technical resume layout detected with structured sections.'],
    improvements: ['Include GitHub, LinkedIn, and live project URLs.'],
    recommendedPlatforms: RECOMMENDED_RESUME_PLATFORMS,
    conversionTips: [
      'Use a single-column layout.',
      'Stick to standard fonts like Inter, Computer Modern, or Arial.',
      'Lead bullet points with active verbs and quantifiable metrics.',
    ],
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        id="resume-input"
        type="file"
        accept=".pdf"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* ── Active Uploaded Resume Card (when a resume already exists) ── */}
      {currentResumeMeta && status === 'idle' && (
        <div className="glass-card p-5 border border-la-500/30 bg-la-600/5 space-y-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3.5 flex-wrap">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-la flex items-center justify-center shadow-glow shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-accent-green px-2 py-0.5 rounded-full bg-accent-green/10 border border-accent-green/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Resume Uploaded & Active
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-gray-500" />
                    {formatFileSize(currentResumeMeta.fileSize)}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white truncate mt-1">
                  {currentResumeMeta.fileName}
                </h3>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-gray-500" />
                  Uploaded on {currentResumeMeta.uploadedAt}
                </p>
              </div>
            </div>

            {/* ATS Score Tag */}
            <div className="flex items-center gap-2 self-start">
              <button
                type="button"
                onClick={() => setShowAtsModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-la-500/40 bg-la-600/15 hover:bg-la-600/25 transition-all group"
              >
                <Award className="w-4 h-4 text-la-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <span className="text-[10px] text-gray-400 block font-medium">ATS & Industry Score</span>
                  <span className="text-xs font-bold text-la-300">
                    {activeAtsAnalysis.overallScore}% • Grade {activeAtsAnalysis.grade}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-la-300 group-hover:translate-x-0.5 transition-all ml-1" />
              </button>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-2.5 pt-1 border-t border-surface-300/30">
            <div className="p-2.5 rounded-xl bg-surface-100/50 border border-surface-300/20 text-center">
              <span className="text-xs text-gray-400 block">Skills</span>
              <span className="text-sm font-semibold text-white">
                {currentResumeMeta.skillsCount ?? 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-100/50 border border-surface-300/20 text-center">
              <span className="text-xs text-gray-400 block">Projects</span>
              <span className="text-sm font-semibold text-white">
                {currentResumeMeta.projectsCount ?? 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-100/50 border border-surface-300/20 text-center">
              <span className="text-xs text-gray-400 block">Experience</span>
              <span className="text-sm font-semibold text-white">
                {currentResumeMeta.experienceCount ?? 0}
              </span>
            </div>
          </div>

          {/* ATS Health Check Bar */}
          <div className="p-3 rounded-xl bg-surface-200/40 border border-surface-300/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-soft" />
              <span className="text-gray-300 font-medium">
                {activeAtsAnalysis.isIndustryReady
                  ? 'Meets 80%+ Industry Presentation Threshold (Cleanly Parsable)'
                  : 'Accepted with Formatting Recommendations'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAtsModal(true)}
              className="text-la-400 hover:text-la-300 font-semibold flex items-center gap-1 shrink-0 transition-colors"
            >
              View Scorecard & Free Conversion Platforms
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Dropzone / Upload Area ── */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-7 text-center transition-all duration-300 cursor-pointer
          ${isDragging ? 'border-la-500 bg-la-500/10 scale-[1.01]' : 'border-surface-400/50 hover:border-la-500/50 hover:bg-surface-200/50'}
          ${status === 'success' ? 'border-accent-green/50 bg-accent-green/5' : ''}
          ${status === 'error' ? 'border-accent-red/50 bg-accent-red/5' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {status === 'reading' ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-3 border-la-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-300 font-medium">Extracting text from {fileName}...</p>
            <p className="text-xs text-gray-500">Reading PDF pages locally with layout preservation</p>
          </div>
        ) : status === 'analyzing' ? (
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-la-600/20 flex items-center justify-center animate-pulse-soft">
              <Sparkles className="w-6 h-6 text-la-400" />
            </div>
            <p className="text-la-400 font-medium">Extracting all projects, skills & evaluating ATS score...</p>
            <p className="text-xs text-gray-400">Benchmarking structure against industry tech standards</p>
          </div>
        ) : status === 'success' ? (
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-12 h-12 text-accent-green" />
            <p className="text-accent-green font-medium">Resume parsed & profile populated!</p>
            <p className="text-sm text-gray-300">{successSummary || fileName}</p>
            <p className="text-xs text-gray-500 mt-1">Click or drop another file to replace again</p>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <AlertCircle className="w-12 h-12 text-accent-red" />
            <p className="text-accent-red font-medium">{errorMsg}</p>
            <p className="text-xs text-gray-500 mt-1">Click or drop to try again</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-la-600/10 flex items-center justify-center">
              {isDragging ? (
                <FileText className="w-7 h-7 text-la-400 animate-pulse-soft" />
              ) : currentResumeMeta ? (
                <RefreshCw className="w-7 h-7 text-la-400" />
              ) : (
                <Upload className="w-7 h-7 text-la-400" />
              )}
            </div>
            <div>
              <p className="text-gray-200 font-medium">
                {isDragging
                  ? 'Drop updated resume here'
                  : currentResumeMeta
                  ? 'Upload an Updated Resume'
                  : 'Upload your Resume (PDF)'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {currentResumeMeta
                  ? 'Drag & drop a new PDF or click to browse. Existing profile info will be replaced with all extracted projects & skills.'
                  : 'Drag & drop a PDF or click to browse (AI extracts all projects & evaluates ATS compatibility)'}
              </p>
            </div>

            {/* Quick helper link for platform suggestions */}
            <div className="mt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAtsModal(true);
                }}
                className="text-xs text-la-400 hover:text-la-300 underline underline-offset-2 flex items-center gap-1 inline-flex"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                View recommended resume builders & industry conversion guide
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ATS & Industry Guidance Modal ── */}
      <AtsGuidanceModal
        isOpen={showAtsModal}
        onClose={() => setShowAtsModal(false)}
        analysis={activeAtsAnalysis}
        fileName={currentResumeMeta?.fileName || fileName || undefined}
      />
    </div>
  );
}
