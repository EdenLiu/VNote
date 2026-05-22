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
