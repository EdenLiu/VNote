import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVNote } from '../useVNote';
import type { AppState, Task, TaskList, Category, TaskDraft, TaskPatch } from '@shared/types';

function mockState(overrides: Partial<AppState> = {}): AppState {
  return {
    lists: [] as TaskList[],
    categories: [] as Category[],
    tasks: [] as Task[],
    activeView: 'my-day',
    ...overrides,
  };
}

function mockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'inbox',
    title: 'Test',
    completed: false,
    important: false,
    notes: '',
    repeat: 'none',
    source: 'manual',
    tags: [],
    steps: [],
    attachments: [],
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('useVNote', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.vnote = {
      getState: vi.fn().mockResolvedValue(mockState()),
      createTask: vi.fn().mockResolvedValue(mockTask()),
      updateTask: vi.fn().mockResolvedValue(mockTask()),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      createList: vi.fn(),
      updateList: vi.fn(),
      deleteList: vi.fn(),
      addStep: vi.fn(),
      updateStep: vi.fn(),
      deleteStep: vi.fn(),
      addAttachment: vi.fn(),
      removeAttachment: vi.fn(),
      openAttachment: vi.fn(),
      setListSuggestions: vi.fn(),
      refreshSuggestions: vi.fn().mockResolvedValue([]),
      addToMyDay: vi.fn().mockResolvedValue(mockTask()),
      generateWeeklyReport: vi.fn().mockResolvedValue(''),
    };
  });

  it('loads state on mount', async () => {
    const state = mockState({
      lists: [
        { id: 'inbox', name: 'Tasks', color: '#2563eb', includeInSuggestions: true, createdAt: '' },
      ],
    });
    window.vnote.getState = vi.fn().mockResolvedValue(state);

    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    expect(result.current.state).toEqual(state);
    expect(window.vnote.getState).toHaveBeenCalled();
  });

  it('provides empty defaults before state loads', () => {
    window.vnote.getState = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useVNote());

    expect(result.current.lists).toEqual([]);
    expect(result.current.categories).toEqual([]);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('createTask calls API then reloads state and suggestions', async () => {
    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    const draft: TaskDraft = { title: 'new', listId: 'inbox' };
    await act(async () => {
      await result.current.createTask(draft);
    });

    expect(window.vnote.createTask).toHaveBeenCalledWith(draft);
    expect(window.vnote.getState).toHaveBeenCalledTimes(2); // initial + reload
    expect(window.vnote.refreshSuggestions).toHaveBeenCalledTimes(2); // initial + reload
  });

  it('updateTask calls API with correct arguments', async () => {
    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    const patch: TaskPatch = { title: 'updated' };
    await act(async () => {
      await result.current.updateTask('t1', patch);
    });

    expect(window.vnote.updateTask).toHaveBeenCalledWith('t1', patch);
  });

  it('deleteTask calls API', async () => {
    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    await act(async () => {
      await result.current.deleteTask('t1');
    });

    expect(window.vnote.deleteTask).toHaveBeenCalledWith('t1');
  });

  it('sets error state when an API call fails', async () => {
    window.vnote.createTask = vi.fn().mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    await act(async () => {
      await result.current.createTask({ title: 'fail', listId: 'inbox' });
    });

    expect(result.current.error).toContain('Network failure');
  });

  it('clears error on subsequent successful call', async () => {
    window.vnote.createTask = vi
      .fn()
      .mockRejectedValueOnce(new Error('first fails'))
      .mockResolvedValueOnce(mockTask());

    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    // First call — fails
    await act(async () => {
      await result.current.createTask({ title: 'fail', listId: 'inbox' });
    });
    expect(result.current.error).toContain('first fails');

    // Second call — succeeds
    await act(async () => {
      await result.current.createTask({ title: 'ok', listId: 'inbox' });
    });
    expect(result.current.error).toBeNull();
  });

  it('addStep calls API', async () => {
    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    await act(async () => {
      await result.current.addStep('t1', 'subtask');
    });

    expect(window.vnote.addStep).toHaveBeenCalledWith('t1', { title: 'subtask' });
  });

  it('toggleSuggestions calls setListSuggestions API', async () => {
    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    await act(async () => {
      await result.current.toggleSuggestions('list1', false);
    });

    expect(window.vnote.setListSuggestions).toHaveBeenCalledWith('list1', false);
  });

  it('addToMyDay calls API with date', async () => {
    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    await act(async () => {
      await result.current.addToMyDay('t1', '2026-06-01');
    });

    expect(window.vnote.addToMyDay).toHaveBeenCalledWith('t1', '2026-06-01');
  });

  it('createList calls API with name and color', async () => {
    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    await act(async () => {
      await result.current.createList('New List', '#ff0000');
    });

    expect(window.vnote.createList).toHaveBeenCalledWith({ name: 'New List', color: '#ff0000' });
  });

  it('returns filtered suggestions (excludes completed)', async () => {
    window.vnote.refreshSuggestions = vi
      .fn()
      .mockResolvedValue([
        mockTask({ id: 'a', title: 'Active', completed: false }),
        mockTask({ id: 'b', title: 'Done', completed: true }),
      ]);

    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.suggestions.length).toBe(1);
    });

    expect(result.current.suggestions[0].title).toBe('Active');
  });

  it('setError can manually set an error', async () => {
    const { result } = renderHook(() => useVNote());

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    act(() => {
      result.current.setError('custom error');
    });

    expect(result.current.error).toBe('custom error');
  });
});
