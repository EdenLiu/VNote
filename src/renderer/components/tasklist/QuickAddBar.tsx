import { useState } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  /** The target list ID for new tasks. */
  listId: string;
  onCreate: (title: string) => Promise<unknown>;
}

/** Bottom input bar for quickly adding a new task. */
export function QuickAddBar({ listId: _listId, onCreate }: Props) {
  const [value, setValue] = useState('');

  const handleCreate = async () => {
    if (!value.trim()) return;
    await onCreate(value.trim());
    setValue('');
  };

  return (
    <div className="task-composer">
      <button className="composer-icon" onClick={handleCreate} aria-label="Add task">
        <Plus size={16} />
      </button>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a task"
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleCreate();
        }}
      />
    </div>
  );
}
