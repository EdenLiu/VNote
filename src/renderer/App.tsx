import { useEffect, useMemo, useState } from 'react';
import { ListTodo } from 'lucide-react';
import type { Task, TaskPatch, ViewId } from '@shared/types';
import { useVNote } from './hooks/useVNote';
import { Sidebar } from './components/sidebar/Sidebar';
import { BrandHeader } from './components/sidebar/BrandHeader';
import { SmartViewsNav } from './components/sidebar/SmartViewsNav';
import { ListsSection } from './components/sidebar/ListsSection';
import { TaskList } from './components/tasklist/TaskList';
import { DetailPane } from './components/detail/DetailPane';
import { DetailHeader } from './components/detail/DetailHeader';
import { DetailTitle } from './components/detail/DetailTitle';
import { DetailFields } from './components/detail/DetailFields';
import { NotesSection } from './components/detail/NotesSection';
import { StepsSection } from './components/detail/StepsSection';
import { AttachmentsSection } from './components/detail/AttachmentsSection';
import { MetaSection } from './components/detail/MetaSection';
import { EmptyState } from './components/common/EmptyState';
import { ErrorBanner } from './components/common/ErrorBanner';

const VIEW_LABELS: Record<string, string> = {
  'my-day': 'My Day',
  suggestions: 'Suggestions',
  planned: 'Planned',
  important: 'Important',
  'flagged-email': 'Flagged email',
  completed: 'Completed',
};

const today = () => new Date().toISOString().slice(0, 10);

