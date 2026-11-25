// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import { VNoteDatabase } from '../database.js';
import { TaskService } from '../taskService.js';

const electron = vi.hoisted(() => ({ userData: '', appPath: '' }));
const secrets = {
  encryptString: (value: string) => Buffer.from(value.split('').reverse().join('')),
  decryptString: (value: Buffer) => value.toString().split('').reverse().join(''),
};
vi.mock('electron', () => ({
  app: { getPath: () => electron.userData, getAppPath: () => electron.appPath },
}));

beforeEach(() => {
  electron.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vnote-ai-'));
  const sqlJsEntry = createRequire(import.meta.url).resolve('sql.js');
  electron.appPath = path.resolve(path.dirname(sqlJsEntry), '../../..');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fs.rmSync(electron.userData, { recursive: true, force: true });
});

it('requires an explicit AI grant for both upgraded and newly created lists and remembers revocation', async () => {
  const sql = await initSqlJs();
  const oldDb = new sql.Database();
  oldDb.run(`CREATE TABLE lists (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
    include_in_suggestions INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    INSERT INTO lists VALUES ('work','Work','#000',0,'2026-01-01');`);
  fs.writeFileSync(path.join(electron.userData, 'vnote.sqlite'), oldDb.export());
  const db = await VNoteDatabase.open();
  const service = new TaskService(db);
  const personal = service.createList({ name: 'Personal' });
  expect(service.getAiSettings().lists).toEqual([
    { id: 'work', name: 'Work', allowAi: false },
    { id: personal.id, name: 'Personal', allowAi: false },
  ]);
  service.saveAiSettings({ listAccess: { work: true } });
  db.flush();
  const reopened = new TaskService(await VNoteDatabase.open());
  expect(reopened.getAiSettings().lists[0].allowAi).toBe(true);
  expect(reopened.getLists()[0].includeInSuggestions).toBe(false);
  reopened.saveAiSettings({ listAccess: { work: false } });
  expect(reopened.getAiSettings().lists[0].allowAi).toBe(false);
  expect(reopened.getLists().find((list) => list.id === personal.id)?.includeInSuggestions).toBe(
    true,
  );
});

it('persists only an encrypted key, reports its presence, and preserves or replaces it explicitly', async () => {
  const db = await VNoteDatabase.open();
  const service = new TaskService(db, secrets);
  const disk = path.join(electron.userData, 'vnote.sqlite');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const config = { baseUrl: 'https://model.example/v1', model: 'small', includeNotes: true };
  const saved = service.saveAiSettings({ ...config, apiKey: 'first-secret' });
  expect(saved).toEqual({ ...config, hasApiKey: true, lists: expect.any(Array) });
  db.flush();
  expect(fs.readFileSync(disk).includes('first-secret')).toBe(false);
  const reopened = new TaskService(await VNoteDatabase.open(), secrets);
  expect(reopened.getAiSettings()).toEqual(saved);
  expect(reopened.saveAiSettings({ model: 'large' }).hasApiKey).toBe(true);
  expect(reopened.saveAiSettings({ apiKey: 'second-secret' }).hasApiKey).toBe(true);
  expect(reopened.saveAiSettings({ apiKey: null }).hasApiKey).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});

it('projects only authorized fields and respects the independent candidate and My Day rules', async () => {
  const service = new TaskService(await VNoteDatabase.open());
  const day = '2026-11-25';
  const work = service.createTask({ title: 'Review schedule', listId: 'work', dueDate: day });
  service.updateTask(work.id, { notes: 'Internal context', tags: ['private'], myDayDate: day });
  service.addStep(work.id, { title: 'Private step' });
  service.createAttachment(work.id, { name: 'secret.txt', size: 4, storedPath: 'C:/private/file' });
  const candidate = service.createTask({ title: 'Order samples', listId: 'inbox' });
  const complete = service.createTask({ title: 'Shipped', listId: 'inbox' });
  service.updateTask(complete.id, { completed: true });
  const privateTask = service.createTask({ title: 'Private appointment', listId: 'personal' });
  service.addToMyDay(privateTask.id, day);
  service.setListSuggestions('work', false);
  expect(service.getAiTasks('report')).toEqual([]);
  service.saveAiSettings({ listAccess: { work: true, inbox: true } });
  expect(
    service
      .getAiTasks('report')
      .map((t) => t.id)
      .sort(),
  ).toEqual([work.id, candidate.id, complete.id].sort());
  expect(service.getAiTasks('candidates', day).map((t) => t.id)).toEqual([candidate.id]);
  expect(service.getAiTasks('my-day', day)).toEqual([
    {
      id: work.id,
      listId: 'work',
      listName: 'Work',
      title: 'Review schedule',
      dueDate: day,
      completed: false,
      important: false,
      myDayDate: day,
    },
  ]);
  service.saveAiSettings({ includeNotes: true });
  expect(service.getAiTasks('my-day', day)[0].notes).toBe('Internal context');
  service.saveAiSettings({ listAccess: { work: false } });
  expect(service.getAiTasks('my-day', day)).toEqual([]);
  service.updateTask(privateTask.id, { myDayDate: null });
  expect(service.getSuggestions().map((t) => t.id)).toContain(privateTask.id);
});

it('uses the saved endpoint, model and current key only on an explicit model request', async () => {
  const service = new TaskService(await VNoteDatabase.open(), secrets);
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ choices: [{ message: { content: 'Done' } }] }));
  vi.stubGlobal('fetch', fetch);
  await expect(service.requestAi('Summarize', [])).rejects.toThrow(/AI settings/i);
  service.saveAiSettings({ baseUrl: 'https://model.example/v1/', apiKey: 'key1', model: 'small' });
  service.saveAiSettings({ apiKey: 'key2' });
  expect(fetch).not.toHaveBeenCalled();
  await expect(service.requestAi('Summarize', [{ id: 'work-1' }])).resolves.toBe('Done');
  const [[url, request]] = fetch.mock.calls;
  expect(url).toBe('https://model.example/v1/chat/completions');
  expect(request.headers.Authorization).toBe('Bearer key2');
  expect(JSON.parse(request.body)).toEqual({
    model: 'small',
    messages: [
      { role: 'system', content: 'Summarize' },
      { role: 'user', content: '[{"id":"work-1"}]' },
    ],
  });
  fetch.mockResolvedValue(new Response('private provider error including key2', { status: 401 }));
  await expect(service.requestAi('Summarize', [])).rejects.toThrow(/401/);
  await expect(service.requestAi('Summarize', [])).rejects.not.toThrow(/key2/);
});

it('keeps credentials scoped to a secure service and rolls back changes if encryption fails', async () => {
  const db = await VNoteDatabase.open();
  const service = new TaskService(db, secrets);
  const original = service.saveAiSettings({
    baseUrl: 'https://one.example/v1',
    model: 'm',
    apiKey: 'secret',
  });
  for (const baseUrl of [
    'http://one.example/v1',
    'https://u:p@one.example/v1',
    'https://one.example/v1?key=secret',
  ]) {
    expect(() => service.saveAiSettings({ baseUrl })).toThrow(/URL/i);
  }
  const locked = new TaskService(db);
  expect(() => locked.saveAiSettings({ model: 'new', apiKey: 'replacement' })).toThrow(
    /secure key storage/i,
  );
  expect(service.getAiSettings()).toEqual(original);
  expect(service.saveAiSettings({ baseUrl: 'https://two.example/v1' }).hasApiKey).toBe(false);
  expect(
    service.saveAiSettings({ baseUrl: 'http://localhost:11434/v1', apiKey: 'local' }).hasApiKey,
  ).toBe(true);
});
