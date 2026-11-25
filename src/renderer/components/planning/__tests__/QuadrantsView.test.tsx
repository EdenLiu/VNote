import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Task, VNoteApi } from '@shared/types';
import { App } from '../../../App';

function task(title: string, fields: Partial<Task> = {}): Task {
  return {
    id: title,
    title,
    listId: 'work',
    completed: false,
    important: false,
    urgent: false,
    notes: '',
    createdAt: '',
    updatedAt: '',
    repeat: 'none',
    source: 'manual',
    steps: [],
    tags: [],
    attachments: [],
    ...fields,
  };
}

async function openQuadrants(tasks: Task[], overrides: Partial<VNoteApi> = {}) {
  const lists = ['Work', 'Home'].map((name) => ({
    id: name.toLowerCase(),
    name,
    color: '#123456',
    createdAt: '',
    includeInSuggestions: true,
  }));
  vi.stubGlobal('vnote', {
    getState: async () => ({ lists, tasks: [...tasks], categories: [], activeView: 'my-day' }),
    refreshSuggestions: async () => [],
    ...overrides,
  } satisfies Partial<VNoteApi>);
  await act(async () => {
    render(<App />);
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Priority quadrants' }));
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('compares unfinished tasks across lists and can narrow the board to one list', async () => {
  await openQuadrants([
    task('Send proposal', { important: true, urgent: true, dueDate: '2000-01-01' }),
    task('Plan budget', { listId: 'home', important: true }),
    task('Reply', { urgent: true, dueDate: '2000-01-01' }),
    task('File notes', { listId: 'home' }),
    task('Signed off', { completed: true }),
  ]);
  for (const [name, title] of [
    ['Important and urgent', 'Send proposal'],
    ['Important and not urgent', 'Plan budget'],
    ['Not important and urgent', 'Reply'],
    ['Not important and not urgent', 'File notes'],
  ]) {
    expect(
      within(screen.getByRole('region', { name })).getByRole('button', { name: title }),
    ).toBeVisible();
  }
  expect(screen.queryByText('Signed off')).toBeNull();
  const filter = screen.getByRole('combobox', { name: 'Filter by list' });
  expect(filter).toHaveDisplayValue('All lists');
  fireEvent.change(filter, { target: { value: 'work' } });
  expect(screen.queryByText('Plan budget')).toBeNull();
  expect(screen.queryByText('File notes')).toBeNull();
  expect(screen.getByRole('button', { name: 'Reply' })).toBeVisible();
});

it('moves an undated task, shows its star in details and the list, restores automatic urgency, and completes it', async () => {
  const tasks = [task('Customer reply')];
  await openQuadrants(tasks, {
    updateTask: async (_id, patch) => {
      const current = tasks[0];
      const urgencyOverride =
        patch.urgencyOverride === null
          ? undefined
          : (patch.urgencyOverride ?? current.urgencyOverride);
      tasks[0] = {
        ...current,
        important: patch.important ?? current.important,
        urgencyOverride,
        urgent: urgencyOverride === 'urgent',
        completed: patch.completed ?? current.completed,
      };
      return tasks[0];
    },
  });
  const move = screen.getByRole('combobox', { name: 'Move Customer reply' });
  const target = within(move).getByRole<HTMLOptionElement>('option', {
    name: 'Important and urgent',
  });
  fireEvent.change(move, { target: { value: target.value } });
  const urgent = within(screen.getByRole('region', { name: 'Important and urgent' }));
  fireEvent.click(await urgent.findByRole('button', { name: 'Customer reply' }));
  expect(screen.getByRole('button', { name: 'Remove importance' })).toBeVisible();
  expect(screen.getByLabelText('Due')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Work' }));
  expect(screen.getByRole('img', { name: 'Important' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Priority quadrants' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restore automatic urgency' }));
  const later = within(screen.getByRole('region', { name: 'Important and not urgent' }));
  expect(await later.findByRole('button', { name: 'Customer reply' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Remove importance' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
  await waitFor(() => expect(later.queryByRole('button', { name: 'Customer reply' })).toBeNull());
  expect(screen.queryByRole('combobox', { name: 'Move Customer reply' })).toBeNull();
});

it('refreshes an open board when a deadline becomes urgent at local midnight', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 25, 23, 59, 59));
  const tasks = [task('File report', { dueDate: '2026-11-26' })];
  await openQuadrants(tasks);
  const later = within(screen.getByRole('region', { name: 'Not important and not urgent' }));
  expect(later.getByRole('button', { name: 'File report' })).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  const urgent = within(screen.getByRole('region', { name: 'Not important and urgent' }));
  expect(urgent.getByRole('button', { name: 'File report' })).toBeVisible();
});
