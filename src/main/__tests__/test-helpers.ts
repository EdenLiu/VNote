import initSqlJs from "sql.js";

type Row = Record<string, string | number | null>;

export interface TestDb {
  select(sql: string, params?: unknown[]): Row[];
  run(sql: string, params?: unknown[]): void;
  transaction(work: () => void): void;
}

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSql() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export async function createTestDb(): Promise<TestDb> {
  const sql = await getSql();
  const db = new sql.Database();

  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      include_in_suggestions INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      important INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      reminder_at TEXT,
      repeat TEXT NOT NULL DEFAULT 'none',
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (task_id, tag)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      stored_path TEXT NOT NULL,
      mime_type TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS my_day (
      task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
      day TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  for (const list of [
    ["inbox", "Tasks", "#2563eb"],
    ["work", "Work", "#0f766e"],
    ["personal", "Personal", "#7c3aed"],
  ]) {
    db.run("INSERT INTO lists VALUES (?, ?, ?, 1, ?)", [...list, now]);
  }

  for (const category of [
    ["red", "Red", "#dc2626"],
    ["yellow", "Yellow", "#ca8a04"],
    ["green", "Green", "#16a34a"],
    ["blue", "Blue", "#2563eb"],
  ]) {
    db.run("INSERT INTO categories VALUES (?, ?, ?)", category);
  }

  return {
    select(query, params = []) {
      const stmt = db.prepare(query, params);
      const rows: Row[] = [];
      try {
        while (stmt.step()) rows.push(stmt.getAsObject());
      } finally {
        stmt.free();
      }
      return rows;
    },
    run(query, params = []) {
      db.run(query, params);
    },
    transaction(work) {
      db.run("BEGIN TRANSACTION");
      try {
        work();
        db.run("COMMIT");
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      }
    },
  };
}

export default createTestDb;
