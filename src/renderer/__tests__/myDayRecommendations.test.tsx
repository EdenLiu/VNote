import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Task, VNoteApi } from '@shared/types';
import { App } from '../App';

const titles = ['File forecast', 'Call supplier'];
const today = '2026-11-25';
async function openSuggestions(overrides: Partial<VNoteApi> = {}) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 25, 0, 5));
  const tasks: Task[] = titles.map((title) => ({
    id: title,
    title,
    listId: 'work',
    completed: false,
    important: true,
    urgent: false,
    notes: '',
    createdAt: '',
    updatedAt: '',
    repeat: 'none',
    source: 'manual',
    steps: [],
    tags: [],
    attachments: [],
  }));
  const getAiRecommendations = vi.fn(async () =>
    tasks.map((task) => ({
      taskId: task.id,
      reason: 'Starred as important in Work.',
    })),
  );
  const acceptAiRecommendation = vi.fn(async (taskId: string) => {
    const index = tasks.findIndex((task) => task.id === taskId);
    tasks[index] = { ...tasks[index], myDayDate: today };
    return tasks[index];
  });
  vi.stubGlobal('vnote', {
    getState: async () => ({
      lists: [
        { id: 'work', name: 'Work', color: '#fff', createdAt: '', includeInSuggestions: true },
      ],
      tasks: [...tasks],
      categories: [],
      activeView: 'my-day',
    }),
    getAiRecommendations,
    acceptAiRecommendation,
    refreshSuggestions: async () => tasks.filter((t) => !t.myDayDate),
    ...overrides,
  } satisfies Partial<VNoteApi>);
  render(<App />);
  await screen.findByRole('button', { name: 'Work' });
  fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }));
  return { getAiRecommendations, acceptAiRecommendation };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('requests AI only on click, opens the original task and adds just the selected item to local My Day', async () => {
  const { getAiRecommendations, acceptAiRecommendation } = await openSuggestions();
  expect(getAiRecommendations).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Get AI recommendations' }));
  const ai = within(screen.getByRole('region', { name: 'AI recommendations' }));
  fireEvent.click(await ai.findByRole('button', { name: titles[0] }));
  expect(screen.getByPlaceholderText('Task title')).toHaveValue(titles[0]);
  expect(ai.getAllByText('Starred as important in Work.')).toHaveLength(2);
  expect(acceptAiRecommendation).not.toHaveBeenCalled();
  fireEvent.click(ai.getAllByRole('button', { name: 'Add to My Day' })[1]);
  await waitFor(() => expect(ai.queryByRole('button', { name: titles[1] })).toBeNull());
  expect(ai.getByRole('button', { name: titles[0] })).toBeVisible();
  expect(acceptAiRecommendation.mock.calls).toEqual([[titles[1]]]);
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'My Day' }));
  expect(screen.getByRole('button', { name: new RegExp(titles[1]) })).toBeVisible();
  expect(screen.queryByRole('button', { name: new RegExp(titles[0]) })).toBeNull();
  expect(getAiRecommendations).toHaveBeenCalledTimes(1);
});

it('keeps the rules usable after failure, lets the user retry and explains an empty AI result', async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error('Service unavailable.'))
    .mockResolvedValueOnce([]);
  await openSuggestions({ getAiRecommendations: request });
  fireEvent.click(screen.getByRole('button', { name: 'Get AI recommendations' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable.');
  const rules = within(screen.getByRole('region', { name: 'Rule suggestions' }));
  fireEvent.click(rules.getByRole('button', { name: new RegExp(titles[0]) }));
  expect(screen.getByPlaceholderText('Task title')).toHaveValue(titles[0]);
  expect(screen.getByRole('button', { name: 'AI settings' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  const ai = within(screen.getByRole('region', { name: 'AI recommendations' }));
  expect(await ai.findByText(/No AI recommendations for today/)).toHaveTextContent(
    /list access in AI settings/i,
  );
  expect(ai.queryByRole('button', { name: 'Add to My Day' })).toBeNull();
  expect(rules.getByRole('button', { name: new RegExp(titles[1]) })).toBeVisible();
  expect(request).toHaveBeenCalledTimes(2);
});

it('keeps an offered task available for another attempt after adoption fails', async () => {
  await openSuggestions({
    acceptAiRecommendation: async () => {
      throw new Error('Could not save task');
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Get AI recommendations' }));
  const ai = within(screen.getByRole('region', { name: 'AI recommendations' }));
  fireEvent.click((await ai.findAllByRole('button', { name: 'Add to My Day' }))[0]);
  expect(await screen.findByText(/Could not save task/i)).toBeVisible();
  expect(ai.getByRole('button', { name: titles[0] })).toBeVisible();
  expect(ai.getAllByRole('button', { name: 'Add to My Day' })).toHaveLength(2);
});
