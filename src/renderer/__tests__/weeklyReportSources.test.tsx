import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { AppState, Task, VNoteApi } from '@shared/types';
import { App } from '../App';

it('copies all three report sections and opens the selected same-name task from its project', async () => {
  const user = userEvent.setup();
  const overdue: Task = {
    id: 'late',
    title: 'Review',
    listId: 'work',
    dueDate: '2026-01-29',
    notes: 'Client proof',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-29',
    repeat: 'none',
    source: 'manual',
    important: false,
    completed: false,
    steps: [],
    attachments: [],
    tags: [],
  };
  const dueSoon = {
    ...overdue,
    id: 'today',
    listId: 'inbox',
    notes: 'Internal proof',
    dueDate: '2026-01-30',
  };
  const completed = {
    ...dueSoon,
    id: 'finished',
    title: 'Send quote',
    completed: true,
    completedAt: '2026-01-28T03:00:00.000Z',
  };
  const list = { includeInSuggestions: true, color: '#123456', createdAt: '2026-01-01' };
  const state: AppState = {
    activeView: 'list:inbox',
    categories: [],
    tasks: [dueSoon, completed, overdue],
    lists: [
      { ...list, id: 'inbox', name: 'Tasks' },
      { ...list, id: 'work', name: 'Work' },
    ],
  };
  const api = {
    getState: async () => state,
    refreshSuggestions: async () => [],
    getWeeklyReport: async () => [
      {
        listId: 'inbox',
        listName: 'Tasks',
        tasks: [
          { taskId: completed.id, title: completed.title, completedAt: completed.completedAt },
        ],
        dueSoon: [{ taskId: dueSoon.id, title: dueSoon.title, dueDate: dueSoon.dueDate }],
        overdue: [],
      },
      {
        listId: 'work',
        listName: 'Work',
        tasks: [],
        dueSoon: [],
        overdue: [{ taskId: overdue.id, title: overdue.title, dueDate: '2026-01-29' }],
      },
    ],
  } satisfies Pick<VNoteApi, 'getState' | 'refreshSuggestions' | 'getWeeklyReport'>;
  vi.stubGlobal('vnote', api);
  try {
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Weekly Report' }));
    const report = within(screen.getByRole('dialog'));
    for (const name of ['Completed this week', 'Due in the next 3 days', 'Overdue']) {
      expect(await report.findByRole('heading', { name })).toBeVisible();
    }
    await user.click(report.getByRole('button', { name: 'Copy to clipboard' }));
    expect(await navigator.clipboard.readText()).toBe(
      'Tasks:\nCompleted this week\n- Send quote\nDue in the next 3 days\n- Review (2026-01-30)\n\nWork:\nOverdue\n- Review (2026-01-29)',
    );
    const work = within(report.getByRole('region', { name: 'Work' }));
    await user.click(work.getByRole('button', { name: /Review/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'List' })).toHaveValue('work');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Client proof');
  } finally {
    vi.unstubAllGlobals();
  }
});
