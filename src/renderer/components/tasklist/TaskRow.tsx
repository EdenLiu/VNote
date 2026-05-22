import { Circle, Check, Star, CalendarDays, Tag, Paperclip } from 'lucide-react';
import type { Task } from '@shared/types';

interface Props {
  task: Task;
  isSelected: boolean;
  onSelect: (task: Task) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
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
