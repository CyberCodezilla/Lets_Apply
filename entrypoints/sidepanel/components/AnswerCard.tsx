import { useState } from 'react';
import { RefreshCw, MessageSquareText } from 'lucide-react';

interface AnswerCardProps {
  questionId: string;
  questionText: string;
  answer: string;
  onAnswerChange: (id: string, answer: string) => void;
  onRegenerate: (id: string) => void;
  isRegenerating?: boolean;
}

export default function AnswerCard({
  questionId,
  questionText,
  answer,
  onAnswerChange,
  onRegenerate,
  isRegenerating = false,
}: AnswerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const wordCount = answer.split(/\s+/).filter(Boolean).length;

  return (
    <div className="glass-card p-4 space-y-3 animate-slide-up">
      {/* Question */}
      <div className="flex items-start gap-2">
        <MessageSquareText className="w-4 h-4 text-la-400 mt-0.5 shrink-0" />
        <p className="text-sm font-medium text-gray-200 leading-relaxed">{questionText}</p>
      </div>

      {/* Answer */}
      <div className="relative">
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(questionId, e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          rows={4}
          className={`w-full px-3 py-2.5 bg-surface-100/80 border rounded-xl text-sm text-gray-100 placeholder-gray-500
            resize-y min-h-[80px] transition-all duration-200 outline-none
            ${isEditing ? 'border-la-500/60 ring-2 ring-la-500/20' : 'border-surface-300/40'}`}
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-xs ${wordCount > 120 ? 'text-accent-red' : 'text-gray-500'}`}>
            {wordCount} words
          </span>
          <button
            onClick={() => onRegenerate(questionId)}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 text-xs text-la-400 hover:text-la-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
