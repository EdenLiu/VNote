import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Task, TaskPatch, VNoteApi } from '@shared/types';
import { App } from '../../../App';

function task(title: string, dates: Partial<Task> = {}): Task {
  return {
    title,
    id: title,
    listId: 'work',
    completed: false,
    important: false,
    notes: '',
    createdAt: '',
    updatedAt: '',
    repeat: 'none',
    source: 'manual',
    steps: [],
    tags: [],
    attachments: [],
    ...dates,
  };
}

async function openWorkChart(tasks: Task[]) {
  const lists = ['Inbox', 'Work'].map((name) => ({
    id: name.toLowerCase(),
    name,
    color: '#444444',
    includeInSuggestions: true,
    createdAt: '',
  }));
  const api = {
    getState: async () => ({
      lists,
      tasks: [...tasks],
      categories: [],
      activeView: 'my-day' as const,
    }),
    refreshSuggestions: async () => [],
    updateTask: async (id: string, patch: TaskPatch) => {
      const index = tasks.findIndex((item) => item.id === id);
      const edits = Object.fromEntries(
        Object.entries(patch).map(([key, val]) => [key, val ?? undefined]),
      );
      tasks[index] = { ...tasks[index], ...edits };
      return tasks[index];
    },
  } satisfies Partial<VNoteApi>;
  vi.stubGlobal('vnote', api);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Work' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gantt' }));
  return within(screen.getByRole('region', { name: 'Work schedule' }));
}

afterEach(() => vi.unstubAllGlobals());

it('compares two plans on one date axis and shows independent deadlines in the selected list', async () => {
  const chart = await openWorkChart([
    task('Design', {
      plannedStartDate: '2026-11-23',
      plannedEndDate: '2026-11-25',
      dueDate: '2026-11-27',
    }),
    task('Review', { plannedStartDate: '2026-11-24', plannedEndDate: '2026-11-26' }),
    task('Legacy', { dueDate: '2026-11-27' }),
    task('Other list', { listId: 'inbox', dueDate: '2026-11-27' }),
  ]);
  expect(chart.getByText('Nov 23')).toBeVisible();
  expect(chart.getByText('Nov 27')).toBeVisible();
  expect(chart.getByRole('button', { name: 'Design plan 2026-11-23 to 2026-11-25' })).toBeVisible();
  expect(chart.getByRole('button', { name: 'Design due 2026-11-27' })).toBeVisible();
  expect(chart.getByRole('button', { name: 'Review plan 2026-11-24 to 2026-11-26' })).toBeVisible();
  expect(chart.getByRole('button', { name: 'Legacy due 2026-11-27' })).toBeVisible();
  expect(chart.queryByRole('button', { name: /Legacy plan/ })).toBeNull();
  expect(chart.queryByText('Other list')).toBeNull();
});

it('opens unfinished schedules in task details and updates the chart as dates are saved', async () => {
  const chart = await openWorkChart([
    task('Delivery'),
    task('Review', { plannedEndDate: '2026-11-26' }),
  ]);
  fireEvent.click(chart.getByRole('button', { name: 'Review' }));
  expect(screen.getByLabelText('Plan end')).toHaveValue('2026-11-26');
  expect(chart.queryByRole('button', { name: /Review plan/ })).toBeNull();
  const backlog = chart.getByRole('region', { name: 'Unscheduled' });
  fireEvent.click(within(backlog).getByRole('button', { name: 'Delivery' }));
  const editDate = async (label: string, value: string) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await waitFor(() => expect(screen.getByLabelText(label)).toHaveValue(value));
  };
  await editDate('Plan start', '2026-11-23');
  fireEvent.click(chart.getByRole('button', { name: 'Review' }));
  fireEvent.click(chart.getByRole('button', { name: 'Delivery' }));
  expect(screen.getByLabelText('Plan start')).toHaveValue('2026-11-23');
  await editDate('Plan end', '2026-11-26');
  await editDate('Due', '2026-11-25');
  expect(chart.getByRole('button', { name: 'Delivery due 2026-11-25' })).toBeVisible();
  expect(chart.getByText('Plan ends after due date')).toBeVisible();
  fireEvent.click(chart.getByRole('button', { name: 'Review' }));
  fireEvent.click(chart.getByRole('button', { name: 'Delivery plan 2026-11-23 to 2026-11-26' }));
  expect(screen.getByLabelText('Due')).toHaveValue('2026-11-25');
  await editDate('Plan end', '2026-11-25');
  expect(
    chart.getByRole('button', { name: 'Delivery plan 2026-11-23 to 2026-11-25' }),
  ).toBeVisible();
  expect(chart.queryByText('Plan ends after due date')).toBeNull();
});
