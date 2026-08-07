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

# Bugfix: Remove list color picker, auto-assign random color (Issue #7)

## Problem

When creating a new list ("项目"), the sidebar showed a color dropdown (`<select>`) letting the user pick from 6 preset hex colors. The requirement was to remove the color picker and instead auto-assign a random color that differs from the most recently created list's color.

## Fix

`src/renderer/components/sidebar/ListsSection.tsx`:

- Removed the `color` state and the `<select>` color dropdown from the inline create row.
- Added a `pickRandomColor(lists)` helper: filters the `DEFAULT_COLORS` palette down to colors that differ from the most recently created list's color (`lists[lists.length - 1]` — lists are ordered by `created_at ASC` in the main process), then picks one at random.
- `handleCreate` now calls `onCreateList(name, pickRandomColor(lists))` instead of the user-picked color.

`src/renderer/styles.css`:

- `.inline-create` grid changed from 3 columns (`1fr auto auto`) to 2 columns (`1fr auto`), and the `select` rule was dropped from the shared input/select style block.

The `createList` IPC API is unchanged — the renderer still passes a color, it's just chosen automatically now.

Verified with `npm run typecheck` and `npm run test` (95 tests pass).
