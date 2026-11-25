/**
 * IPC channel name constants shared between main and preload processes.
 * Using a const object ensures channel names stay in sync.
 */
export const ELECTRON_CHANNELS = {
  aiSettings: { get: 'ai-settings:get', save: 'ai-settings:save' },
  state: {
    /** Fetch full application state. */
    get: 'state:get',
  },
  tasks: {
    create: 'task:create',
    update: 'task:update',
    movePlan: 'task:move-plan',
    delete: 'task:delete',
  },
  lists: {
    create: 'list:create',
    update: 'list:update',
    delete: 'list:delete',
    /** Toggle includeInSuggestions for a list. */
    toggleSuggestions: 'list:suggestions',
  },
  steps: {
    add: 'step:add',
    update: 'step:update',
    delete: 'step:delete',
  },
  attachments: {
    add: 'attachment:add',
    open: 'attachment:open',
    remove: 'attachment:remove',
  },
  suggestions: {
    /** Re-run the suggestion scoring algorithm. */
    refresh: 'suggestions:refresh',
  },
  myDay: {
    /** Add a task to today's My Day view. */
    add: 'myday:add',
  },
  reports: {
    /** Tasks completed this week, grouped by list. */
    weekly: 'report:weekly',
    generateDraft: 'report:generate-draft',
  },
} as const;
