import { Wand2, SkipForward, Loader2 } from 'lucide-react';

interface ActionFooterProps {
  onAutoFill: () => void;
  onSkip: () => void;
  isFillingForm: boolean;
  disabled?: boolean;
}

export default function ActionFooter({ onAutoFill, onSkip, isFillingForm, disabled = false }: ActionFooterProps) {
  return (
    <div className="sticky bottom-0 bg-surface/90 backdrop-blur-xl border-t border-surface-300/30 p-4 -mx-4 -mb-4 mt-6">
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          disabled={disabled || isFillingForm}
          className="la-btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          <SkipForward className="w-4 h-4" />
          Skip
        </button>
        <button
          onClick={onAutoFill}
          disabled={disabled || isFillingForm}
          className="la-btn flex-[2] flex items-center justify-center gap-2"
        >
          {isFillingForm ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Filling Form...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Auto-Fill Form
            </>
          )}
        </button>
      </div>
    </div>
  );
}
