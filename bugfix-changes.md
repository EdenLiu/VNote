# Bugfix: TypeError reading createTask

## Problem

Clicking the "Add a task" button caused:

```text
TypeError: Cannot read properties of undefined (reading 'createTask')
```

## Root Cause

`window.vnote` is created by the preload script via:

```ts
contextBridge.exposeInMainWorld("vnote", api);
```

The preload script is emitted as ESM because this project uses `"type": "module"` and `tsconfig.main.json` uses `"module": "NodeNext"`.

Electron requires `webPreferences.preload` to be an absolute file path. A `file://` URL is rejected. With the default Electron renderer sandbox enabled, the ESM preload is parsed as a non-module script and fails with:

```text
SyntaxError: Cannot use import statement outside a module
```

When preload fails, `window.vnote` remains `undefined`, so `window.vnote.createTask(...)` crashes when creating a task.

## Fix

`src/main/main.ts` now keeps the preload as an absolute file path and explicitly disables renderer sandboxing so the ESM preload can execute. The renderer still has `contextIsolation: true` and `nodeIntegration: false`.

```ts
webPreferences: {
  preload: path.join(__dirname, "../preload/preload.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false
}
```

---

# Bugfix: Remove "Flagged email" smart view (Issue #5)

## Problem

The left sidebar menu showed a "Flagged email" smart view, but this app cannot connect to Outlook, so the view could never show any tasks. It was dead UI.

## Fix

Removed the `flagged-email` smart view entirely:

- `src/shared/types.ts` — removed `'flagged-email'` from the `SmartViewId` union so no code can reference the view anymore (type-level removal).
- `src/renderer/App.tsx` — removed the `'flagged-email'` entry from `VIEW_LABELS` (toolbar title lookup).
- `src/renderer/components/sidebar/SmartViewsNav.tsx` — removed the `'flagged-email'` entry from `VIEW_LABELS`, which drives the sidebar rendering (`Object.keys(VIEW_LABELS)`), so the menu item no longer appears.

Verified with `npm run typecheck` and `npm run test` (95 tests pass).

---

# Feature: Weekly Report (Issue #6)

## Problem

Issue #6 requested a "Weekly Report" button: gather tasks **completed this week**, group them
**by project (task list)**, and produce a report like:

```
Project Name:
- task 1
- task 2

Project Name 2:
- task 1
- task 2
```

"this week" is defined as **Monday 00:00 (local time) → now**.

## Implementation

### Main process (`TaskService`)

- New `getWeeklyReport(): WeeklyReportGroup[]` in `src/main/taskService.ts`:
  - Computes the local-time week boundary with `startOfWeek()` (DST-safe component constructor).
  - Filters tasks where `completedAt` exists and `weekStart <= completedAt <= now`
    (UTC ISO timestamps converted to local time for comparison — a UTC string comparison
    would be wrong for users in negative offsets).
  - Groups by `listId` in list-creation order (same order as the sidebar), tasks within a
    group sorted by completion time (oldest first). Empty groups are omitted.
- IPC wiring: new `reports.weekly` channel constant in `ELECTRON_CHANNELS`
  (`src/shared/electron-api.ts`), handler registered in `src/main/main.ts`, exposed in
  `src/preload/preload.ts`.

### Shared types (`src/shared/types.ts`)

- `WeeklyReportTask { title, completedAt }` and
  `WeeklyReportGroup { listId, listName, tasks }`.
- `VNoteApi.getWeeklyReport(): Promise<WeeklyReportGroup[]>`.

### Renderer

- `src/renderer/hooks/useVNote.ts`: read-only `getWeeklyReport` wrapper (try → api →
  setError; no `load()` since it does not mutate app state).
- New `src/renderer/components/common/WeeklyReportModal.tsx`:
  - Exported pure function `formatWeeklyReport()` produces the copy-ready text
    (`Project:\n- task\n- task` blocks separated by blank lines) — used by both the modal
    display and the clipboard, so the two never drift.
  - Modal states: loading / error / empty ("No tasks completed this week.") / report.
  - "Copy to clipboard" button (`navigator.clipboard.writeText`) with a "Copied!"
    confirmation; closes on Escape, close button, or overlay click.
- `src/renderer/App.tsx`: "Weekly Report" button (with `CalendarRange` icon) in the toolbar;
  modal is conditionally mounted so it re-fetches on every open.
- `src/renderer/styles.css`: `.toolbar-report-button`, `.modal-*`, `.report-text`,
  `.copy-confirmation` classes matching the existing design palette.

### Tests

- `src/main/__tests__/taskService.test.ts` — new `getWeeklyReport` block (8 cases):
  grouping by list in creation order, per-list chronological order, week-boundary
  exclusion/inclusion (before Monday, exactly Monday 00:00, future timestamps),
  empty week, missing `completedAt` (repeating tasks), empty groups omitted.
- New `src/renderer/components/common/__tests__/WeeklyReportModal.test.tsx`:
  `formatWeeklyReport` exact output, loading → report, empty state, error state,
  clipboard copy + confirmation, Escape/close-button, overlay-vs-modal click behavior.
- `src/renderer/hooks/__tests__/useVNote.test.ts`: mock now includes `getWeeklyReport`.

## Verification

- `npm run typecheck` — passes
- `npm run test` — 111 tests pass (5 files)
- `npm run build` — renderer (Vite) + main (tsc) build clean
- `npm run quality` — Prettier/ESLint clean for the changed files (the 2 ESLint problems
  reported are pre-existing in `src/renderer/components/sidebar/Sidebar.tsx`, unchanged here)
- Manual smoke test: `npm run dev:electron` → complete tasks across lists → open
  "Weekly Report" → verify grouping/ordering, copy → paste matches the modal text.
