import type { Task, TaskList, Category, RepeatFrequency } from "@shared/types";

interface Props {
  task: Task;
  lists: TaskList[];
  categories: Category[];
  onChange: (patch: {
    listId?: string;
    dueDate?: string | null;
    reminderAt?: string | null;
    repeat?: RepeatFrequency;
    categoryId?: string | null;
  }) => void;
}

/** Grid of dropdown/date inputs for list, due date, reminder, repeat, and category. */
export function DetailFields({ task, lists, categories, onChange }: Props) {
  return (
    <div className="detail-grid">
      <label>
        List
        <select value={task.listId} onChange={(e) => onChange({ listId: e.target.value })}>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>{list.name}</option>
          ))}
        </select>
      </label>

      <label>
        Due
        <input
          type="date"
          value={task.dueDate ?? ""}
          onChange={(e) => onChange({ dueDate: e.target.value || null })}
        />
      </label>

      <label>
        Reminder
        <input
          type="datetime-local"
          value={task.reminderAt ?? ""}
          onChange={(e) => onChange({ reminderAt: e.target.value || null })}
        />
      </label>

      <label>
        Repeat
        <select value={task.repeat} onChange={(e) => onChange({ repeat: e.target.value as RepeatFrequency })}>
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>

      <label>
        Category
        <select
          value={task.categoryId ?? ""}
          onChange={(e) => onChange({ categoryId: e.target.value || null })}
        >
          <option value="">None</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
