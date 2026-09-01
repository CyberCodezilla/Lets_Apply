import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { ProjectEntry } from '../../../src/types';
import TagInput from './TagInput';

interface ProjectFormProps {
  projects: ProjectEntry[];
  onChange: (projects: ProjectEntry[]) => void;
}

const emptyProject: ProjectEntry = {
  title: '',
  techStack: [],
  description: '',
  metricsOrImpact: '',
  repoUrl: '',
  liveUrl: '',
};

export default function ProjectForm({ projects, onChange }: ProjectFormProps) {
  const addProject = () => {
    onChange([...projects, { ...emptyProject }]);
  };

  const removeProject = (index: number) => {
    onChange(projects.filter((_, i) => i !== index));
  };

  const updateProject = (index: number, field: keyof ProjectEntry, value: string | string[]) => {
    const updated = projects.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {projects.map((project, index) => (
        <div key={index} className="glass-card p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <GripVertical className="w-4 h-4" />
              <span className="text-sm font-medium">Project {index + 1}</span>
            </div>
            <button
              type="button"
              onClick={() => removeProject(index)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="la-label">Project Title *</label>
              <input
                type="text"
                value={project.title}
                onChange={(e) => updateProject(index, 'title', e.target.value)}
                placeholder="e.g. AI Resume Screener"
                className="la-input"
              />
            </div>
            <div>
              <label className="la-label">Metrics / Impact</label>
              <input
                type="text"
                value={project.metricsOrImpact || ''}
                onChange={(e) => updateProject(index, 'metricsOrImpact', e.target.value)}
                placeholder="e.g. Reduced screening time by 40%"
                className="la-input"
              />
            </div>
          </div>

          <TagInput
            label="Tech Stack"
            tags={project.techStack}
            onChange={(tags) => updateProject(index, 'techStack', tags)}
            placeholder="e.g. React, Python, TensorFlow"
          />

          <div>
            <label className="la-label">Description *</label>
            <textarea
              value={project.description}
              onChange={(e) => updateProject(index, 'description', e.target.value)}
              placeholder="Brief description of what the project does and your role..."
              className="la-input resize-y min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="la-label">Repository URL</label>
              <input
                type="url"
                value={project.repoUrl || ''}
                onChange={(e) => updateProject(index, 'repoUrl', e.target.value)}
                placeholder="https://github.com/..."
                className="la-input"
              />
            </div>
            <div>
              <label className="la-label">Live URL</label>
              <input
                type="url"
                value={project.liveUrl || ''}
                onChange={(e) => updateProject(index, 'liveUrl', e.target.value)}
                placeholder="https://..."
                className="la-input"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addProject}
        className="w-full py-3 border-2 border-dashed border-surface-400/50 rounded-xl text-gray-400 hover:text-la-400 hover:border-la-500/50 transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Project
      </button>
    </div>
  );
}
