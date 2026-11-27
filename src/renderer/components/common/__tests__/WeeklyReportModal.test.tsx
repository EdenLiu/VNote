import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WeeklyReportGroup } from '@shared/types';
import { WeeklyReportModal } from '../WeeklyReportModal';
import { formatWeeklyReport } from '../weeklyReportFormat';

const groups: WeeklyReportGroup[] = [
  {
    listId: 'inbox',
    listName: 'Tasks',
    dueSoon: [],
    overdue: [],
    tasks: [
      { taskId: '1', title: 'task 1', completedAt: '2026-08-03T02:00:00.000Z' },
      { taskId: '2', title: 'task 2', completedAt: '2026-08-03T03:00:00.000Z' },
    ],
  },
  {
    listId: 'work',
    listName: 'Work',
    dueSoon: [],
    overdue: [],
    tasks: [{ taskId: '3', title: 'task 3', completedAt: '2026-08-04T02:00:00.000Z' }],
  },
];

const fetchResolving = (value: WeeklyReportGroup[] | undefined) => vi.fn().mockResolvedValue(value);

describe('formatWeeklyReport', () => {
  it('formats groups as list name followed by task bullets, separated by blank lines', () => {
    expect(formatWeeklyReport(groups)).toBe(
      'Tasks:\nCompleted this week\n- task 1\n- task 2\n\nWork:\nCompleted this week\n- task 3',
    );
  });

  it('returns an empty string for no groups', () => {
    expect(formatWeeklyReport([])).toBe('');
  });
});

describe('WeeklyReportModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state, then the formatted report', async () => {
    render(
      <WeeklyReportModal
        onClose={vi.fn()}
        onOpenTask={vi.fn()}
        fetchReport={fetchResolving(groups)}
      />,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByText(/task 1/)).toBeInTheDocument();
    expect(screen.getByText(/task 3/)).toBeInTheDocument();
  });

  it('shows an empty state when no list has any reportable tasks', async () => {
    render(
      <WeeklyReportModal onClose={vi.fn()} onOpenTask={vi.fn()} fetchReport={fetchResolving([])} />,
    );
    expect(await screen.findByText('No tasks to report this week.')).toBeInTheDocument();
  });

  it('shows an error state when fetching fails', async () => {
    render(
      <WeeklyReportModal
        onClose={vi.fn()}
        onOpenTask={vi.fn()}
        fetchReport={fetchResolving(undefined)}
      />,
    );
    expect(await screen.findByText('Could not load the weekly report.')).toBeInTheDocument();
  });

  it('copies the formatted text to the clipboard and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(
      <WeeklyReportModal
        onClose={vi.fn()}
        onOpenTask={vi.fn()}
        fetchReport={fetchResolving(groups)}
      />,
    );
    await screen.findByRole('heading', { name: 'Tasks' });

    await userEvent.click(screen.getByText('Copy to clipboard'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(formatWeeklyReport(groups)));
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('closes on Escape and on the close button', async () => {
    const onClose = vi.fn();
    render(
      <WeeklyReportModal
        onClose={onClose}
        onOpenTask={vi.fn()}
        fetchReport={fetchResolving(groups)}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes when clicking the overlay but not the modal body', async () => {
    const onClose = vi.fn();
    render(
      <WeeklyReportModal
        onClose={onClose}
        onOpenTask={vi.fn()}
        fetchReport={fetchResolving(groups)}
      />,
    );

    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText('Weekly Report'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
