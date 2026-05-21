import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  FileText,
  Flag,
  Inbox,
  ListTodo,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Paperclip,
  RotateCw,
  Tag
} from "lucide-react";
import type { AppState, RepeatFrequency, Task, TaskList, TaskPatch, ViewId } from "@shared/types";

const VIEW_LABELS: Record<string, string> = {
  "my-day": "My Day",
  suggestions: "Suggestions",
  planned: "Planned",
  important: "Important",
  "flagged-email": "Flagged email",
  completed: "Completed"
};

const DEFAULT_COLORS = ["#2563eb", "#0f766e", "#7c3aed", "#dc2626", "#ca8a04", "#16a34a"];

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("list:inbox");
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [quickAdd, setQuickAdd] = useState("");
  const [detailDraft, setDetailDraft] = useState<Partial<Task>>({});
  const [newStep, setNewStep] = useState("");
  const [listDraft, setListDraft] = useState("");
  const [listColor, setListColor] = useState(DEFAULT_COLORS[0]);
  const [suggestedTasks, setSuggestedTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tasks = useMemo(() => state?.tasks ?? [], [state]);

  const load = async () => {
    const next = await window.vnote.getState();
    setState(next);
    setSelectedTaskId((prev) => prev ?? next.tasks[0]?.id);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void window.vnote.refreshSuggestions().then(setSuggestedTasks).catch(() => undefined);
  }, [tasks.length]);

  const lists = state?.lists ?? [];
  const categories = state?.categories ?? [];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const suggestions = useMemo(() => suggestedTasks.filter((task) => !task.completed), [suggestedTasks]);

  useEffect(() => {
    setDetailDraft(selectedTask ?? {});
  }, [selectedTaskId, selectedTask]);

  const visibleTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    switch (activeView) {
      case "suggestions":
        return suggestions;
      case "planned":
        return tasks.filter((task) => Boolean(task.dueDate));
      case "important":
        return tasks.filter((task) => task.important && !task.completed);
      case "completed":
        return tasks.filter((task) => task.completed);
      case "my-day":
        return tasks.filter((task) => task.myDayDate === today);
      default:
        if (activeView.startsWith("list:")) {
          const listId = activeView.slice("list:".length);
          return tasks.filter((task) => task.listId === listId);
        }
        return tasks;
    }
  }, [activeView, tasks, suggestions]);

  const createTask = async () => {
    if (!quickAdd.trim()) return;
    try {
      const targetListId = activeView.startsWith("list:") ? activeView.slice("list:".length) : "inbox";
      const created = await window.vnote.createTask({ title: quickAdd.trim(), listId: targetListId || "inbox" });
      setQuickAdd("");
      setError(null);
      setSelectedTaskId(created.id);
      await load();
    } catch (cause) {
      setError(String(cause));
    }
  };

  const updateTask = async (id: string, patch: TaskPatch) => {
    try {
      await window.vnote.updateTask(id, patch);
      setError(null);
      await load();
    } catch (cause) {
      setError(String(cause));
    }
  };

  const createList = async () => {
    if (!listDraft.trim()) return;
    await window.vnote.createList({ name: listDraft.trim(), color: listColor });
    setListDraft("");
    await load();
  };

  const selectedList = lists.find((list) => list.id === selectedTask?.listId);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <div className="brand-title">VNote</div>
            <div className="brand-subtitle">simple, enough</div>
          </div>
        </div>

        <button className="primary-action" onClick={() => setActiveView("my-day")}>
          <Sparkles size={16} />
          My Day
        </button>

        <nav className="nav-list">
      {Object.keys(VIEW_LABELS).map((id) => (
            <button key={id} className={activeView === id ? "nav-item active" : "nav-item"} onClick={() => setActiveView(id as ViewId)}>
              <span>{VIEW_LABELS[id]}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </nav>

        <section className="sidebar-section">
          <div className="section-title">Lists</div>
          {lists.map((list) => (
            <div key={list.id} className="list-item-wrap">
              <button className={activeView === `list:${list.id}` ? "nav-item active" : "nav-item"} onClick={() => setActiveView(`list:${list.id}`)}>
                <span className="list-dot" style={{ background: list.color }} />
                <span>{list.name}</span>
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  await window.vnote.setListSuggestions(list.id, !list.includeInSuggestions);
                  await load();
                }}
              >
                {list.includeInSuggestions ? "Suggest on" : "Suggest off"}
              </button>
            </div>
          ))}
          <div className="inline-create">
            <input value={listDraft} onChange={(e) => setListDraft(e.target.value)} placeholder="New list" />
            <select value={listColor} onChange={(e) => setListColor(e.target.value)}>
              {DEFAULT_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <button onClick={createList}>
              <Plus size={14} />
            </button>
          </div>
        </section>
      </aside>

      <section className="main-pane">
        <header className="toolbar">
          <div>
            <div className="view-title">{VIEW_LABELS[activeView] ?? "List"}</div>
            <div className="view-meta">{visibleTasks.length} tasks</div>
          </div>
          <div className="toolbar-spacer" />
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="content-grid">
          <div className="task-column">
          {visibleTasks.map((task) => (
            <button key={task.id} className={task.id === selectedTaskId ? "task-row selected" : "task-row"} onClick={() => setSelectedTaskId(task.id)}>
                <span
                  className={task.completed ? "check-ring completed" : "check-ring"}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await updateTask(task.id, { completed: !task.completed });
                  }}
                >
                  {task.completed ? <Check size={12} /> : <Circle size={12} />}
                </span>
                <div className="task-main">
                  <div className="task-title-line">
                    <span className={task.completed ? "task-title done" : "task-title"}>{task.title}</span>
                    {task.important ? <Star size={14} className="accent" /> : null}
                  </div>
                  <div className="task-badges">
                    {task.dueDate ? <span className="badge"><CalendarDays size={12} />{task.dueDate}</span> : null}
                    {task.tags.map((tag) => (
                      <span key={tag} className="badge">
                        <Tag size={12} />
                        {tag}
                      </span>
                    ))}
                    {task.attachments.length ? (
                      <span className="badge">
                        <Paperclip size={12} />
                        {task.attachments.length}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}

            <div className="task-composer">
              <button className="composer-icon" onClick={createTask} aria-label="Add task">
                <Plus size={16} />
              </button>
              <input
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                placeholder="Add a task"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createTask();
                }}
              />
            </div>
          </div>

          <aside className="detail-pane">
            {selectedTask ? (
              <>
                <div className="detail-header">
                  <button className="icon-button" onClick={() => updateTask(selectedTask.id, { important: !selectedTask.important })}>
                    <Star size={16} className={selectedTask.important ? "accent" : ""} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={async () => {
                      const today = new Date().toISOString().slice(0, 10);
                      if (selectedTask.myDayDate === today) {
                        await updateTask(selectedTask.id, { myDayDate: null });
                      } else {
                        await window.vnote.addToMyDay(selectedTask.id, today);
                        await load();
                      }
                    }}
                  >
                    <Sparkles size={16} />
                  </button>
                  <button className="icon-button" onClick={() => updateTask(selectedTask.id, { completed: !selectedTask.completed })}>
                    <Check size={16} />
                  </button>
                  <button className="icon-button" onClick={() => updateTask(selectedTask.id, { repeat: selectedTask.repeat === "none" ? "daily" : "none" })}>
                    <RotateCw size={16} />
                  </button>
                  <button className="icon-button danger" onClick={() => window.vnote.deleteTask(selectedTask.id).then(load)}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <input
                  className="detail-title"
                  value={detailDraft.title ?? ""}
                  onChange={(e) => setDetailDraft((prev) => ({ ...prev, title: e.target.value }))}
                  onBlur={() => updateTask(selectedTask.id, { title: detailDraft.title })}
                />

                <div className="detail-grid">
                  <label>
                    List
                    <select value={detailDraft.listId ?? selectedTask.listId} onChange={(e) => updateTask(selectedTask.id, { listId: e.target.value })}>
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Due
                    <input type="date" value={detailDraft.dueDate ?? selectedTask.dueDate ?? ""} onChange={(e) => updateTask(selectedTask.id, { dueDate: e.target.value || null })} />
                  </label>
                  <label>
                    Reminder
                    <input type="datetime-local" value={detailDraft.reminderAt ?? selectedTask.reminderAt ?? ""} onChange={(e) => updateTask(selectedTask.id, { reminderAt: e.target.value || null })} />
                  </label>
                  <label>
                    Repeat
                    <select value={selectedTask.repeat} onChange={(e) => updateTask(selectedTask.id, { repeat: e.target.value as RepeatFrequency })}>
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                </div>

                <label className="detail-block">
                  Notes
                  <textarea
                    value={detailDraft.notes ?? selectedTask.notes}
                    onChange={(e) => setDetailDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    onBlur={() => updateTask(selectedTask.id, { notes: detailDraft.notes })}
                    rows={5}
                  />
                </label>

                <section className="detail-block">
                  <div className="detail-subtitle">Steps</div>
                  {selectedTask.steps.map((step) => (
                    <button key={step.id} className="step-row" onClick={() => void window.vnote.updateStep(step.id, { completed: !step.completed }).then(load)}>
                      {step.completed ? <Check size={14} /> : <Circle size={14} />}
                      <span>{step.title}</span>
                    </button>
                  ))}
                  <div className="inline-create">
                    <input value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="Add a step" />
                    <button
                      onClick={async () => {
                        if (!newStep.trim()) return;
                        await window.vnote.addStep(selectedTask.id, { title: newStep.trim() });
                        setNewStep("");
                        await load();
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </section>

                <section className="detail-block">
                  <div className="detail-subtitle">Attachments</div>
                  {selectedTask.attachments.map((attachment) => (
                    <button key={attachment.id} className="attachment-row" onClick={() => window.vnote.openAttachment(attachment.id)}>
                      <FileText size={14} />
                      <span>{attachment.name}</span>
                      <span className="muted">{Math.ceil(attachment.size / 1024)} KB</span>
                    </button>
                  ))}
                  <button className="secondary-button" onClick={() => window.vnote.addAttachment(selectedTask.id).then(load)}>
                    <Paperclip size={14} />
                    Attach file
                  </button>
                </section>

                <section className="detail-block">
                  <div className="detail-subtitle">Smart view</div>
                  <div className="meta-line">
                    <span>My Day</span>
                    <button className="text-button" onClick={async () => {
                      const today = new Date().toISOString().slice(0, 10);
                      if (selectedTask.myDayDate === today) {
                        await updateTask(selectedTask.id, { myDayDate: null });
                      } else {
                        await window.vnote.addToMyDay(selectedTask.id, today);
                        await load();
                      }
                    }}>
                      {selectedTask.myDayDate ? "Remove" : "Add"}
                    </button>
                  </div>
                  <div className="meta-line">
                    <span>Suggestions</span>
                    <button className="text-button" onClick={() => window.vnote.refreshSuggestions().then(load)}>
                      Refresh
                    </button>
                  </div>
                </section>

                <section className="detail-block">
                  <div className="detail-subtitle">Meta</div>
                  <div className="meta-line">
                    <span>List</span>
                    <span>{selectedList?.name ?? "-"}</span>
                  </div>
                  <div className="meta-line">
                    <span>Tags</span>
                    <span>{selectedTask.tags.length ? selectedTask.tags.join(", ") : "-"}</span>
                  </div>
                  <div className="meta-line">
                    <span>Categories</span>
                    <span>{categories.find((category) => category.id === selectedTask.categoryId)?.name ?? "-"}</span>
                  </div>
                </section>
              </>
            ) : (
              <div className="empty-state">
                <ListTodo size={30} />
                <p>Select a task to edit its steps, notes, attachments, due date, reminder and repeat settings.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
