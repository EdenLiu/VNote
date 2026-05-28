import type { Task, TaskList as TaskListType } from '@shared/types';
import { TaskRow } from './TaskRow';
import { QuickAddBar } from './QuickAddBar';

interface Props {
  tasks: Task[];
  selectedTaskId: string | undefined;
  quickAddListId: string;
  lists: TaskListType[];
  activeView: string;
  onSelectTask: (task: Task) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onCreateTask: (title: string) => Promise<unknown>;
}

function groupByList(tasks: Task[], lists: TaskListType[]) {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const g = groups.get(t.listId) || [];
    g.push(t);
    groups.set(t.listId, g);
  }
  return Array.from(groups.entries())
    .map(([listId, items]) => ({
      listId,
      listName: lists.find((l) => l.id === listId)?.name ?? 'Unknown list',
      listColor: lists.find((l) => l.id === listId)?.color ?? '#94a3b8',
      items: items.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    }))
    .sort((a, b) => a.listName.localeCompare(b.listName));
}

/** The main task column: scrollable task rows + quick-add bar at the bottom. */
export function TaskList({
  tasks,
  selectedTaskId,
  quickAddListId,
  lists,
  activeView,
  onSelectTask,
  onToggleComplete,
  onCreateTask,
}: Props) {
  const isCompletedView = activeView === 'completed';
  const groups = isCompletedView ? groupByList(tasks, lists) : null;

  return (
    <div className="task-column">
      {groups
        ? groups.map((group) => (
            <div key={group.listId} className="task-group">
              <div className="task-group-header" style={{ borderLeftColor: group.listColor }}>
                <span
                  className="task-group-dot"
                  style={{ backgroundColor: group.listColor }}
                />
                {group.listName}
                <span className="task-group-count">{group.items.length}</span>
              </div>
              {group.items.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={onSelectTask}
                  onToggleComplete={onToggleComplete}
                />
              ))}
            </div>
          ))
        : tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isSelected={task.id === selectedTaskId}
              onSelect={onSelectTask}
              onToggleComplete={onToggleComplete}
            />
          ))}

      {!isCompletedView && <QuickAddBar listId={quickAddListId} onCreate={onCreateTask} />}
    </div>
  );
}
