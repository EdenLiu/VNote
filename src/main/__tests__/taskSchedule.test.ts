// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { afterEach, expect, it, vi } from 'vitest';
import { app } from 'electron';
import { VNoteDatabase } from '../database.js';
import { TaskService } from '../taskService.js';
import { createTestDb } from './test-helpers.js';

vi.mock('electron', () => ({ app: { getPath: vi.fn(), getAppPath: vi.fn() } }));

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('creates a task with a partial plan independently of its deadline', async () => {
  const service = new TaskService((await createTestDb()) as unknown as VNoteDatabase);
  const review = service.createTask({
    title: 'Review',
    listId: 'work',
    plannedEndDate: '2026-11-24',
  });
  expect(service.getTask(review.id).plannedEndDate).toBe('2026-11-24');
  expect(review.plannedStartDate).toBeUndefined();
  expect(review.dueDate).toBeUndefined();
});

it('retains a legacy deadline and persists independently edited plan dates across reopening', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const folder = mkdtempSync(path.join(tmpdir(), 'vnote-schedule-'));
  const require = createRequire(import.meta.url);
  vi.mocked(app.getPath).mockReturnValue(folder);
  vi.mocked(app.getAppPath).mockReturnValue(path.resolve(require.resolve('sql.js'), '../../../..'));
  try {
    const SQL = await initSqlJs();
    const legacy = new SQL.Database();
    legacy.run(`
      CREATE TABLE lists (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
        include_in_suggestions INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
      INSERT INTO lists VALUES ('work', 'Work', '#123456', 1, '2026-10-01');
      CREATE TABLE tasks (id TEXT PRIMARY KEY, list_id TEXT NOT NULL REFERENCES lists(id),
        title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, important INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '', due_date TEXT, reminder_at TEXT, repeat TEXT NOT NULL DEFAULT 'none',
        category_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT,
        source TEXT NOT NULL DEFAULT 'manual');
      INSERT INTO tasks (id, list_id, title, due_date, important, created_at, updated_at)
        VALUES ('design', 'work', 'Design', '2026-11-27', 1, '2026-10-01', '2026-10-01');
    `);
    writeFileSync(path.join(folder, 'vnote.sqlite'), legacy.export());

    const store = await VNoteDatabase.open();
    const service = new TaskService(store);
    expect(service.getTask('design')).toMatchObject({ dueDate: '2026-11-27', important: true });
    expect(service.getTask('design').plannedStartDate).toBeUndefined();
    expect(service.updateTask('design', { plannedStartDate: '2026-11-23' }).plannedStartDate).toBe(
      '2026-11-23',
    );
    service.updateTask('design', { plannedEndDate: '2026-11-25' });
    service.updateTask('design', { dueDate: '2026-11-24' });
    store.flush();
    const reopened = new TaskService(await VNoteDatabase.open());
    expect(reopened.getTask('design')).toMatchObject({
      plannedStartDate: '2026-11-23',
      plannedEndDate: '2026-11-25',
      dueDate: '2026-11-24',
    });
    expect(
      reopened.updateTask('design', { plannedStartDate: null }).plannedStartDate,
    ).toBeUndefined();
    expect(reopened.getTask('design').plannedEndDate).toBe('2026-11-25');
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
