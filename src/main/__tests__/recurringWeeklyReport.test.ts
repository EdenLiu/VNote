// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import initSqlJs from 'sql.js';
import { VNoteDatabase } from '../database';
import { TaskService } from '../taskService';

const electron = vi.hoisted(() => ({ getPath: vi.fn(), getAppPath: vi.fn() }));
vi.mock('electron', () => ({ app: electron }));

let directory: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vnote-recurrence-'));
  electron.getPath.mockReturnValue(directory);
  const require = createRequire(import.meta.url);
  electron.getAppPath.mockReturnValue(
    path.resolve(path.dirname(require.resolve('sql.js')), '../../..'),
  );
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 25, 9));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});

it('counts three completed occurrences under the original task and keeps its daily schedule active', async () => {
  const service = new TaskService(await VNoteDatabase.open());
  const task = service.createTask({ title: '巡检', listId: 'work', dueDate: '2026-11-23' });
  service.updateTask(task.id, { repeat: 'daily' });
  for (let i = 0; i < 3; i++) service.updateTask(task.id, { completed: true });

  expect(service.getWeeklyReport()).toEqual([
    {
      listId: 'work',
      listName: 'Work',
      tasks: [
        {
          taskId: task.id,
          title: '巡检',
          completionCount: 3,
          completedAt: new Date().toISOString(),
        },
      ],
    },
  ]);
  expect(service.getTask(task.id)).toMatchObject({
    dueDate: '2026-11-26',
    repeat: 'daily',
    completed: false,
  });
});

it('rolls back a failed save and persists both changes on retry before returning', async () => {
  const db = await VNoteDatabase.open();
  const service = new TaskService(db);
  const task = service.createTask({ title: 'Inspect', listId: 'work', dueDate: '2026-11-25' });
  service.updateTask(task.id, { repeat: 'weekly' });
  db.flush();

  vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
    throw new Error('Disk full');
  });
  expect(() => service.updateTask(task.id, { completed: true })).toThrow('Disk full');
  expect(service.getTask(task.id).dueDate).toBe('2026-11-25');
  expect(service.getWeeklyReport()).toEqual([]);
  const reopened = new TaskService(await VNoteDatabase.open());
  expect(reopened.getTask(task.id).dueDate).toBe('2026-11-25');
  expect(reopened.getWeeklyReport()).toEqual([]);

  reopened.updateTask(task.id, { completed: true });
  const retried = new TaskService(await VNoteDatabase.open());
  expect(retried.getTask(task.id)).toMatchObject({
    dueDate: '2026-12-02',
    completed: false,
    repeat: 'weekly',
  });
  expect(retried.getWeeklyReport()[0].tasks[0]).toMatchObject({
    taskId: task.id,
    completionCount: 1,
  });
});

it('upgrades a legacy schedule without inventing past completions and counts from local Monday through generation time', async () => {
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, list_id TEXT NOT NULL, title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0, important INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '', due_date TEXT, reminder_at TEXT,
      repeat TEXT NOT NULL DEFAULT 'none', category_id TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, completed_at TEXT, source TEXT NOT NULL DEFAULT 'manual'
    );
    INSERT INTO tasks (id, list_id, title, repeat, due_date, created_at, updated_at)
      VALUES ('old', 'work', '巡检', 'daily', '2026-11-22', '2026-11-01', '2026-11-21');
  `);
  fs.writeFileSync(path.join(directory, 'vnote.sqlite'), legacy.export());
  legacy.close();
  vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 59, 999));
  const service = new TaskService(await VNoteDatabase.open());
  expect(service.getWeeklyReport()).toEqual([]);
  service.updateTask('old', { completed: true });
  expect(service.getWeeklyReport()[0].tasks[0].completionCount).toBe(1);

  vi.setSystemTime(new Date(2026, 10, 23));
  expect(service.getWeeklyReport()).toEqual([]);
  service.updateTask('old', { completed: true });
  const single = service.createTask({ title: 'One-off', listId: 'inbox' });
  service.updateTask(single.id, { completed: true });
  vi.setSystemTime(new Date(2026, 10, 24, 12));
  service.updateTask('old', { completed: true });
  vi.setSystemTime(new Date(2026, 10, 25, 12));
  service.updateTask('old', { completed: true });

  const reopened = new TaskService(await VNoteDatabase.open());
  expect(reopened.getWeeklyReport()).toMatchObject([
    { listId: 'inbox', tasks: [{ taskId: single.id, title: 'One-off' }] },
    { listId: 'work', tasks: [{ taskId: 'old', completionCount: 3 }] },
  ]);
  expect(reopened.getTask('old')).toMatchObject({ repeat: 'daily', dueDate: '2026-11-26' });
  vi.setSystemTime(new Date(2026, 10, 23));
  expect(reopened.getWeeklyReport()[1].tasks[0].completionCount).toBe(1);
});