export function App() {
  const {
    lists,
    categories,
    tasks,
    suggestions,
    error,
    setError,
    createTask,
    updateTask,
    deleteTask,
    createList,
    updateList,
    deleteList,
    addStep,
    updateStep,
    toggleSuggestions,
    addToMyDay,
    addAttachment,
  } = useVNote();

  const [activeView, setActiveView] = useState<ViewId>('list:inbox');
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [detailDraft, setDetailDraft] = useState<Partial<Task>>({});

  // Derive the selected task
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId],
  );

  // Sync detail draft when selection changes
  useEffect(() => {
    setDetailDraft(selectedTask ?? {}); // eslint-disable-line react-hooks/set-state-in-effect -- resetting editing state on selection change
  }, [selectedTask]);

  // Compute visible tasks based on active view
  const visibleTasks = useMemo(() => {
    const todayKey = today();
    switch (activeView) {
      case 'suggestions':
        return suggestions;
      case 'planned':
        return tasks.filter((t) => Boolean(t.dueDate));
      case 'important':
        return tasks.filter((t) => t.important && !t.completed);
      case 'completed':
        return tasks
          .filter((t) => t.completed)
          .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
      case 'my-day':
        return tasks.filter((t) => t.myDayDate === todayKey);
      default:
        if (activeView.startsWith('list:')) {
          const listId = activeView.slice('list:'.length);
          return tasks.filter((t) => t.listId === listId);
        }
        return tasks;
    }
  }, [activeView, tasks, suggestions]);

  // Get the target list ID for quick-add
  const quickAddListId = useMemo(() => {
    if (activeView.startsWith('list:')) return activeView.slice('list:'.length);
    return lists[0]?.id ?? 'inbox';
  }, [activeView, lists]);

  // Handlers
  const handleCreateTask = async (title: string) => {
    const created = await createTask({ title, listId: quickAddListId });
    if (created) setSelectedTaskId(created.id);
    return created;
  };

  const handleUpdateTask = (id: string, patch: TaskPatch) => updateTask(id, patch);

  const handleSelectTask = (task: Task) => setSelectedTaskId(task.id);

  const handleToggleComplete = (id: string, completed: boolean) => updateTask(id, { completed });

  const todayKey = today();

  return (
    <div className="layout">
      {/* ===== SIDEBAR ===== */}
      <Sidebar>
        <BrandHeader />
        <SmartViewsNav activeView={activeView} onViewChange={setActiveView} />
        <ListsSection
          lists={lists}
          activeView={activeView}
          onViewChange={setActiveView}
          onCreateList={(name, color) => createList(name, color)}
          onUpdateList={(id, patch) => updateList(id, patch)}
          onDeleteList={(id) => deleteList(id)}
          onToggleSuggestions={(listId, enabled) => toggleSuggestions(listId, enabled)}
        />
      </Sidebar>

      {/* ===== MAIN PANE ===== */}
      <section className="main-pane">
        {/* Toolbar */}
        <header className="toolbar">
          <div>
            <div className="view-title">
              {VIEW_LABELS[activeView] ??
                lists.find((l) => `list:${l.id}` === activeView)?.name ??
                'List'}
            </div>
            <div className="view-meta">{visibleTasks.length} tasks</div>
          </div>
          <div className="toolbar-spacer" />
        </header>

        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

        <div className="content-grid">
          <TaskList
            tasks={visibleTasks}
            selectedTaskId={selectedTaskId}
            quickAddListId={quickAddListId}
            lists={lists}
            activeView={activeView}
            onSelectTask={handleSelectTask}
            onToggleComplete={handleToggleComplete}
            onCreateTask={handleCreateTask}
          />

          {/* ===== DETAIL PANE ===== */}
          <DetailPane>
            {selectedTask ? (
              <>
                <DetailHeader
                  task={selectedTask}
                  inMyDay={selectedTask.myDayDate === todayKey}
                  onToggleImportant={() =>
                    handleUpdateTask(selectedTask.id, { important: !selectedTask.important })
                  }
                  onToggleMyDay={() =>
                    selectedTask.myDayDate === todayKey
                      ? handleUpdateTask(selectedTask.id, { myDayDate: null })
                      : addToMyDay(selectedTask.id, todayKey)
                  }
                  onToggleComplete={() =>
                    handleUpdateTask(selectedTask.id, { completed: !selectedTask.completed })
                  }
                  onToggleRepeat={() =>
                    handleUpdateTask(selectedTask.id, {
                      repeat: selectedTask.repeat === 'none' ? 'daily' : 'none',
                    })
                  }
                  onDelete={() => {
                    void deleteTask(selectedTask.id);
                    setSelectedTaskId(undefined);
                  }}
                />

                <DetailTitle
                  value={detailDraft.title ?? selectedTask.title}
                  onChange={(title) => setDetailDraft((prev) => ({ ...prev, title }))}
                  onSave={() => {
                    if (detailDraft.title !== selectedTask.title) {
                      void handleUpdateTask(selectedTask.id, { title: detailDraft.title });
                    }
                  }}
                />

                <DetailFields
                  task={selectedTask}
                  lists={lists}
                  categories={categories}
                  onChange={(patch) => handleUpdateTask(selectedTask.id, patch)}
                />

                <NotesSection
                  value={detailDraft.notes ?? selectedTask.notes}
                  onChange={(notes) => setDetailDraft((prev) => ({ ...prev, notes }))}
                  onSave={() => {
                    if (detailDraft.notes !== selectedTask.notes) {
                      void handleUpdateTask(selectedTask.id, { notes: detailDraft.notes });
                    }
                  }}
                />

                <StepsSection
                  steps={selectedTask.steps}
                  onAdd={(title) => addStep(selectedTask.id, title)}
                  onToggle={(stepId, completed) => updateStep(stepId, { completed })}
                  onDelete={() => Promise.resolve()}
                />

                <AttachmentsSection
                  attachments={selectedTask.attachments}
                  onAdd={() => addAttachment(selectedTask.id)}
                  onOpen={(id) => window.vnote.openAttachment(id)}
                  onRemove={(id) => {
                    void window.vnote.removeAttachment(id);
                    return Promise.resolve();
                  }}
                />

                <MetaSection
                  task={selectedTask}
                  list={lists.find((l) => l.id === selectedTask.listId)}
                  categories={categories}
                  inMyDay={selectedTask.myDayDate === todayKey}
                  onAddToMyDay={() => addToMyDay(selectedTask.id, todayKey)}
                  onRemoveFromMyDay={() => handleUpdateTask(selectedTask.id, { myDayDate: null })}
                  onTagsChange={(tags) => handleUpdateTask(selectedTask.id, { tags })}
                />
              </>
            ) : (
              <EmptyState icon={<ListTodo size={30} />}>
                Select a task to edit its steps, notes, attachments, due date, reminder and repeat
                settings.
              </EmptyState>
            )}
          </DetailPane>
        </div>
      </section>
    </div>
  );
}
