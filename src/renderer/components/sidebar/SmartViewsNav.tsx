import { Sparkles, ChevronRight } from 'lucide-react';
import type { ViewId } from '@shared/types';

const VIEW_LABELS: Record<string, string> = {
  'my-day': 'My Day',
  suggestions: 'Suggestions',
  planned: 'Planned',
  important: 'Important',
  'flagged-email': 'Flagged email',
  completed: 'Completed',
};

interface Props {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

export function SmartViewsNav({ activeView, onViewChange }: Props) {
  return (
    <>
      <button className="primary-action" onClick={() => onViewChange('my-day')}>
        <Sparkles size={16} />
        My Day
      </button>

      <nav className="nav-list">
        {Object.keys(VIEW_LABELS).map((id) => (
          <button
            key={id}
            className={activeView === id ? 'nav-item active' : 'nav-item'}
            onClick={() => onViewChange(id as ViewId)}
          >
            <span>{VIEW_LABELS[id]}</span>
            <ChevronRight size={14} />
          </button>
        ))}
      </nav>
    </>
  );
}
