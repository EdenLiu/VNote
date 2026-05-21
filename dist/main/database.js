import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import initSqlJs from "sql.js";
let sqlRuntime;
export class VNoteDatabase {
    db;
    dbPath;
    saveTimer;
    constructor(db, dbPath) {
        this.db = db;
        this.dbPath = dbPath;
    }
    static async open() {
        if (!sqlRuntime) {
            sqlRuntime = await initSqlJs({
                locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file)
            });
        }
        const dataDir = app.getPath("userData");
        fs.mkdirSync(dataDir, { recursive: true });
        const dbPath = path.join(dataDir, "vnote.sqlite");
        const db = fs.existsSync(dbPath)
            ? new sqlRuntime.Database(fs.readFileSync(dbPath))
            : new sqlRuntime.Database();
        const store = new VNoteDatabase(db, dbPath);
        store.migrate();
        store.seedDefaults();
        store.flush();
        return store;
    }
    run(sql, params = []) {
        this.db.run(sql, params);
        this.scheduleSave();
    }
    select(sql, params = []) {
        const statement = this.db.prepare(sql, params);
        const rows = [];
        try {
            while (statement.step())
                rows.push(statement.getAsObject());
        }
        finally {
            statement.free();
        }
        return rows;
    }
    transaction(work) {
        this.db.run("BEGIN TRANSACTION");
        try {
            work();
            this.db.run("COMMIT");
            this.scheduleSave();
        }
        catch (error) {
            this.db.run("ROLLBACK");
            throw error;
        }
    }
    flush() {
        fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
    }
    scheduleSave() {
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        // sql.js is in-memory; debounce export so rapid UI edits do not rewrite the whole DB on every keystroke.
        this.saveTimer = setTimeout(() => this.flush(), 150);
    }
    migrate() {
        this.db.run(`
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
    }
    seedDefaults() {
        const now = new Date().toISOString();
        if (Number(this.select("SELECT COUNT(*) count FROM lists")[0]?.count ?? 0) === 0) {
            for (const list of [
                ["inbox", "Tasks", "#2563eb"],
                ["work", "Work", "#0f766e"],
                ["personal", "Personal", "#7c3aed"]
            ]) {
                this.run("INSERT INTO lists VALUES (?, ?, ?, 1, ?)", [...list, now]);
            }
        }
        if (Number(this.select("SELECT COUNT(*) count FROM categories")[0]?.count ?? 0) === 0) {
            for (const category of [
                ["red", "Red", "#dc2626"],
                ["yellow", "Yellow", "#ca8a04"],
                ["green", "Green", "#16a34a"],
                ["blue", "Blue", "#2563eb"]
            ]) {
                this.run("INSERT INTO categories VALUES (?, ?, ?)", category);
            }
        }
    }
}
