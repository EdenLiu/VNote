import { useState } from 'react';
import { Plus, Circle, Check } from 'lucide-react';
import type { Step } from '@shared/types';

interface Props {
  steps: Step[];
  onAdd: (title: string) => Promise<unknown>;
  onToggle: (stepId: string, completed: boolean) => Promise<unknown>;
  onDelete: (stepId: string) => Promise<unknown>;
}

/** Sub-task checklist for a task. */
export function StepsSection({ steps, onAdd, onToggle, onDelete: _onDelete }: Props) {
  const [value, setValue] = useState('');

  const handleAdd = async () => {
    if (!value.trim()) return;
    await onAdd(value.trim());
    setValue('');
  };

  return (
    <section className="detail-block">
      <div className="detail-subtitle">Steps</div>

      {steps.map((step) => (
        <button
          key={step.id}
          className="step-row"
          onClick={() => onToggle(step.id, !step.completed)}
        >
          {step.completed ? <Check size={14} /> : <Circle size={14} />}
          <span
            style={
              step.completed ? { textDecoration: 'line-through', color: '#64748b' } : undefined
            }
          >
            {step.title}
          </span>
        </button>
      ))}

      <div className="inline-create">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a step"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAdd();
          }}
        />
        <button onClick={handleAdd} aria-label="Add step">
          <Plus size={14} />
        </button>
      </div>
    </section>
  );
}
