const todayKey = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const extractTags = (text) => Array.from(new Set((text.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map((tag) => tag.slice(1).toLowerCase())));
const addRepeatPeriod = (value, repeat) => {
    if (!value || repeat === "none")
        return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return value;
    if (repeat === "daily")
        date.setDate(date.getDate() + 1);
    if (repeat === "weekly")
        date.setDate(date.getDate() + 7);
    if (repeat === "monthly")
        date.setMonth(date.getMonth() + 1);
    return value.length <= 10 ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 16);
};
export class TaskService {
    db;
    constructor(db) {
        this.db = db;
    }
    getState() {
        return {
            lists: this.getLists(),
            categories: this.getCategories(),
            tasks: this.getTasks(),
            activeView: "my-day"
        };
    }
    getLists() {
        return this.db.select("SELECT * FROM lists ORDER BY created_at ASC").map(mapList);
    }
    createList(draft) {
        const list = {
            id: newId(),
            name: draft.name.trim() || "Untitled list",
            color: draft.color ?? "#2563eb",
            includeInSuggestions: true,
            createdAt: nowIso()
        };
        this.db.run("INSERT INTO lists VALUES (?, ?, ?, ?, ?)", [
            list.id,
            list.name,
            list.color,
            1,
            list.createdAt
        ]);
        return list;
    }
    setListSuggestions(listId, enabled) {
        this.db.run("UPDATE lists SET include_in_suggestions = ? WHERE id = ?", [enabled ? 1 : 0, listId]);
        const list = this.getLists().find((item) => item.id === listId);
        if (!list)
            throw new Error("List not found");
        return list;
    }
    /** Update a list's name, color, and/or suggestion preference. */
    updateList(listId, patch) {
        const current = this.getLists().find((item) => item.id === listId);
        if (!current)
            throw new Error("List not found");
        this.db.run("UPDATE lists SET name = ?, color = ?, include_in_suggestions = ? WHERE id = ?", [
            patch.name ?? current.name,
            patch.color ?? current.color,
            patch.includeInSuggestions !== undefined ? (patch.includeInSuggestions ? 1 : 0) : (current.includeInSuggestions ? 1 : 0),
            listId
        ]);
        const updated = this.getLists().find((item) => item.id === listId);
        if (!updated)
            throw new Error("List not found after update");
        return updated;
    }
    /**
     * Permanently delete a list. Tasks in the list are reassigned to the inbox
     * (the first list) before the list is removed, so no tasks are orphaned.
     */
    deleteList(listId) {
        const lists = this.getLists();
        if (lists.length <= 1)
            throw new Error("Cannot delete the last list");
        const inbox = lists[0];
        this.db.transaction(() => {
            this.db.run("UPDATE tasks SET list_id = ? WHERE list_id = ?", [inbox.id, listId]);
            this.db.run("DELETE FROM lists WHERE id = ?", [listId]);
        });
    }
    getCategories() {
        return this.db.select("SELECT * FROM categories ORDER BY name ASC").map((row) => ({
            id: String(row.id),
            name: String(row.name),
            color: String(row.color)
        }));
    }
    getTasks() {
        return this.db
            .select("SELECT t.*, md.day my_day_date FROM tasks t LEFT JOIN my_day md ON md.task_id = t.id ORDER BY t.created_at DESC")
            .map((row) => this.mapTask(row));
    }
    getTask(taskId) {
        const row = this.db.select("SELECT t.*, md.day my_day_date FROM tasks t LEFT JOIN my_day md ON md.task_id = t.id WHERE t.id = ?", [taskId])[0];
        if (!row)
            throw new Error("Task not found");
        return this.mapTask(row);
    }
    createTask(draft) {
        const taskId = newId();
        const timestamp = nowIso();
        const title = draft.title.trim() || "Untitled task";
        this.db.transaction(() => {
            this.db.run(`INSERT INTO tasks
          (id, list_id, title, completed, important, notes, due_date, reminder_at, repeat, category_id, created_at, updated_at, completed_at, source)
         VALUES (?, ?, ?, 0, ?, '', ?, ?, 'none', NULL, ?, ?, NULL, 'manual')`, [
                taskId,
                draft.listId,
                title,
                draft.important ? 1 : 0,
                draft.dueDate ?? null,
                draft.reminderAt ?? null,
                timestamp,
                timestamp
            ]);
            for (const tag of extractTags(title))
                this.db.run("INSERT OR IGNORE INTO task_tags VALUES (?, ?)", [taskId, tag]);
        });
        return this.getTask(taskId);
    }
    updateTask(taskId, patch) {
        const current = this.getTask(taskId);
        const completed = patch.completed ?? current.completed;
        const repeat = patch.repeat ?? current.repeat;
        const completingRepeat = !current.completed && completed && repeat !== "none";
        // Repeating tasks stay active and jump to the next due/reminder time when checked off.
        const dueDate = patch.dueDate === null ? undefined : addRepeatPeriod(patch.dueDate ?? current.dueDate, completingRepeat ? repeat : "none");
        const reminderAt = patch.reminderAt === null
            ? undefined
            : addRepeatPeriod(patch.reminderAt ?? current.reminderAt, completingRepeat ? repeat : "none");
        const next = {
            title: patch.title ?? current.title,
            listId: patch.listId ?? current.listId,
            completed: completingRepeat ? false : completed,
            important: patch.important ?? current.important,
            notes: patch.notes ?? current.notes,
            dueDate,
            reminderAt,
            repeat,
            categoryId: patch.categoryId === null ? undefined : patch.categoryId ?? current.categoryId,
            completedAt: completingRepeat ? undefined : completed ? current.completedAt ?? nowIso() : undefined,
            tags: patch.tags ?? extractTags(`${patch.title ?? current.title} ${patch.notes ?? current.notes}`)
        };
        this.db.transaction(() => {
            this.db.run(`UPDATE tasks SET
          list_id = ?, title = ?, completed = ?, important = ?, notes = ?, due_date = ?, reminder_at = ?,
          repeat = ?, category_id = ?, updated_at = ?, completed_at = ?
         WHERE id = ?`, [
                next.listId,
                next.title.trim() || "Untitled task",
                next.completed ? 1 : 0,
                next.important ? 1 : 0,
                next.notes,
                next.dueDate ?? null,
                next.reminderAt ?? null,
                next.repeat,
                next.categoryId ?? null,
                nowIso(),
                next.completedAt ?? null,
                taskId
            ]);
            this.db.run("DELETE FROM task_tags WHERE task_id = ?", [taskId]);
            for (const tag of next.tags)
                this.db.run("INSERT OR IGNORE INTO task_tags VALUES (?, ?)", [taskId, tag]);
            if (patch.myDayDate === null)
                this.db.run("DELETE FROM my_day WHERE task_id = ?", [taskId]);
            if (patch.myDayDate)
                this.db.run("INSERT OR REPLACE INTO my_day VALUES (?, ?)", [taskId, patch.myDayDate]);
        });
        return this.getTask(taskId);
    }
    deleteTask(taskId) {
        this.db.run("DELETE FROM tasks WHERE id = ?", [taskId]);
    }
    addToMyDay(taskId, day = todayKey()) {
        this.db.run("INSERT OR REPLACE INTO my_day VALUES (?, ?)", [taskId, day]);
        return this.getTask(taskId);
    }
    addStep(taskId, draft) {
        const sortOrder = Number(this.db.select("SELECT COALESCE(MAX(sort_order), -1) + 1 next_order FROM steps WHERE task_id = ?", [taskId])[0]
            ?.next_order ?? 0);
        const step = { id: newId(), taskId, title: draft.title.trim() || "Untitled step", completed: false, sortOrder };
        this.db.run("INSERT INTO steps VALUES (?, ?, ?, 0, ?)", [step.id, step.taskId, step.title, step.sortOrder]);
        return step;
    }
    updateStep(stepId, patch) {
        const row = this.db.select("SELECT * FROM steps WHERE id = ?", [stepId])[0];
        if (!row)
            throw new Error("Step not found");
        const step = {
            id: stepId,
            taskId: String(row.task_id),
            title: patch.title ?? String(row.title),
            completed: patch.completed ?? Boolean(row.completed),
            sortOrder: patch.sortOrder ?? Number(row.sort_order)
        };
        this.db.run("UPDATE steps SET title = ?, completed = ?, sort_order = ? WHERE id = ?", [
            step.title,
            step.completed ? 1 : 0,
            step.sortOrder,
            step.id
        ]);
        return step;
    }
    deleteStep(stepId) {
        this.db.run("DELETE FROM steps WHERE id = ?", [stepId]);
    }
    createAttachment(taskId, file) {
        const attachment = {
            id: newId(),
            taskId,
            name: file.name,
            size: file.size,
            storedPath: file.storedPath,
            mimeType: file.mimeType,
            createdAt: nowIso()
        };
        this.db.run("INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?, ?)", [
            attachment.id,
            attachment.taskId,
            attachment.name,
            attachment.size,
            attachment.storedPath,
            attachment.mimeType ?? null,
            attachment.createdAt
        ]);
        return attachment;
    }
    getAttachment(attachmentId) {
        const row = this.db.select("SELECT * FROM attachments WHERE id = ?", [attachmentId])[0];
        if (!row)
            throw new Error("Attachment not found");
        return mapAttachment(row);
    }
    removeAttachment(attachmentId) {
        this.db.run("DELETE FROM attachments WHERE id = ?", [attachmentId]);
    }
    getSuggestions() {
        const today = todayKey();
        const lists = new Map(this.getLists().map((list) => [list.id, list]));
        // Local heuristic keeps the MVP private/offline while still surfacing actionable work.
        return this.getTasks()
            .filter((task) => !task.completed && task.myDayDate !== today && lists.get(task.listId)?.includeInSuggestions !== false)
            .map((task) => ({
            task,
            score: (task.dueDate && task.dueDate < today ? 90 : 0) +
                (task.dueDate === today ? 75 : 0) +
                (task.important ? 35 : 0) +
                (task.reminderAt ? 15 : 0) +
                (Date.now() - new Date(task.createdAt).getTime() < 3 * 86400000 ? 8 : 0)
        }))
            .sort((a, b) => b.score - a.score || a.task.createdAt.localeCompare(b.task.createdAt))
            .slice(0, 12)
            .map((item) => item.task);
    }
    mapTask(row) {
        const taskId = String(row.id);
        return {
            id: taskId,
            listId: String(row.list_id),
            title: String(row.title),
            completed: Boolean(row.completed),
            important: Boolean(row.important),
            notes: String(row.notes ?? ""),
            dueDate: row.due_date ? String(row.due_date) : undefined,
            reminderAt: row.reminder_at ? String(row.reminder_at) : undefined,
            repeat: String(row.repeat),
            categoryId: row.category_id ? String(row.category_id) : undefined,
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
            completedAt: row.completed_at ? String(row.completed_at) : undefined,
            source: String(row.source) === "email" ? "email" : "manual",
            tags: this.db.select("SELECT tag FROM task_tags WHERE task_id = ? ORDER BY tag ASC", [taskId]).map((tag) => String(tag.tag)),
            steps: this.db.select("SELECT * FROM steps WHERE task_id = ? ORDER BY sort_order ASC", [taskId]).map(mapStep),
            attachments: this.db.select("SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC", [taskId]).map(mapAttachment),
            myDayDate: row.my_day_date ? String(row.my_day_date) : undefined
        };
    }
}
const mapList = (row) => ({
    id: String(row.id),
    name: String(row.name),
    color: String(row.color),
    includeInSuggestions: Boolean(row.include_in_suggestions),
    createdAt: String(row.created_at)
});
const mapStep = (row) => ({
    id: String(row.id),
    taskId: String(row.task_id),
    title: String(row.title),
    completed: Boolean(row.completed),
    sortOrder: Number(row.sort_order)
});
const mapAttachment = (row) => ({
    id: String(row.id),
    taskId: String(row.task_id),
    name: String(row.name),
    size: Number(row.size),
    storedPath: String(row.stored_path),
    mimeType: row.mime_type ? String(row.mime_type) : undefined,
    createdAt: String(row.created_at)
});
