import { useState } from 'react';
import { RefreshCw, MessageSquareText, CheckCircle2 } from 'lucide-react';
import type { ScreeningQuestion } from '../../../src/types';

interface AnswerCardProps {
  questionId: string;
  questionText: string;
  inputType?: ScreeningQuestion['inputType'];
  options?: string[];
  answer: string;
  onAnswerChange: (id: string, answer: string) => void;
  onRegenerate: (id: string) => void;
  isRegenerating?: boolean;
}

export default function AnswerCard({
  questionId,
  questionText,
  inputType = 'textarea',
  options = [],
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

      {/* Answer Body based on inputType */}
      {inputType === 'radio' && options.length > 0 ? (
        <div className="space-y-2 pt-1">
          {options.map((opt, idx) => {
            const isSelected = answer.trim().toLowerCase() === opt.trim().toLowerCase();
            return (
              <label
                key={idx}
                onClick={() => onAnswerChange(questionId, opt)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-la-600/20 border-la-500/80 text-white shadow-sm'
                    : 'bg-surface-100/40 border-surface-300/30 text-gray-300 hover:bg-surface-100/70'
                }`}
              >
                <input
                  type="radio"
                  name={`answer_radio_${questionId}`}
                  checked={isSelected}
                  onChange={() => onAnswerChange(questionId, opt)}
                  className="w-4 h-4 text-la-500 focus:ring-la-500 border-surface-300 bg-surface-100"
                />
                <span className="text-sm flex-1">{opt}</span>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-accent-green shrink-0" />}
              </label>
            );
          })}
          <div className="flex justify-end pt-1">
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
      ) : inputType === 'select' && options.length > 0 ? (
        <div className="space-y-2">
          <select
            value={answer}
            onChange={(e) => onAnswerChange(questionId, e.target.value)}
            className="la-input w-full cursor-pointer"
          >
            <option value="">-- Select option --</option>
            {options.map((opt, idx) => (
              <option key={idx} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <div className="flex justify-end pt-1">
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
      ) : (
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
      )}
    </div>
  );
}
