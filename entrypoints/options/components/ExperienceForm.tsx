import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { ExperienceEntry } from '../../../src/types';

interface ExperienceFormProps {
  experiences: ExperienceEntry[];
  onChange: (experiences: ExperienceEntry[]) => void;
}

const emptyExperience: ExperienceEntry = {
  role: '',
  company: '',
  duration: '',
  contributions: '',
};

export default function ExperienceForm({ experiences, onChange }: ExperienceFormProps) {
  const addExperience = () => {
    onChange([...experiences, { ...emptyExperience }]);
  };

  const removeExperience = (index: number) => {
    onChange(experiences.filter((_, i) => i !== index));
  };

  const updateExperience = (index: number, field: keyof ExperienceEntry, value: string) => {
    const updated = experiences.map((exp, i) =>
      i === index ? { ...exp, [field]: value } : exp
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {experiences.map((exp, index) => (
        <div key={index} className="glass-card p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <GripVertical className="w-4 h-4" />
              <span className="text-sm font-medium">Experience {index + 1}</span>
            </div>
            <button
              type="button"
              onClick={() => removeExperience(index)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="la-label">Role / Title *</label>
              <input
                type="text"
                value={exp.role}
                onChange={(e) => updateExperience(index, 'role', e.target.value)}
                placeholder="e.g. Frontend Developer Intern"
                className="la-input"
              />
            </div>
            <div>
              <label className="la-label">Company *</label>
              <input
                type="text"
                value={exp.company}
                onChange={(e) => updateExperience(index, 'company', e.target.value)}
                placeholder="e.g. TechCorp Inc."
                className="la-input"
              />
            </div>
          </div>

          <div>
            <label className="la-label">Duration</label>
            <input
              type="text"
              value={exp.duration}
              onChange={(e) => updateExperience(index, 'duration', e.target.value)}
              placeholder="e.g. Jun 2024 – Aug 2024 (3 months)"
              className="la-input"
            />
          </div>

          <div>
            <label className="la-label">Key Contributions *</label>
            <textarea
              value={exp.contributions}
              onChange={(e) => updateExperience(index, 'contributions', e.target.value)}
              placeholder="Describe your key contributions, metrics, and impact..."
              className="la-input resize-y min-h-[80px]"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addExperience}
        className="w-full py-3 border-2 border-dashed border-surface-400/50 rounded-xl text-gray-400 hover:text-la-400 hover:border-la-500/50 transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Experience
      </button>
    </div>
  );
}
