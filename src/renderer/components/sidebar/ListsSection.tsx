import { useState } from 'react';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import type { TaskList, ViewId } from '@shared/types';

const DEFAULT_COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#dc2626', '#ca8a04', '#16a34a'];

interface Props {
  lists: TaskList[];
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  onCreateList: (name: string, color: string) => Promise<unknown>;
  onUpdateList: (
    id: string,
    patch: { name?: string; color?: string; includeInSuggestions?: boolean },
  ) => Promise<unknown>;
  onDeleteList: (id: string) => Promise<unknown>;
  onToggleSuggestions: (listId: string, enabled: boolean) => Promise<unknown>;
}

export function ListsSection({
  lists,
  activeView,
  onViewChange,
  onCreateList,
  onUpdateList,
  onDeleteList,
  onToggleSuggestions,
}: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await onCreateList(name.trim(), color);
    setName('');
    setColor(DEFAULT_COLORS[0]);
  };

  const startEdit = (list: TaskList) => {
    setEditingId(list.id);
    setEditName(list.name);
  };

  const commitEdit = async (id: string) => {
    if (editName.trim()) {
      await onUpdateList(id, { name: editName.trim() });
    }
    setEditingId(null);
    setEditName('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <section className="sidebar-section">
      <div className="section-title">Lists</div>

      {lists.map((list) => (
        <div key={list.id} className="list-item-wrap">
          <button
            className={activeView === `list:${list.id}` ? 'nav-item active' : 'nav-item'}
            onClick={() => onViewChange(`list:${list.id}`)}
          >
            {editingId === list.id ? (
              <input
                className="inline-edit-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitEdit(list.id);
                  if (e.key === 'Escape') cancelEdit();
                }}
                onBlur={() => commitEdit(list.id)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="list-dot" style={{ background: list.color }} />
                <span>{list.name}</span>
              </>
            )}
          </button>

          {editingId === list.id ? (
            <div className="inline-actions">
              <button
                className="icon-button-small"
                onClick={() => commitEdit(list.id)}
                title="Save"
              >
                <Check size={14} />
              </button>
              <button className="icon-button-small" onClick={cancelEdit} title="Cancel">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="inline-actions">
              <button className="text-button" onClick={() => startEdit(list)} title="Rename list">
                <Pencil size={12} />
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  await onToggleSuggestions(list.id, !list.includeInSuggestions);
                }}
              >
                {list.includeInSuggestions ? 'On' : 'Off'}
              </button>
              <button
                className="text-button danger"
                onClick={async () => {
                  if (confirm(`Delete list "${list.name}"? Tasks will be moved to Inbox.`)) {
                    await onDeleteList(list.id);
                  }
                }}
                title="Delete list"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="inline-create">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New list"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate();
          }}
        />
        <select value={color} onChange={(e) => setColor(e.target.value)}>
          {DEFAULT_COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button onClick={handleCreate} aria-label="Create list">
          <Plus size={14} />
        </button>
      </div>
    </section>
  );
}
