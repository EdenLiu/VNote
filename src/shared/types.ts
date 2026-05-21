export type TaskPriority = "normal" | "important";
export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly";
export type SmartViewId = "my-day" | "suggestions" | "planned" | "important" | "flagged-email" | "completed";
export type ViewId = SmartViewId | `list:${string}`;

export interface TaskList {
  id: string;
  name: string;
  color: string;
  includeInSuggestions: boolean;
  createdAt: string;
}

export interface TaskListDraft {
  name: string;
  color?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Step {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
}

export interface Attachment {
  id: string;
  taskId: string;
  name: string;
  size: number;
  storedPath: string;
  mimeType?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  listId: string;
  title: string;
  completed: boolean;
  important: boolean;
  notes: string;
  dueDate?: string;
  reminderAt?: string;
  repeat: RepeatFrequency;
  categoryId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  source: "manual" | "email";
  tags: string[];
  steps: Step[];
  attachments: Attachment[];
  myDayDate?: string;
}

export interface TaskDraft {
  title: string;
  listId: string;
  dueDate?: string;
  reminderAt?: string;
  important?: boolean;
}

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
  myDayDate?: string | null;
}

export interface StepDraft {
  title: string;
}

export interface AppState {
  lists: TaskList[];
  categories: Category[];
  tasks: Task[];
  selectedTaskId?: string;
  activeView: ViewId;
}

export interface AttachmentResult {
  attachment: Attachment;
}

export interface VNoteApi {
  getState(): Promise<AppState>;
  createTask(draft: TaskDraft): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  createList(draft: TaskListDraft): Promise<TaskList>;
  addStep(taskId: string, draft: StepDraft): Promise<Step>;
  updateStep(id: string, patch: Partial<Pick<Step, "title" | "completed" | "sortOrder">>): Promise<Step>;
  deleteStep(id: string): Promise<void>;
  addAttachment(taskId: string): Promise<AttachmentResult | undefined>;
  removeAttachment(id: string): Promise<void>;
  openAttachment(id: string): Promise<void>;
  setListSuggestions(listId: string, enabled: boolean): Promise<TaskList>;
  refreshSuggestions(): Promise<Task[]>;
  addToMyDay(taskId: string, day?: string): Promise<Task>;
}

declare global {
  interface Window {
    vnote: VNoteApi;
  }
}
