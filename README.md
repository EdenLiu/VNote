# VNote

一个轻量级 Electron 任务管理器，专注于快速记录和每日规划。

## 项目结构

```
src/
├── shared/          # 类型定义 & IPC 通道常量（两个进程共享）
│   ├── types.ts         # 所有领域类型（Task, TaskList, Category, Step 等）
│   └── electron-api.ts  # IPC 通道名称常量
├── main/            # Electron 主进程
│   ├── main.ts          # 应用入口：窗口创建、IPC 处理注册
│   ├── database.ts      # sql.js 封装（内存 SQLite，延迟刷盘）
│   ├── taskService.ts   # 业务逻辑：任务/列表/步骤 CRUD、建议引擎、My Day
│   ├── attachments.ts   # 文件选择器 + 25MB 限制 + 磁盘复制
│   └── reminders.ts     # 30 秒轮询提醒检查
├── preload/         # contextBridge 向渲染进程暴露 VNoteApi
│   └── preload.ts
└── renderer/        # React 19 UI（Vite 打包）
    ├── App.tsx          # 根布局
    ├── styles.css       # 全局样式
    ├── hooks/
    │   └── useVNote.ts  # 核心状态管理 Hook
    └── components/
        ├── common/      # EmptyState, ErrorBanner
        ├── sidebar/     # BrandHeader, SmartViewsNav, ListsSection, Sidebar
        ├── tasklist/    # TaskRow, QuickAddBar, TaskList
        └── detail/      # DetailPane + 各子组件
```

## 快速开始

```bash
npm install
npm run dev:electron     # 启动 Electron 开发模式
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（仅渲染进程，http://127.0.0.1:5173） |
| `npm run dev:electron` | 完整 Electron 开发模式（编译主进程 + 启动 Vite + 启动 Electron） |
| `npm run build` | 生产构建：渲染进程 (Vite) + 主进程 (tsc) |
| `npm run build:renderer` | 仅构建渲染进程 → dist/renderer/ |
| `npm run build:main` | 仅构建主进程 + preload → dist/ |
| `npm run typecheck` | TypeScript 类型检查（renderer + main） |
| `npm run test` | 运行 Vitest 测试 |

## 代码质量

| 命令 | 说明 |
|------|------|
| `npm run format` | 使用 Prettier 自动格式化 src 下所有 `.ts/.tsx/.css/.json` 文件 |
| `npm run format:check` | 检查格式是否符合 Prettier 规范（CI 用） |
| `npm run lint` | 运行 ESLint 静态代码检查 |
| `npm run quality` | 一键运行全部质量检查：format → lint → typecheck |

### 质量工具配置

- **Prettier**：2 空格缩进、单引号、尾逗号、100 字符宽度
- **ESLint**：基于 `@eslint/js` recommended + `typescript-eslint` recommended + react-hooks 规则
- **TypeScript**：strict 模式，`tsconfig.json`（renderer）+ `tsconfig.main.json`（main）

## IPC 通信流程

```
Renderer (React) → window.vnote.*() → preload ipcRenderer.invoke → ipcMain.handle → TaskService → sql.js
```

- 渲染进程不直接访问主进程，仅通过类型安全的 `VNoteApi` 接口
- 每个 API 调用遵循 `try → call API → load() 刷新 → catch → setError` 模式

## 技术栈

- Electron 39
- React 19
- TypeScript 5.9
- Vite 7
- sql.js (内存 SQLite)
- Vitest 4
- Prettier + ESLint (代码质量)
