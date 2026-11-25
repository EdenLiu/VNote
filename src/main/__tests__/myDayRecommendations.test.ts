// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { VNoteDatabase } from '../database.js';
import { TaskService } from '../taskService.js';
import { createTestDb } from './test-helpers.js';

vi.mock('../database.js', () => ({}));

let service: TaskService;
const fetchModel = vi.fn();
const today = '2026-11-25';
const reply = (recommendations: unknown[]) =>
  Response.json({ choices: [{ message: { content: JSON.stringify({ recommendations }) } }] });

beforeEach(async () => {
  service = new TaskService((await createTestDb()) as unknown as VNoteDatabase, {
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString(),
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 25, 0, 5));
  vi.stubGlobal('fetch', fetchModel.mockReset());
  service.saveAiSettings({
    baseUrl: 'https://model.example/v1',
    model: 'small',
    apiKey: 'test',
    listAccess: { inbox: true, work: true },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('sends only authorized candidates and My Day context, returning a sourced reason without scheduling', async () => {
  const candidate = service.createTask({
    listId: 'inbox',
    title: 'Review forecast',
    dueDate: today,
  });
  service.updateTask(candidate.id, { notes: 'Excluded note' });
  service.createAttachment(candidate.id, {
    name: 'Secret.txt',
    size: 1,
    storedPath: '/private/file',
  });
  service.setListSuggestions('work', false);
  const meeting = service.createTask({ listId: 'work', title: 'Project meeting' });
  service.addToMyDay(meeting.id, today);
  service.createTask({ listId: 'work', title: 'Disabled candidate' });
  const personal = service.createTask({ listId: 'personal', title: 'Private appointment' });
  service.addToMyDay(personal.id, today);
  const completed = service.createTask({ listId: 'inbox', title: 'Finished' });
  service.updateTask(completed.id, { completed: true });
  fetchModel.mockResolvedValue(reply([{ taskId: candidate.id, basis: 'dueDate' }]));

  expect(fetchModel).not.toHaveBeenCalled();
  await expect(service.getAiRecommendations()).resolves.toMatchObject([
    { taskId: candidate.id, reason: 'Due today (2026-11-25).' },
  ]);
  const request = JSON.parse(fetchModel.mock.calls[0][1].body);
  const payload = JSON.parse(request.messages[1].content);
  expect(payload.today).toBe(today);
  expect(payload.candidates.map((t: { title: string }) => t.title)).toEqual(['Review forecast']);
  expect(payload.myDay.map((t: { title: string }) => t.title)).toEqual(['Project meeting']);
  expect(JSON.stringify(request)).not.toMatch(
    /Private appointment|Excluded note|Secret\.txt|private\/file|Disabled candidate|Finished/,
  );
  expect(service.getTask(candidate.id).myDayDate).toBeUndefined();
});

it('checks the submitted and still eligible candidates, verifies their evidence, removes duplicates and caps the result', async () => {
  const make = (title: string, listId = 'inbox') =>
    service.createTask({ title, listId, important: true });
  const revoked = make('Revoked', 'work');
  const changed = make('Already done');
  const first = make('First');
  const second = make('Second');
  const third = make('Third');
  const fourth = make('Fourth');
  let release!: (response: Response) => void;
  fetchModel.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const pending = service.getAiRecommendations();
  const late = make('Created after request');
  service.saveAiSettings({ listAccess: { work: false } });
  service.updateTask(changed.id, { completed: true });
  const star = (taskId: string) => ({ taskId, basis: 'important' });
  release(
    reply([
      null,
      star('unknown'),
      star(late.id),
      star(revoked.id),
      star(changed.id),
      { taskId: fourth.id, basis: 'dueDate' },
      { taskId: fourth.id, basis: 'notes', quote: 'Invented deadline' },
      star(first.id),
      star(first.id),
      star(second.id),
      star(third.id),
      star(fourth.id),
    ]),
  );
  await expect(pending).resolves.toMatchObject(
    [first, second, third].map(({ id }) => ({
      taskId: id,
      reason: 'Starred as important in Tasks.',
    })),
  );
});

it('adds only an offered, still eligible task to the local My Day without changing its dates or other candidates', async () => {
  const make = (title: string, listId: string) =>
    service.createTask({
      title,
      listId,
      dueDate: '2026-12-02',
      plannedStartDate: '2026-11-23',
      plannedEndDate: '2026-11-28',
    });
  const accepted = make('Accept', 'inbox');
  const withdrawn = make('Withdraw', 'work');
  const remaining = make('Keep', 'inbox');
  const notOffered = make('Not selected by model', 'inbox');
  fetchModel.mockResolvedValue(
    reply([accepted, withdrawn, remaining].map(({ id }) => ({ taskId: id, basis: 'dueDate' }))),
  );
  await service.getAiRecommendations();
  service.setListSuggestions('work', false);
  expect(() => service.acceptAiRecommendation(notOffered.id)).toThrow();
  expect(() => service.acceptAiRecommendation(withdrawn.id)).toThrow();
  expect(service.acceptAiRecommendation(accepted.id)).toEqual({ ...accepted, myDayDate: today });
  expect(service.getTask(remaining.id)).toEqual(remaining);
  expect(service.getTask(withdrawn.id)).toEqual(withdrawn);
  expect(service.getSuggestions().map((t) => t.id)).not.toContain(accepted.id);
  expect(service.getAiTasks('candidates').map((t) => t.id)).not.toContain(accepted.id);
  expect(() => service.acceptAiRecommendation(accepted.id)).toThrow();
  vi.setSystemTime(new Date(2026, 10, 26, 0, 1));
  expect(() => service.acceptAiRecommendation(remaining.id)).toThrow();
  expect(service.getTask(remaining.id).myDayDate).toBeUndefined();
});

it.each([
  ['dueDate', { dueDate: '2026-12-01' }],
  ['important', { important: false }],
  ['title', { title: 'Archived' }],
  ['notes', { notes: 'Archived' }],
] as const)('declines an offered task when its %s evidence has changed', async (basis, patch) => {
  const task = service.createTask({
    listId: 'inbox',
    title: 'Act now',
    important: true,
    dueDate: today,
  });
  service.updateTask(task.id, { notes: 'Act now' });
  service.saveAiSettings({ includeNotes: true });
  fetchModel.mockResolvedValue(reply([{ taskId: task.id, basis, quote: 'Act now' }]));
  expect(await service.getAiRecommendations()).toHaveLength(1);

  service.updateTask(task.id, patch);
  expect(() => service.acceptAiRecommendation(task.id)).toThrow(/request recommendations again/i);
  expect(service.getTask(task.id).myDayDate).toBeUndefined();
  expect(fetchModel).toHaveBeenCalledTimes(1);
});

it('skips sending My Day context alone and keeps rule suggestions available after an invalid or unconfigured response', async () => {
  const mine = service.createTask({ listId: 'work', title: 'Already in My Day' });
  service.addToMyDay(mine.id);
  await expect(service.getAiRecommendations()).resolves.toEqual([]);
  expect(fetchModel).not.toHaveBeenCalled();
  const available = service.createTask({ listId: 'inbox', title: 'Rule fallback' });
  fetchModel.mockResolvedValue(Response.json({ choices: [{ message: { content: 'bad reply' } }] }));
  await expect(service.getAiRecommendations()).rejects.toThrow(/retry/i);
  expect(service.getSuggestions().map((t) => t.id)).toEqual([available.id]);
  service.saveAiSettings({ apiKey: null });
  await expect(service.getAiRecommendations()).rejects.toThrow(/settings/i);
  expect(fetchModel).toHaveBeenCalledTimes(1);
});

it('accepts a JSON code block from the configured model', async () => {
  const task = service.createTask({ listId: 'work', title: 'Submit plan', dueDate: today });
  const json = JSON.stringify({ recommendations: [{ taskId: task.id, basis: 'dueDate' }] });
  const content = ['```json', json, '```'].join('\n');
  fetchModel.mockResolvedValue(Response.json({ choices: [{ message: { content } }] }));
  await expect(service.getAiRecommendations()).resolves.toMatchObject([
    { taskId: task.id, reason: 'Due today (2026-11-25).' },
  ]);
});
