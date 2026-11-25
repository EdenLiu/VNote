import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AppState, VNoteApi, WeeklyReportGroup } from '@shared/types';
import { App } from '../App';

const facts: WeeklyReportGroup[] = [
  {
    listId: 'work',
    listName: 'Work',
    dueSoon: [],
    overdue: [],
    tasks: [
      {
        taskId: 'inspection',
        title: 'Inspect lamps',
        completionCount: 3,
        completedAt: '2026-11-25T10:00:00Z',
      },
    ],
  },
];
const generated = [
  {
    ...facts[0],
    tasks: [{ ...facts[0].tasks[0], wording: 'Checked the lamps' }],
  },
];

function openApp() {
  const state: AppState = {
    activeView: 'list:inbox',
    categories: [],
    lists: [
      {
        id: 'work',
        name: 'Work',
        includeInSuggestions: false,
        color: '#000',
        createdAt: '2026-11-01',
      },
    ],
    tasks: [
      {
        id: 'inspection',
        title: 'Inspect lamps',
        listId: 'work',
        createdAt: '2026-11-01',
        updatedAt: '2026-11-25',
        repeat: 'daily',
        source: 'manual',
        important: false,
        urgent: false,
        completed: false,
        notes: 'Third-floor fittings',
        steps: [],
        attachments: [],
        tags: [],
      },
    ],
  };
  const generate = vi.fn<VNoteApi['generateWeeklyReportDraft']>().mockResolvedValue(generated);
  vi.stubGlobal('vnote', {
    getState: async () => state,
    refreshSuggestions: async () => [],
    getWeeklyReport: async () => facts,
    generateWeeklyReportDraft: generate,
  } satisfies Pick<
    VNoteApi,
    'getState' | 'refreshSuggestions' | 'getWeeklyReport' | 'generateWeeklyReportDraft'
  >);
  render(<App />);
  return generate;
}

afterEach(() => vi.unstubAllGlobals());

it('keeps local facts available and supports a manual draft when no model has been configured', async () => {
  const user = userEvent.setup();
  const generate = openApp();
  generate.mockRejectedValue(
    new Error('Open AI settings and configure a service URL, model and API key.'),
  );
  await user.click(screen.getByRole('button', { name: 'Weekly Report' }));
  const report = within(screen.getByRole('dialog'));
  await user.click(report.getByRole('button', { name: 'Generate draft' }));
  expect(await report.findByRole('alert')).toHaveTextContent('Open AI settings');
  expect(report.getByRole('heading', { name: 'Local report' })).toBeVisible();
  await user.click(report.getByRole('button', { name: 'Copy to clipboard' }));
  expect(await navigator.clipboard.readText()).toContain('Inspect lamps ×3');
  await user.click(report.getByRole('button', { name: 'Write draft' }));
  const editor = report.getByRole('textbox', { name: 'Manual draft' });
  await user.type(editor, 'Updates from today');
  await user.click(report.getByRole('button', { name: 'Retry' }));
  expect(editor).toHaveValue('Updates from today');
  await user.click(report.getByRole('button', { name: 'Copy draft' }));
  expect(await navigator.clipboard.readText()).toBe('Updates from today');
});

it('preserves edited text on failure and lets the author choose whether a successful retry replaces it', async () => {
  const user = userEvent.setup();
  const generate = openApp();
  await user.click(screen.getByRole('button', { name: 'Weekly Report' }));
  const report = within(screen.getByRole('dialog'));
  await user.click(report.getByRole('button', { name: 'Generate draft' }));
  const editor = await report.findByRole('textbox', { name: 'AI draft' });
  await user.clear(editor);
  await user.type(editor, 'Original edits');
  generate.mockRejectedValueOnce(
    new Error('Could not reach the AI service. Check the service URL and retry.'),
  );
  await user.click(report.getByRole('button', { name: 'Generate draft' }));
  expect(await report.findByRole('alert')).toHaveTextContent('Check the service URL and retry');
  await user.type(editor, ' and additions');
  await user.click(report.getByRole('button', { name: 'Copy draft' }));
  expect(await navigator.clipboard.readText()).toBe('Original edits and additions');
  await user.click(report.getByRole('button', { name: 'Retry' }));
  expect(editor).toHaveValue('Original edits and additions');
  await user.click(report.getByRole('button', { name: 'Use new draft' }));
  expect(editor).toHaveValue('Work:\nCompleted this week\n- Checked the lamps ×3');
  expect(generate).toHaveBeenCalledTimes(3);
});

it('opens the local report first, drafts on demand and keeps edits while checking the source task', async () => {
  const user = userEvent.setup();
  const generate = openApp();
  await user.click(screen.getByRole('button', { name: 'Weekly Report' }));
  const report = within(screen.getByRole('dialog'));
  expect(await report.findByRole('button', { name: 'Inspect lamps ×3' })).toBeVisible();
  expect(generate).not.toHaveBeenCalled();
  await user.click(report.getByRole('button', { name: 'Generate draft' }));
  const editor = await report.findByRole('textbox', { name: 'AI draft' });
  expect(editor).toHaveValue('Work:\nCompleted this week\n- Checked the lamps ×3');
  await user.clear(editor);
  await user.type(editor, 'Checked three floors');
  await user.click(report.getByRole('button', { name: 'Copy draft' }));
  expect(await navigator.clipboard.readText()).toBe('Checked three floors');
  await user.click(report.getByRole('button', { name: 'Inspect lamps ×3' }));
  expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Third-floor fittings');
  await user.click(screen.getByRole('button', { name: 'Weekly Report' }));
  await user.click(screen.getByRole('button', { name: 'View draft' }));
  expect(screen.getByRole('textbox', { name: 'AI draft' })).toHaveValue('Checked three floors');
  expect(generate).toHaveBeenCalledTimes(1);
});
