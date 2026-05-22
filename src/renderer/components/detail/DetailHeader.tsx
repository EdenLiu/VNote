import { Star, Sparkles, Check, RotateCw, Trash2 } from "lucide-react";
import type { Task } from "@shared/types";

interface Props {
  task: Task;
  /** Whether the task is in today's My Day. */
  inMyDay: boolean;
  onToggleImportant: () => void;
  onToggleMyDay: () => void;
  onToggleComplete: () => void;
  onToggleRepeat: () => void;
  onDelete: () => void;
}

/** Action buttons row at the top of the detail pane. */
export function DetailHeader({ task, inMyDay, onToggleImportant, onToggleMyDay, onToggleComplete, onToggleRepeat, onDelete }: Props) {
  return (
    <div className="detail-header">
      <button className="icon-button" onClick={onToggleImportant} title={task.important ? "Remove importance" : "Mark as important"}>
        <Star size={16} className={task.important ? "accent" : ""} />
      </button>
      <button className="icon-button" onClick={onToggleMyDay} title={inMyDay ? "Remove from My Day" : "Add to My Day"}>
        <Sparkles size={16} className={inMyDay ? "accent" : ""} />
      </button>
      <button className="icon-button" onClick={onToggleComplete} title={task.completed ? "Mark incomplete" : "Mark complete"}>
        <Check size={16} />
      </button>
      <button className="icon-button" onClick={onToggleRepeat} title={task.repeat === "none" ? "Set daily repeat" : "Remove repeat"}>
        <RotateCw size={16} className={task.repeat !== "none" ? "accent" : ""} />
      </button>
      <button className="icon-button danger" onClick={onDelete} title="Delete task">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
