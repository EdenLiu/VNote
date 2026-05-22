# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server (renderer only, http://127.0.0.1:5173)
npm run dev:electron     # Full Electron app in dev mode (builds main, waits for Vite, then launches)
npm run build            # Production build: renderer (Vite) + main (tsc)
npm run build:renderer   # Vite build only → dist/renderer/
npm run build:main       # tsc build only (main + preload) → dist/
npm run typecheck        # TypeScript check for both renderer and main
npm run test             # Vitest runner
```

## Architecture

```
src/
├── shared/          # Types & IPC channel constants — single source of truth for both processes
│   ├── types.ts         # All domain types (Task, TaskList, Category, Step, Attachment, VNoteApi, etc.)
│   └── electron-api.ts  # IPC channel name constants (ELECTRON_CHANNELS)
├── main/            # Electron main process — Node.js, no DOM
│   ├── main.ts          # App entry: window creation, IPC handler registration
│   ├── database.ts      # sql.js wrapper (in-memory SQLite, debounced flush to disk)
│   ├── taskService.ts   # All business logic: CRUD for tasks/lists/steps, suggestions engine, My Day
│   ├── attachments.ts   # File picker + 25 MB limit + disk copy
│   └── reminders.ts     # 30s poll loop checking reminderAt against Date.now()
├── preload/         # contextBridge exposing typed VNoteApi to renderer
│   └── preload.ts
└── renderer/        # React 19 UI — Vite-bundled, no Node access
    ├── main.tsx         # React DOM entry
    ├── App.tsx          # Root layout: sidebar + main pane + detail pane, wires all components
    ├── styles.css       # Global CSS (Microsoft To Do-inspired design language)
    ├── hooks/
    │   └── useVNote.ts  # Central hook: state, API wrappers with auto-reload + error handling
    └── components/
        ├── common/          # EmptyState, ErrorBanner
        ├── sidebar/         # BrandHeader, SmartViewsNav, ListsSection, Sidebar
        ├── tasklist/        # TaskRow, QuickAddBar, TaskList
        └── detail/          # DetailPane + DetailHeader/Title/Fields + Notes/Steps/Attachments/Meta sections
```

## IPC flow

```
Renderer (React) → window.vnote.*() → preload ipcRenderer.invoke → ipcMain.handle → TaskService → sql.js
```

- The renderer never speaks to the main process directly — only through the typed `VNoteApi` interface.
- Every API call in `useVNote` follows the pattern: try → call API → `load()` to refresh state → catch → set error.
- `app.whenReady()` opens the DB, creates `TaskService`, registers all IPC handlers, and starts the ReminderScheduler.

## Key patterns

- **sql.js is in-memory**: the DB lives in RAM and is flushed to `userData/vnote.sqlite` on a 150ms debounce after every write. `db.transaction()` wraps multi-statement writes with BEGIN/COMMIT/ROLLBACK.
- **Tags are auto-extracted** from `#hashtag` in task titles (Unicode-aware regex) on create/update. They can also be manually added/removed via `MetaSection`.
- **Repeating tasks**: when a repeat task is checked off, `dueDate` and `reminderAt` automatically advance to the next period rather than marking the task complete.
- **Suggestions scoring**: heuristic ranks uncompleted tasks not already in My Day — overweight due (90), due today (75), important (35), has reminder (15), recent (8). Caps at 12 results.
- **My Day**: stored in `my_day` table keyed by task_id + date string. The `My Day` smart view filters by today's date.

## Conventions

- 2-space indentation, semicolons, ES modules, `strict` TypeScript
- `PascalCase` for components, `camelCase` for functions/variables/IPC handlers
- Shared types go in `src/shared/`, never duplicated across processes
- CSS: single global `styles.css` (no CSS modules) — class-based, BEM-lite naming
- IPC channels are string constants in `ELECTRON_CHANNELS` — never hardcoded strings in main or preload
