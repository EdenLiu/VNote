import type { Task } from "@shared/types";
import { TaskRow } from "./TaskRow";
import { QuickAddBar } from "./QuickAddBar";

interface Props {
  tasks: Task[];
  selectedTaskId: string | undefined;
  quickAddListId: string;
  onSelectTask: (task: Task) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onCreateTask: (title: string) => Promise<unknown>;
}

/** The main task column: scrollable task rows + quick-add bar at the bottom. */
export function TaskList({ tasks, selectedTaskId, quickAddListId, onSelectTask, onToggleComplete, onCreateTask }: Props) {
  return (
    <div className="task-column">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          isSelected={task.id === selectedTaskId}
          onSelect={onSelectTask}
          onToggleComplete={onToggleComplete}
        />
      ))}

      <QuickAddBar listId={quickAddListId} onCreate={onCreateTask} />
    </div>
  );
}
