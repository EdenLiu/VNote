import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WeeklyReportGroup } from '@shared/types';
import { WeeklyReportModal, formatWeeklyReport } from '../WeeklyReportModal';

const groups: WeeklyReportGroup[] = [
  {
    listId: 'inbox',
    listName: 'Tasks',
    tasks: [
      { title: 'task 1', completedAt: '2026-08-03T02:00:00.000Z' },
      { title: 'task 2', completedAt: '2026-08-03T03:00:00.000Z' },
    ],
  },
  {
    listId: 'work',
    listName: 'Work',
    tasks: [{ title: 'task 3', completedAt: '2026-08-04T02:00:00.000Z' }],
  },
];

const fetchResolving = (value: WeeklyReportGroup[] | undefined) => vi.fn().mockResolvedValue(value);

describe('formatWeeklyReport', () => {
  it('formats groups as list name followed by task bullets, separated by blank lines', () => {
    expect(formatWeeklyReport(groups)).toBe('Tasks:\n- task 1\n- task 2\n\nWork:\n- task 3');
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
    render(<WeeklyReportModal onClose={vi.fn()} fetchReport={fetchResolving(groups)} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    expect(await screen.findByText(/Tasks:/)).toBeInTheDocument();
    expect(screen.getByText(/task 1/)).toBeInTheDocument();
    expect(screen.getByText(/task 3/)).toBeInTheDocument();
  });

  it('shows an empty state when no tasks were completed this week', async () => {
    render(<WeeklyReportModal onClose={vi.fn()} fetchReport={fetchResolving([])} />);
    expect(await screen.findByText('No tasks completed this week.')).toBeInTheDocument();
  });

  it('shows an error state when fetching fails', async () => {
    render(<WeeklyReportModal onClose={vi.fn()} fetchReport={fetchResolving(undefined)} />);
    expect(await screen.findByText('Could not load the weekly report.')).toBeInTheDocument();
  });

  it('copies the formatted text to the clipboard and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<WeeklyReportModal onClose={vi.fn()} fetchReport={fetchResolving(groups)} />);
    await screen.findByText(/Tasks:/);

    await userEvent.click(screen.getByText('Copy to clipboard'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(formatWeeklyReport(groups)));
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('closes on Escape and on the close button', async () => {
    const onClose = vi.fn();
    render(<WeeklyReportModal onClose={onClose} fetchReport={fetchResolving(groups)} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes when clicking the overlay but not the modal body', async () => {
    const onClose = vi.fn();
    render(<WeeklyReportModal onClose={onClose} fetchReport={fetchResolving(groups)} />);

    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText('Weekly Report'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
