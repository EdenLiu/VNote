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
    urgent: false,
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

async function openWorkChart(
  tasks: Task[],
  movePlan?: (id: string, days: number) => Promise<Task>,
) {
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
    moveTaskPlan: movePlan,
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

it('drags the whole bar past its deadline and back and opens the saved plan on a click', async () => {
  const tasks = [
    task('Design', {
      plannedStartDate: '2026-11-23',
      plannedEndDate: '2026-11-25',
      dueDate: '2026-11-27',
    }),
    task('Kickoff', { dueDate: '2026-11-20' }),
    task('Handover', { dueDate: '2026-11-30' }),
  ];
  const move = vi.fn(async (id: string, days: number) => {
    expect(id).toBe('Design');
    const dates: Record<number, [string, string]> = {
      3: ['2026-11-26', '2026-11-28'],
      [-3]: ['2026-11-23', '2026-11-25'],
    };
    const [plannedStartDate, plannedEndDate] = dates[days];
    tasks[0] = { ...tasks[0], plannedStartDate, plannedEndDate };
    return tasks[0];
  });
  const chart = await openWorkChart(tasks, move);
  const originalLabel = 'Design plan 2026-11-23 to 2026-11-25';
  const movedLabel = 'Design plan 2026-11-26 to 2026-11-28';
  const bar = chart.getByRole('button', { name: originalLabel });
  // jsdom has no layout. This 11-day project is rendered at 50 pixels per day.
  vi.spyOn(bar.parentElement!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 550, 40));
  const drag = (from: number, to: number) => {
    const pointer = { pointerId: 1, isPrimary: true, button: 0 };
    fireEvent.pointerDown(bar, { ...pointer, clientX: from });
    fireEvent.pointerMove(bar, { ...pointer, clientX: to });
    fireEvent.pointerUp(bar, { ...pointer, clientX: to });
    fireEvent.click(bar, { detail: 1 });
  };
  drag(170, 320);
  await chart.findByRole('button', { name: movedLabel });
  expect(chart.getByText('Plan ends after due date')).toBeVisible();
  expect(chart.getByRole('button', { name: 'Design due 2026-11-27' })).toBeVisible();
  expect(screen.queryByLabelText('Plan start')).toBeNull();
  drag(320, 170);
  await chart.findByRole('button', { name: originalLabel });
  expect(chart.queryByText('Plan ends after due date')).toBeNull();
  drag(170, 170);
  expect(screen.getByLabelText('Plan start')).toHaveValue('2026-11-23');
  expect(screen.getByLabelText('Plan end')).toHaveValue('2026-11-25');
  expect(screen.getByLabelText('Due')).toHaveValue('2026-11-27');
  expect(move).toHaveBeenCalledTimes(2);
});

it.each(['pointercancel', 'lostpointercapture', 'Escape'])(
  'discards a drag interrupted by %s and lets the next click open the original plan',
  async (interruption) => {
    const design = task('Design', { plannedStartDate: '2026-11-23', plannedEndDate: '2026-11-25' });
    const move = vi.fn(async () => design);
    const chart = await openWorkChart([design], move);
    const bar = chart.getByRole('button', { name: /Design plan/ });
    vi.spyOn(bar.parentElement!, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 350, 40),
    );
    const pointer = { pointerId: 1, isPrimary: true, button: 0 };
    fireEvent.pointerDown(bar, { ...pointer, clientX: 100 });
    fireEvent.pointerMove(bar, { ...pointer, clientX: 300 });
    if (interruption === 'Escape') fireEvent.keyDown(bar, { key: 'Escape' });
    else if (interruption === 'pointercancel') fireEvent.pointerCancel(bar, pointer);
    else fireEvent.lostPointerCapture(bar, pointer);
    fireEvent.pointerUp(bar, { ...pointer, clientX: 300 });
    fireEvent.click(bar, { detail: 1 });
    expect(move).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Plan start')).toBeNull();
    fireEvent.pointerDown(bar, { ...pointer, clientX: 100 });
    fireEvent.pointerUp(bar, { ...pointer, clientX: 100 });
    fireEvent.click(bar, { detail: 1 });
    expect(screen.getByLabelText('Plan start')).toHaveValue('2026-11-23');
  },
);

it('moves a lone one-day plan within the visible week and keeps its dates on a failed save', async () => {
  const tasks = [
    task('Site visit', { plannedStartDate: '2026-11-23', plannedEndDate: '2026-11-23' }),
  ];
  const move = vi
    .fn(async (_id: string, days: number) => {
      expect(days).toBe(3);
      tasks[0] = { ...tasks[0], plannedStartDate: '2026-11-26', plannedEndDate: '2026-11-26' };
      return tasks[0];
    })
    .mockRejectedValueOnce(new Error('Disk is full'));
  const chart = await openWorkChart(tasks, move);
  const bar = chart.getByRole('button', { name: 'Site visit plan 2026-11-23 to 2026-11-23' });
  // A single-day project needs room to move several days in either direction.
  expect(chart.getByText('Nov 20')).toBeVisible();
  expect(chart.getByText('Nov 26')).toBeVisible();
  vi.spyOn(bar.parentElement!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 350, 40));
  const drop = () => {
    const pointer = { pointerId: 4, isPrimary: true, button: 0 };
    fireEvent.pointerDown(bar, { ...pointer, clientX: 175 });
    fireEvent.pointerUp(bar, { ...pointer, clientX: 325 });
  };
  drop();
  expect(await screen.findByText(/Disk is full/)).toBeVisible();
  expect(bar).toHaveAccessibleName('Site visit plan 2026-11-23 to 2026-11-23');
  drop();
  await chart.findByRole('button', { name: 'Site visit plan 2026-11-26 to 2026-11-26' });
  expect(screen.queryByText(/Disk is full/)).toBeNull();
});

it('moves a one-day bar past the edge of a multi-year timeline while scrolling', async () => {
  const tasks = [
    task('Archive', { dueDate: '2017-01-01' }),
    task('Final review', { plannedStartDate: '2026-12-31', plannedEndDate: '2026-12-31' }),
  ];
  const move = vi.fn(async (_id: string, days: number) => {
    expect(days).toBe(1);
    tasks[1] = { ...tasks[1], plannedStartDate: '2027-01-01', plannedEndDate: '2027-01-01' };
    return tasks[1];
  });
  const chart = await openWorkChart(tasks, move);
  const bar = chart.getByRole('button', { name: /Final review plan/ });
  const track = bar.parentElement!;
  // jsdom supplies no geometry. Use the chart's rendered width minus its fixed task column.
  const canvas = track.parentElement!.parentElement!;
  const width = Number.parseFloat(canvas.style.minWidth) - 155;
  const dayWidth = width / 3652;
  const geometry = vi.spyOn(track, 'getBoundingClientRect');
  geometry.mockReturnValue(new DOMRect(500 - width, 0, width, 40));
  const pointer = { pointerId: 1, isPrimary: true, button: 0 };
  fireEvent.pointerDown(bar, { ...pointer, clientX: 500 - dayWidth / 2 });
  // Half of the one-day displacement comes from scrolling the chart during the drag.
  geometry.mockReturnValue(new DOMRect(500 - width - dayWidth / 2, 0, width, 40));
  fireEvent.pointerUp(bar, { ...pointer, clientX: 500 });
  await chart.findByRole('button', { name: 'Final review plan 2027-01-01 to 2027-01-01' });
});

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
