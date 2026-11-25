import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { AppState, Task, VNoteApi } from '@shared/types';
import { App } from '../App';

it('shows the next occurrence after checking a task and its completion total in Weekly Report', async () => {
  const user = userEvent.setup();
  const task: Task = {
    id: 'inspection',
    listId: 'inbox',
    title: 'Inspection',
    repeat: 'daily',
    completed: false,
    important: false,
    urgent: false,
    notes: '',
    dueDate: '2026-11-25',
    createdAt: '2026-11-23',
    updatedAt: '2026-11-24',
    source: 'manual',
    tags: [],
    attachments: [],
    steps: [],
  };
  const state: AppState = {
    activeView: 'list:inbox',
    categories: [],
    tasks: [task],
    lists: [
      {
        id: 'inbox',
        name: 'Tasks',
        includeInSuggestions: true,
        createdAt: '2026-11-23',
        color: '#123456',
      },
    ],
  };
  const nextTask = { ...task, dueDate: '2026-11-26' };
  const api = {
    getState: vi.fn(async () => state),
    refreshSuggestions: vi.fn(async () => []),
    updateTask: vi.fn<VNoteApi['updateTask']>(async () => {
      state.tasks = [nextTask];
      return nextTask;
    }),
    getWeeklyReport: vi.fn(async () => [
      {
        listId: 'inbox',
        listName: 'Tasks',
        dueSoon: [],
        overdue: [],
        tasks: [
          {
            taskId: task.id,
            title: task.title,
            completedAt: '2026-11-25T01:00:00.000Z',
            completionCount: 3,
          },
        ],
      },
    ]),
  } satisfies Pick<VNoteApi, 'getState' | 'refreshSuggestions' | 'updateTask' | 'getWeeklyReport'>;
  vi.stubGlobal('vnote', api);
  try {
    render(<App />);
    const row = await screen.findByRole('button', { name: /Inspection/ });
    await user.click(within(row).getByRole('checkbox'));
    expect(api.updateTask).toHaveBeenCalledWith(task.id, { completed: true });
    expect(await screen.findByText('2026-11-26')).toBeVisible();
    expect(within(row).getByRole('checkbox')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Weekly Report' }));
    const report = within(screen.getByRole('dialog'));
    expect(await report.findByRole('heading', { name: 'Tasks' })).toBeVisible();
    expect(report.getByRole('button', { name: 'Inspection ×3' })).toBeVisible();
  } finally {
    vi.unstubAllGlobals();
  }
});
