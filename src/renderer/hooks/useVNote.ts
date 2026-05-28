import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppState, Task, TaskDraft, TaskPatch } from '@shared/types';

/**
 * Central state hook for VNote. Manages the full AppState, provides memoized
 * derived data, and wraps every API call with load-on-success + error handling.
 */
export function useVNote() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestedTasks, setSuggestedTasks] = useState<Task[]>([]);

  /** Reload full state from the main process. */
  const load = useCallback(async () => {
    const next = await window.vnote.getState();
    setState(next);
  }, []);

  /** Refresh suggestion list (called after mutations). */
  const refreshSuggestions = useCallback(async () => {
    const tasks = await window.vnote.refreshSuggestions();
    setSuggestedTasks(tasks);
  }, []);

  // Initial load — effect is the correct pattern for IPC data fetching
  useEffect(() => {
    void load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  // Keep suggestions in sync
  const taskCount = state?.tasks.length ?? 0;
  useEffect(() => {
    void refreshSuggestions().catch(() => undefined); // eslint-disable-line react-hooks/set-state-in-effect -- syncing suggestions from IPC
  }, [taskCount, refreshSuggestions]);

  /** Wrap an async API call with error handling and auto-reload on success. */
  const withError = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        const result = await fn();
        setError(null);
        await load();
        await refreshSuggestions();
        return result;
      } catch (cause) {
        setError(String(cause));
        return undefined;
      }
    },
    [load, refreshSuggestions],
  );

  const createTask = useCallback(
    (draft: TaskDraft) => withError(() => window.vnote.createTask(draft)),
    [withError],
  );

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => withError(() => window.vnote.updateTask(id, patch)),
    [withError],
  );

  const deleteTask = useCallback(
    (id: string) => withError(() => window.vnote.deleteTask(id)),
    [withError],
  );

  const createList = useCallback(
    (name: string, color: string) => withError(() => window.vnote.createList({ name, color })),
    [withError],
  );

  const updateList = useCallback(
    (id: string, patch: { name?: string; color?: string; includeInSuggestions?: boolean }) =>
      withError(() => window.vnote.updateList(id, patch)),
    [withError],
  );

  const deleteList = useCallback(
    (id: string) => withError(() => window.vnote.deleteList(id)),
    [withError],
  );

  const addStep = useCallback(
    (taskId: string, title: string) => withError(() => window.vnote.addStep(taskId, { title })),
    [withError],
  );

  const updateStep = useCallback(
    (id: string, patch: { title?: string; completed?: boolean; sortOrder?: number }) =>
      withError(() => window.vnote.updateStep(id, patch)),
    [withError],
  );

  const deleteStep = useCallback(
    (id: string) => withError(() => window.vnote.deleteStep(id)),
    [withError],
  );

  const toggleSuggestions = useCallback(
    (listId: string, enabled: boolean) =>
      withError(() => window.vnote.setListSuggestions(listId, enabled)),
    [withError],
  );

  const addToMyDay = useCallback(
    (taskId: string, day?: string) => withError(() => window.vnote.addToMyDay(taskId, day)),
    [withError],
  );

  const addAttachment = useCallback(
    (taskId: string) => withError(() => window.vnote.addAttachment(taskId)),
    [withError],
  );

  const generateWeeklyReport = useCallback(async (): Promise<string> => {
    try {
      const report = await window.vnote.generateWeeklyReport();
      return report;
    } catch (cause) {
      setError(String(cause));
      return '';
    }
  }, []);

  const lists = state?.lists ?? [];
  const categories = state?.categories ?? [];
  const tasks = state?.tasks ?? [];
  const suggestions = useMemo(() => suggestedTasks.filter((t) => !t.completed), [suggestedTasks]);

  return {
    state,
    lists,
    categories,
    tasks,
    suggestions,
    error,
    setError,
    load,
    createTask,
    updateTask,
    deleteTask,
    createList,
    updateList,
    deleteList,
    addStep,
    updateStep,
    deleteStep,
    toggleSuggestions,
    addToMyDay,
    addAttachment,
    generateWeeklyReport,
  };
}
