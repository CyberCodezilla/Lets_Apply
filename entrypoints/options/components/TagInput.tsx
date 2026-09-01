import { useState, useCallback } from 'react';
import { X, Plus } from 'lucide-react';

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ label, tags, onChange, placeholder = 'Type and press Enter' }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = useCallback(() => {
    const value = inputValue.trim();
    if (value && !tags.includes(value)) {
      onChange([...tags, value]);
      setInputValue('');
    }
  }, [inputValue, tags, onChange]);

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
      if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    },
    [addTag, inputValue, tags, removeTag]
  );

  return (
    <div>
      <label className="la-label">{label}</label>
      <div className="flex flex-wrap gap-2 p-3 bg-surface-100 border border-surface-300/60 rounded-xl focus-within:ring-2 focus-within:ring-la-500/40 focus-within:border-la-500/60 transition-all duration-200">
        {tags.map((tag, index) => (
          <span key={index} className="la-chip group">
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="text-la-400 hover:text-white transition-colors ml-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 flex-1 min-w-[120px]">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 outline-none text-sm py-0.5"
          />
          {inputValue.trim() && (
            <button
              type="button"
              onClick={addTag}
              className="p-1 rounded-md hover:bg-la-600/20 text-la-400 hover:text-la-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
