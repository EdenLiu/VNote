import { migrate } from '../schema.js';
import initSqlJs from 'sql.js';

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

  migrate(db);

  const now = new Date().toISOString();
  for (const list of [
    ['inbox', 'Tasks', '#2563eb'],
    ['work', 'Work', '#0f766e'],
    ['personal', 'Personal', '#7c3aed'],
  ]) {
    db.run('INSERT INTO lists VALUES (?, ?, ?, 1, ?)', [...list, now]);
  }

  for (const category of [
    ['red', 'Red', '#dc2626'],
    ['yellow', 'Yellow', '#ca8a04'],
    ['green', 'Green', '#16a34a'],
    ['blue', 'Blue', '#2563eb'],
  ]) {
    db.run('INSERT INTO categories VALUES (?, ?, ?)', category);
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
      db.run('BEGIN TRANSACTION');
      try {
        work();
        db.run('COMMIT');
      } catch (e) {
        db.run('ROLLBACK');
        throw e;
      }
    },
  };
}

export default createTestDb;
