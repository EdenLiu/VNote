// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { app } from 'electron';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VNoteDatabase } from '../database.js';
import { TaskService } from '../taskService.js';

vi.mock('electron', () => ({ app: { getPath: vi.fn(), getAppPath: vi.fn() } }));

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'vnote-priority-'));
  const require = createRequire(import.meta.url);
  vi.mocked(app.getPath).mockReturnValue(directory);
  vi.mocked(app.getAppPath).mockReturnValue(path.resolve(require.resolve('sql.js'), '../../../..'));
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 25, 23, 59, 59, 999));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  rmSync(directory, { recursive: true, force: true });
});

it('classifies migrated and newly created tasks by deadline at local midnight', async () => {
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, list_id TEXT NOT NULL, title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0, important INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '', due_date TEXT, reminder_at TEXT, repeat TEXT NOT NULL DEFAULT 'none',
      category_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT,
      source TEXT NOT NULL DEFAULT 'manual'
    );
    INSERT INTO tasks (id, list_id, title, important, due_date, created_at, updated_at)
      VALUES ('old', 'work', 'Review', 1, '2026-11-26', '2026-11-20', '2026-11-20');
  `);
  writeFileSync(path.join(directory, 'vnote.sqlite'), legacy.export());
  legacy.close();

  const service = new TaskService(await VNoteDatabase.open());
  expect(service.getTask('old')).toMatchObject({ important: true, urgent: false });
  expect(service.createTask({ listId: 'work', title: 'Undated' }).urgent).toBe(false);
  expect(service.createTask({ listId: 'work', title: 'Today', dueDate: '2026-11-25' }).urgent).toBe(
    true,
  );
  expect(
    service.createTask({ listId: 'work', title: 'Overdue', dueDate: '2026-11-24' }).urgent,
  ).toBe(true);
  vi.setSystemTime(new Date(2026, 10, 26));
  expect(service.getTask('old')).toMatchObject({
    important: true,
    urgent: true,
    dueDate: '2026-11-26',
  });
});

it('retains both manual urgency choices across relaunch and restores automatic without changing stars', async () => {
  const db = await VNoteDatabase.open();
  const service = new TaskService(db);
  const waiting = service.createTask({ listId: 'work', title: 'Customer is waiting' });
  const delivery = service.createTask({
    listId: 'work',
    title: 'Delivery',
    important: true,
    dueDate: '2026-11-25',
    plannedStartDate: '2026-11-24',
    plannedEndDate: '2026-11-25',
  });
  service.updateTask(waiting.id, { important: true, urgencyOverride: 'urgent' });
  service.updateTask(delivery.id, { important: false, urgencyOverride: 'not-urgent' });
  db.flush();

  vi.setSystemTime(new Date(2026, 10, 27));
  const reopened = new TaskService(await VNoteDatabase.open());
  expect(reopened.getTask(waiting.id)).toMatchObject({
    important: true,
    urgent: true,
    urgencyOverride: 'urgent',
    dueDate: undefined,
  });
  expect(reopened.getTask(delivery.id)).toMatchObject({
    important: false,
    urgent: false,
    urgencyOverride: 'not-urgent',
    dueDate: '2026-11-25',
    plannedStartDate: '2026-11-24',
    plannedEndDate: '2026-11-25',
  });
  expect(reopened.updateTask(waiting.id, { urgencyOverride: null })).toMatchObject({
    important: true,
    urgent: false,
    urgencyOverride: undefined,
  });
  reopened.updateTask(delivery.id, { dueDate: '2026-11-26' });
  expect(reopened.updateTask(delivery.id, { urgencyOverride: null })).toMatchObject({
    important: false,
    urgent: true,
    dueDate: '2026-11-26',
    urgencyOverride: undefined,
  });
});
