export function migrate(db) {
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

    CREATE TABLE IF NOT EXISTS recurring_completions (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      completed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS recurring_completions_by_date ON recurring_completions(completed_at);

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

    CREATE TABLE IF NOT EXISTS ai_list_access (
      list_id TEXT PRIMARY KEY REFERENCES lists(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_url TEXT NOT NULL, model TEXT NOT NULL, encrypted_key TEXT,
      include_notes INTEGER NOT NULL DEFAULT 0
    );
  `);
    const columns = db.prepare('PRAGMA table_info(tasks)');
    const names = new Set();
    try {
        while (columns.step())
            names.add(String(columns.getAsObject().name));
    }
    finally {
        columns.free();
    }
    for (const column of ['planned_start_date', 'planned_end_date']) {
        if (!names.has(column))
            db.run(`ALTER TABLE tasks ADD COLUMN ${column} TEXT`);
    }
    if (!names.has('urgency_override')) {
        db.run("ALTER TABLE tasks ADD COLUMN urgency_override TEXT CHECK (urgency_override IN ('urgent', 'not-urgent'))");
    }
}
