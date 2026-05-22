/** Priority level for a task — "important" is the starred/flagged state. */
export type TaskPriority = "normal" | "important";

/** Recurrence cadence for repeating tasks. */
export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly";

/** Built-in system views that are always present. */
export type SmartViewId = "my-day" | "suggestions" | "planned" | "important" | "flagged-email" | "completed";

/** Union of system views and user-created lists (prefixed with "list:"). */
export type ViewId = SmartViewId | `list:${string}`;

/** A user-created task list (e.g. "Work", "Personal"). */
export interface TaskList {
  /** Unique identifier. */
  id: string;
  /** Display name shown in the sidebar. */
  name: string;
  /** Accent color as a CSS hex string (e.g. "#2563eb"). */
  color: string;
  /** Whether tasks from this list appear in the Suggestions smart view. */
  includeInSuggestions: boolean;
  /** ISO-8601 timestamp of creation. */
  createdAt: string;
}

/** Payload for creating a new task list. */
export interface TaskListDraft {
  name: string;
  color?: string;
}

/** Payload for updating an existing list's properties. */
export interface TaskListPatch {
  name?: string;
  color?: string;
  includeInSuggestions?: boolean;
}

/** A color-coded category label (e.g. Red, Yellow, Green, Blue). */
export interface Category {
  id: string;
  name: string;
  color: string;
}

/** A sub-task / checklist item belonging to a parent task. */
export interface Step {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  /** Display order within the parent task's step list. */
  sortOrder: number;
}

/** A file attached to a task (max 25 MB). */
export interface Attachment {
  id: string;
  taskId: string;
  /** Original filename. */
  name: string;
  /** File size in bytes. */
  size: number;
  /** Absolute path to the stored copy on disk. */
  storedPath: string;
  mimeType?: string;
  createdAt: string;
}

/** A single task — the core domain entity. */
export interface Task {
  id: string;
  /** ID of the parent TaskList. */
  listId: string;
  title: string;
  completed: boolean;
  /** Starred / flagged as important. */
  important: boolean;
  /** Rich-text or plain-text notes. */
  notes: string;
  /** ISO-8601 date string (YYYY-MM-DD). */
  dueDate?: string;
  /** ISO-8601 datetime string for an independent reminder. */
  reminderAt?: string;
  repeat: RepeatFrequency;
  /** Reference to a Category for color-coded classification. */
  categoryId?: string;
  createdAt: string;
  updatedAt: string;
  /** Timestamp when the task was marked completed. */
  completedAt?: string;
  /** Origin — "manual" for user-created tasks, "email" for flagged emails. */
  source: "manual" | "email";
  /** Lowercase hashtags extracted from the title (e.g. "#urgent" → "urgent"). */
  tags: string[];
  steps: Step[];
  attachments: Attachment[];
  /** ISO-8601 date string indicating the task was added to My Day for this date. */
  myDayDate?: string;
}

/** Required fields for creating a new task. */
export interface TaskDraft {
  title: string;
  listId: string;
  dueDate?: string;
  reminderAt?: string;
  important?: boolean;
}

/** Partial update payload — only the fields that should change. */
export interface TaskPatch {
  title?: string;
  listId?: string;
  completed?: boolean;
  important?: boolean;
  notes?: string;
  dueDate?: string | null;
  reminderAt?: string | null;
  repeat?: RepeatFrequency;
  categoryId?: string | null;
  tags?: string[];
  /** Set to today's date to add to My Day, or null to remove. */
  myDayDate?: string | null;
}

/** Payload for creating a step. */
export interface StepDraft {
  title: string;
}

/** Full application state returned by the main process on load. */
export interface AppState {
  lists: TaskList[];
  categories: Category[];
  tasks: Task[];
  selectedTaskId?: string;
  activeView: ViewId;
}

/** Result wrapper for the attachment-add IPC call. */
export interface AttachmentResult {
  attachment: Attachment;
}

/**
 * Typed API surface exposed to the renderer via contextBridge.
 * Every method maps to an IPC handler in the main process.
 */
export interface VNoteApi {
  /** Fetch the full application state (lists, categories, tasks). */
  getState(): Promise<AppState>;
  /** Create a new task and return it with all server-generated fields. */
  createTask(draft: TaskDraft): Promise<Task>;
  /** Apply a partial update to an existing task. */
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  /** Permanently delete a task and its children (steps, attachments, tags). */
  deleteTask(id: string): Promise<void>;
  /** Create a new user list. */
  createList(draft: TaskListDraft): Promise<TaskList>;
  /** Update a list's name, color, or suggestion setting. */
  updateList(id: string, patch: TaskListPatch): Promise<TaskList>;
  /** Permanently delete a list. Tasks belonging to the list are NOT deleted. */
  deleteList(id: string): Promise<void>;
  /** Add a sub-task to an existing task. */
  addStep(taskId: string, draft: StepDraft): Promise<Step>;
  /** Update a step's title, completion, or sort order. */
  updateStep(id: string, patch: Partial<Pick<Step, "title" | "completed" | "sortOrder">>): Promise<Step>;
  /** Remove a step from its parent task. */
  deleteStep(id: string): Promise<void>;
  /** Open a native file picker, copy the file, and attach it to the task. */
  addAttachment(taskId: string): Promise<AttachmentResult | undefined>;
  /** Delete an attachment record and its file on disk. */
  removeAttachment(id: string): Promise<void>;
  /** Open the attached file with the system default application. */
  openAttachment(id: string): Promise<void>;
  /** Enable or disable suggestions for a specific list. */
  setListSuggestions(listId: string, enabled: boolean): Promise<TaskList>;
  /** Recompute and return the top suggestion candidates. */
  refreshSuggestions(): Promise<Task[]>;
  /** Add a task to My Day for the given date (defaults to today). */
  addToMyDay(taskId: string, day?: string): Promise<Task>;
}

declare global {
  interface Window {
    vnote: VNoteApi;
  }
}
