import { migrate } from './schema.js';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import initSqlJs from 'sql.js';
let sqlRuntime;
export class VNoteDatabase {
    db;
    dbPath;
    saveTimer;
    inTransaction = false;
    constructor(db, dbPath) {
        this.db = db;
        this.dbPath = dbPath;
    }
    static async open() {
        if (!sqlRuntime) {
            sqlRuntime = await initSqlJs({
                locateFile: (file) => path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', file),
            });
        }
        const dataDir = app.getPath('userData');
        fs.mkdirSync(dataDir, { recursive: true });
        const dbPath = path.join(dataDir, 'vnote.sqlite');
        const db = fs.existsSync(dbPath)
            ? new sqlRuntime.Database(fs.readFileSync(dbPath))
            : new sqlRuntime.Database();
        const store = new VNoteDatabase(db, dbPath);
        migrate(db);
        store.seedDefaults();
        store.flush();
        return store;
    }
    run(sql, params = []) {
        this.db.run(sql, params);
        if (!this.inTransaction)
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
    transaction(work, saveImmediately = false) {
        // sql.js commits in memory. Keep a save point for a subsequent disk write failure.
        const before = saveImmediately ? this.exportDatabase() : undefined;
        this.db.run('BEGIN TRANSACTION');
        this.inTransaction = true;
        try {
            work();
            this.db.run('COMMIT');
        }
        catch (error) {
            this.db.run('ROLLBACK');
            throw error;
        }
        finally {
            this.inTransaction = false;
        }
        if (before) {
            try {
                this.flush();
            }
            catch (error) {
                this.db.close();
                this.db = new sqlRuntime.Database(before);
                this.db.run('PRAGMA foreign_keys = ON');
                throw error;
            }
        }
        else {
            this.scheduleSave();
        }
    }
    exportDatabase() {
        // sql.js reopens its connection during export, resetting connection-local pragmas.
        const data = this.db.export();
        this.db.run('PRAGMA foreign_keys = ON');
        return data;
    }
    flush() {
        const temporary = this.dbPath + '.' + process.pid + '.tmp';
        try {
            fs.writeFileSync(temporary, this.exportDatabase(), { flush: true });
            fs.renameSync(temporary, this.dbPath);
        }
        catch (error) {
            fs.rmSync(temporary, { force: true });
            throw error;
        }
        clearTimeout(this.saveTimer);
        this.saveTimer = undefined;
    }
    scheduleSave() {
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        // sql.js is in-memory; debounce export so rapid UI edits do not rewrite the whole DB on every keystroke.
        this.saveTimer = setTimeout(() => this.flush(), 150);
    }
    seedDefaults() {
        const now = new Date().toISOString();
        if (Number(this.select('SELECT COUNT(*) count FROM lists')[0]?.count ?? 0) === 0) {
            for (const list of [
                ['inbox', 'Tasks', '#2563eb'],
                ['work', 'Work', '#0f766e'],
                ['personal', 'Personal', '#7c3aed'],
            ]) {
                this.run('INSERT INTO lists VALUES (?, ?, ?, 1, ?)', [...list, now]);
            }
        }
        if (Number(this.select('SELECT COUNT(*) count FROM categories')[0]?.count ?? 0) === 0) {
            for (const category of [
                ['red', 'Red', '#dc2626'],
                ['yellow', 'Yellow', '#ca8a04'],
                ['green', 'Green', '#16a34a'],
                ['blue', 'Blue', '#2563eb'],
            ]) {
                this.run('INSERT INTO categories VALUES (?, ?, ?)', category);
            }
        }
    }
}
