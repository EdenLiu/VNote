// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import type { VNoteDatabase } from '../database.js';
import { TaskService } from '../taskService.js';
import { createTestDb } from './test-helpers.js';

vi.mock('../database.js', () => ({}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('drafts only reportable facts from authorized lists and keeps local counts, dates and source IDs', async () => {
  const service = new TaskService((await createTestDb()) as VNoteDatabase, {
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString(),
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 25, 12));
  service.saveAiSettings({
    listAccess: { work: true },
    baseUrl: 'https://example.test/v1',
    apiKey: 'key',
    model: 'test',
  });
  service.setListSuggestions('work', false);
  const inspection = service.createTask({
    title: 'Inspect lighting',
    listId: 'work',
    dueDate: '2026-11-22',
  });
  service.updateTask(inspection.id, { repeat: 'daily', notes: 'Floor four' });
  service.createAttachment(inspection.id, {
    name: 'private.png',
    storedPath: 'C:/secret/image',
    size: 5,
  });
  for (let i = 0; i < 3; i++) service.updateTask(inspection.id, { completed: true });
  const finalDay = service.createTask({
    title: 'Send invoice',
    listId: 'work',
    dueDate: '2026-11-27',
    plannedStartDate: '2026-11-25',
    plannedEndDate: '2026-11-26',
  });
  const late = service.createTask({
    title: 'Review wiring',
    listId: 'work',
    dueDate: '2026-11-24',
  });
  service.createTask({ title: 'Later work', listId: 'work', dueDate: '2026-11-28' });
  const privateTask = service.createTask({
    title: 'Private appointment',
    listId: 'personal',
    dueDate: '2026-11-25',
  });
  service.addToMyDay(privateTask.id, '2026-11-25');

  const content = JSON.stringify({
    items: [
      {
        taskId: inspection.id,
        section: 'completed',
        wording: 'Inspected the lighting',
        completionCount: 99,
      },
      { taskId: privateTask.id, section: 'dueSoon', wording: 'Invented item' },
      { taskId: late.id, section: 'dueSoon', wording: 'Incorrect section', dueDate: '2099-01-01' },
    ],
  });
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
  vi.stubGlobal('fetch', fetch);

  const draft = await service.generateWeeklyReportDraft();
  expect(draft).toEqual([
    {
      listId: 'work',
      listName: 'Work',
      tasks: [
        {
          taskId: inspection.id,
          title: 'Inspect lighting',
          completionCount: 3,
          completedAt: new Date().toISOString(),
          wording: 'Inspected the lighting',
        },
      ],
      dueSoon: [
        { taskId: inspection.id, title: 'Inspect lighting', dueDate: '2026-11-25' },
        { taskId: finalDay.id, title: 'Send invoice', dueDate: '2026-11-27' },
      ],
      overdue: [{ taskId: late.id, title: 'Review wiring', dueDate: '2026-11-24' }],
    },
  ]);
  const sent = () => JSON.parse(fetch.mock.lastCall![1].body).messages[1].content as string;
  expect(
    JSON.parse(sent()).projects[0].items.find(
      (item: { taskId: string }) => item.taskId === finalDay.id,
    ),
  ).toEqual({
    section: 'dueSoon',
    taskId: finalDay.id,
    title: 'Send invoice',
    dueDate: '2026-11-27',
    plannedStartDate: '2026-11-25',
    plannedEndDate: '2026-11-26',
  });
  expect(sent()).toContain('Review wiring');
  expect(sent()).toContain('"completionCount":3');
  expect(sent()).not.toMatch(/Private appointment|Later work|Floor four|private.png|C:\/secret/);
  service.saveAiSettings({ includeNotes: true });
  // A local report can gain display-only fields. The cloud request still uses its own contract.
  const local = service.getWeeklyReport();
  const work = local.find((group) => group.listId === 'work')!;
  work.dueSoon[0].wording = 'Local-only annotation';
  work.dueSoon.push({
    taskId: privateTask.id,
    title: 'Wrong project entry',
    dueDate: '2026-11-25',
  });
  vi.spyOn(service, 'getWeeklyReport').mockReturnValue(local);
  await service.generateWeeklyReportDraft();
  expect(sent()).toContain('Floor four');
  expect(sent()).not.toMatch(/Local-only annotation|Wrong project entry/);
  expect(sent()).not.toMatch(/Private appointment|Later work|private.png|C:\/secret/);
});
