# Repository Guidelines

## Project Structure & Module Organization
- `src/main/` holds the Electron main process, SQLite store, reminders, and file attachment logic.
- `src/preload/` exposes the safe IPC bridge used by the renderer.
- `src/renderer/` contains the React UI, styles, and entrypoint.
- `src/shared/` contains shared types and channel constants used across processes.
- `dist/` is build output and can be regenerated; do not edit it by hand.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite renderer only.
- `npm run dev:electron` runs the renderer plus Electron together for local desktop testing.
- `npm run build` builds renderer and main-process code into `dist/`.
- `npm run typecheck` runs TypeScript checks for renderer and main code.
- `npm run test` runs Vitest in CI-friendly mode.

## Coding Style & Naming Conventions
- Use TypeScript with `strict` mode, ES modules, and explicit shared types for IPC payloads.
- Match the existing style: 2-space indentation, semicolons, and small focused modules.
- Use `PascalCase` for React components and `camelCase` for functions, variables, and IPC handlers.
- Keep shared contracts in `src/shared/` instead of duplicating shapes in main or renderer code.

## Testing Guidelines
- Vitest is available for unit tests. Place tests next to the code they cover or under a nearby `__tests__/` folder.
- Name tests after behavior, for example `taskService.suggestion.test.ts`.
- Prioritize tests for task CRUD, suggestion ranking, repeat handling, and attachment limits.

## Commit & Pull Request Guidelines
- This checkout does not include usable git history, so no repository-specific commit pattern is available.
- Use short imperative Conventional Commit messages by default, such as `feat: add my day toggle`.
- PRs should include a concise summary, screenshots for UI changes, and the commands you ran (`npm run typecheck`, `npm run build`, `npm run test`).

## Security & Configuration Tips
- Do not commit `node_modules/`, secrets, or user data files under Electron `userData`.
- Keep IPC limited to the preload bridge; avoid enabling Node integration in the renderer.
