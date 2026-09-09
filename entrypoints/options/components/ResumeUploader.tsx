import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { extractTextFromPdf } from '../../../src/utils/pdf-parser';

interface ResumeUploaderProps {
  onExtracted: (text: string) => Promise<void> | void;
  successSummary?: string | null;
}

export default function ResumeUploader({ onExtracted, successSummary }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'analyzing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

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
        await onExtracted(text);
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
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer
        ${isDragging ? 'border-la-500 bg-la-500/10 scale-[1.02]' : 'border-surface-400/50 hover:border-la-500/50 hover:bg-surface-200/50'}
        ${status === 'success' ? 'border-accent-green/50 bg-accent-green/5' : ''}
        ${status === 'error' ? 'border-accent-red/50 bg-accent-red/5' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById('resume-input')?.click()}
    >
      <input
        id="resume-input"
        type="file"
        accept=".pdf"
        onChange={handleInputChange}
        className="hidden"
      />

      {status === 'reading' ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-3 border-la-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-300 font-medium">Extracting text from {fileName}...</p>
          <p className="text-xs text-gray-500">Reading PDF pages locally</p>
        </div>
      ) : status === 'analyzing' ? (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-la-600/20 flex items-center justify-center animate-pulse-soft">
            <Upload className="w-6 h-6 text-la-400" />
          </div>
          <p className="text-la-400 font-medium">AI is analyzing your resume...</p>
          <p className="text-xs text-gray-400">Extracting skills, projects, experience, and contact details</p>
        </div>
      ) : status === 'success' ? (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-12 h-12 text-accent-green" />
          <p className="text-accent-green font-medium">Resume parsed & profile populated!</p>
          <p className="text-sm text-gray-300">{successSummary || fileName}</p>
          <p className="text-xs text-gray-500 mt-1">Click or drop another file to replace</p>
        </div>
      ) : status === 'error' ? (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <AlertCircle className="w-12 h-12 text-accent-red" />
          <p className="text-accent-red font-medium">{errorMsg}</p>
          <p className="text-xs text-gray-500 mt-1">Click or drop to try again</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-la-600/10 flex items-center justify-center">
            {isDragging ? (
              <FileText className="w-8 h-8 text-la-400 animate-pulse-soft" />
            ) : (
              <Upload className="w-8 h-8 text-la-400" />
            )}
          </div>
          <div>
            <p className="text-gray-200 font-medium">
              {isDragging ? 'Drop your resume here' : 'Upload your Resume'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drag & drop a PDF or click to browse (AI will auto-fill your profile)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
