import { Circle, Check, Star, CalendarDays, Tag, Paperclip, Clock } from 'lucide-react';
import type { Task } from '@shared/types';

interface Props {
  task: Task;
  isSelected: boolean;
  onSelect: (task: Task) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
}

function formatCompletedAt(iso: string): string {
  const date = new Date(iso);
  const d = date.toLocaleDateString();
  const t = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${d} ${t}`;
}

/** A single row in the task list showing title, badges, and completion state. */
export function TaskRow({ task, isSelected, onSelect, onToggleComplete }: Props) {
  return (
    <button
      className={isSelected ? 'task-row selected' : 'task-row'}
      onClick={() => onSelect(task)}
    >
      <span
        className={task.completed ? 'check-ring completed' : 'check-ring'}
        onClick={async (e) => {
          e.stopPropagation();
          onToggleComplete(task.id, !task.completed);
        }}
        role="checkbox"
        aria-checked={task.completed}
        tabIndex={0}
      >
        {task.completed ? <Check size={12} /> : <Circle size={12} />}
      </span>

      <div className="task-main">
        <div className="task-title-line">
          <span className={task.completed ? 'task-title done' : 'task-title'}>{task.title}</span>
          {task.important ? <Star size={14} className="accent" /> : null}
        </div>

        <div className="task-badges">
          {task.completedAt ? (
            <span className="badge badge-completed">
              <Clock size={12} />
              {formatCompletedAt(task.completedAt)}
            </span>
          ) : null}
          {task.dueDate ? (
            <span className="badge">
              <CalendarDays size={12} />
              {task.dueDate}
            </span>
          ) : null}
          {task.tags.map((tag) => (
            <span key={tag} className="badge">
              <Tag size={12} />
              {tag}
            </span>
          ))}
          {task.attachments.length > 0 ? (
            <span className="badge">
              <Paperclip size={12} />
              {task.attachments.length}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
