import { useState } from 'react';
import type { Task, TaskList, TaskPatch } from '@shared/types';
import { isTaskUrgent } from '@shared/urgency';

const quadrants = [
  { name: 'Important and urgent', important: true, urgent: true },
  { name: 'Important and not urgent', important: true, urgent: false },
  { name: 'Not important and urgent', important: false, urgent: true },
  { name: 'Not important and not urgent', important: false, urgent: false },
];

interface Props {
  day: string;
  tasks: Task[];
  lists: TaskList[];
  onSelectTask: (task: Task) => void;
  onUpdateTask: (id: string, patch: TaskPatch) => void;
}

export function QuadrantsView({ day, tasks, lists, onSelectTask, onUpdateTask }: Props) {
  const [filter, setFilter] = useState('');
  const listId = lists.some((list) => list.id === filter) ? filter : '';
  const visible = listId ? tasks.filter((task) => task.listId === listId) : tasks;

  return (
    <section className="quadrant-board" aria-label="Priority board">
      <label className="quadrant-filter">
        Filter by list
        <select value={listId} onChange={(event) => setFilter(event.target.value)}>
          <option value="">All lists</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </label>
      <div className="quadrant-grid">
        {quadrants.map((quadrant) => {
          const items = visible.filter(
            (task) =>
              task.important === quadrant.important && isTaskUrgent(task, day) === quadrant.urgent,
          );
          return (
            <section key={quadrant.name} className="quadrant" aria-label={quadrant.name}>
              <h3>
                {quadrant.name} <span>{items.length}</span>
              </h3>
              {items.map((task) => (
                <div key={task.id} className="quadrant-card">
                  <button className="quadrant-title" onClick={() => onSelectTask(task)}>
                    {task.title}
                  </button>
                  <div className="quadrant-meta">
                    {lists.find((list) => list.id === task.listId)?.name}
                    {task.dueDate && <time dateTime={task.dueDate}>Due {task.dueDate}</time>}
                  </div>
                  <div className="quadrant-actions">
                    <select
                      aria-label={`Move ${task.title}`}
                      value=""
                      onChange={(event) => {
                        const target = quadrants.find((item) => item.name === event.target.value);
                        if (target)
                          onUpdateTask(task.id, {
                            important: target.important,
                            urgencyOverride: target.urgent ? 'urgent' : 'not-urgent',
                          });
                      }}
                    >
                      <option value="" disabled>
                        Move to…
                      </option>
                      {quadrants
                        .filter((item) => item !== quadrant)
                        .map((item) => (
                          <option key={item.name} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                    {task.urgencyOverride && (
                      <button
                        className="text-button"
                        onClick={() => onUpdateTask(task.id, { urgencyOverride: null })}
                      >
                        Restore automatic urgency
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}
