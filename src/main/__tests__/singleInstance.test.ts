// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  lock: vi.fn(),
  quit: vi.fn(),
  ready: vi.fn(async () => {}),
  events: new Map<string, () => void>(),
  open: vi.fn(async () => ({ select: () => [] })),
  handle: vi.fn(),
  windows: vi.fn(),
  load: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: runtime.lock,
    whenReady: runtime.ready,
    quit: runtime.quit,
    on: (event: string, listener: () => void) => runtime.events.set(event, listener),
  },
  BrowserWindow: class {
    static getAllWindows = runtime.windows;
    loadFile = runtime.load;
    loadURL = runtime.load;
  },
  ipcMain: { handle: runtime.handle },
  safeStorage: {},
}));
vi.mock('../database.js', () => ({ VNoteDatabase: { open: runtime.open } }));
vi.mock('../reminders.js', () => ({
  ReminderScheduler: class {
    start() {}
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  runtime.events.clear();
  runtime.windows.mockReturnValue([]);
});

it('quits a second process before it can load the database or serve IPC', async () => {
  runtime.lock.mockReturnValue(false);
  await import('../main.js');
  expect(runtime.quit).toHaveBeenCalledOnce();
  expect(runtime.open).not.toHaveBeenCalled();
  expect(runtime.handle).not.toHaveBeenCalled();
  expect(runtime.load).not.toHaveBeenCalled();
});

it('restores and focuses the primary window when another launch requests it', async () => {
  runtime.lock.mockReturnValue(true);
  await import('../main.js');
  expect(runtime.load).toHaveBeenCalledOnce();
  const existing = { isMinimized: () => true, restore: vi.fn(), show: vi.fn(), focus: vi.fn() };
  runtime.windows.mockReturnValue([existing]);
  runtime.events.get('second-instance')!();
  expect(existing.restore).toHaveBeenCalledOnce();
  expect(existing.focus).toHaveBeenCalledOnce();
  expect(runtime.load).toHaveBeenCalledOnce();
  expect(runtime.open).toHaveBeenCalledOnce();
});
