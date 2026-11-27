import type { Task } from '@shared/types';
import { GanttPlanBar } from './GanttPlanBar';

const DAY_MS = 86_400_000;
const dayNumber = (date?: string) => (date ? Date.parse(date) / DAY_MS : NaN);

interface Props {
  tasks: Task[];
  listName: string;
  onSelectTask: (task: Task) => void;
  onMovePlan: (taskId: string, days: number) => void;
}

export function GanttView({ tasks, listName, onSelectTask, onMovePlan }: Props) {
  const dates = tasks.flatMap((task) =>
    [task.plannedStartDate, task.plannedEndDate, task.dueDate]
      .map(dayNumber)
      .filter(Number.isFinite),
  );
  const earliest = dates.reduce((min, date) => Math.min(min, date), Infinity);
  const latest = dates.reduce((max, date) => Math.max(max, date), -Infinity);
  const dateSpan = dates.length ? latest - earliest + 1 : 0;
  const days = dateSpan ? Math.max(7, dateSpan) : 0;
  const first = earliest - Math.floor((days - dateSpan) / 2);
  const last = first + days - 1;
  // Keep long-running projects scrollable without mounting a label for every calendar day.
  const step = Math.max(1, Math.ceil(days / 60));
  const ticks = Array.from({ length: Math.ceil(days / step) }, (_, n) => first + n * step);
  // A one-day plan still needs a usable target when the project spans years.
  const trackWidth = Math.max(days * 8, ticks.length * (days > 365 ? 88 : 58));
  const tickFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(days > 365 ? { year: 'numeric' } : {}),
  });
  const percent = (width: number) => `${(100 * width) / days}%`;
  const scheduled = tasks.filter(
    (task) => task.plannedStartDate || task.plannedEndDate || task.dueDate,
  );
  const unscheduled = tasks.filter(
    (task) => !task.plannedStartDate && !task.plannedEndDate && !task.dueDate,
  );

  return (
    <section className="gantt" aria-label={`${listName} schedule`}>
      {days > 0 && (
        <div className="gantt-scroll">
          <div style={{ minWidth: 155 + trackWidth }}>
            <div className="gantt-row gantt-header">
              <span className="gantt-name">Task</span>
              <div className="gantt-track">
                {ticks.map((day) => (
                  <time
                    key={day}
                    dateTime={new Date(day * DAY_MS).toISOString().slice(0, 10)}
                    style={{
                      left: percent(day - first),
                      width: percent(Math.min(step, last - day + 1)),
                    }}
                  >
                    {tickFormat.format(day * DAY_MS)}
                  </time>
                ))}
              </div>
            </div>
            {scheduled.map((task) => {
              const start = dayNumber(task.plannedStartDate);
              const end = dayNumber(task.plannedEndDate);
              const due = dayNumber(task.dueDate);
              const planLabel = `${task.title} plan ${task.plannedStartDate} to ${task.plannedEndDate}`;
              const dueLabel = `${task.title} due ${task.dueDate}`;
              return (
                <div className="gantt-row" key={task.id}>
                  <div className="gantt-name">
                    <button onClick={() => onSelectTask(task)}>{task.title}</button>
                    {task.plannedStartDate && !task.plannedEndDate && (
                      <small>Starts {task.plannedStartDate}</small>
                    )}
                    {task.plannedEndDate && !task.plannedStartDate && (
                      <small>Ends {task.plannedEndDate}</small>
                    )}
                    {start > end && <small className="gantt-warning">Plan ends before start</small>}
                    {end > due && <small className="gantt-warning">Plan ends after due date</small>}
                  </div>
                  <div className="gantt-track" style={{ backgroundSize: `${percent(step)} 100%` }}>
                    {start <= end && (
                      <GanttPlanBar
                        label={planLabel}
                        chartDays={days}
                        style={{ left: percent(start - first), width: percent(end - start + 1) }}
                        onOpen={() => onSelectTask(task)}
                        onMove={(delta) => onMovePlan(task.id, delta)}
                      />
                    )}
                    {Number.isFinite(due) && (
                      <button
                        className="gantt-due"
                        aria-label={dueLabel}
                        title={dueLabel}
                        style={{ left: percent(due - first + 0.5) }}
                        onClick={() => onSelectTask(task)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="gantt-legend">
            <span>Plan</span>
            <span>Due</span>
          </div>
        </div>
      )}
      {unscheduled.length > 0 && (
        <section className="gantt-unscheduled" aria-label="Unscheduled">
          <h3>Unscheduled</h3>
          <ul>
            {unscheduled.map((task) => (
              <li key={task.id}>
                <button onClick={() => onSelectTask(task)}>{task.title}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tasks.length === 0 && <p>No tasks in this list.</p>}
    </section>
  );
}
