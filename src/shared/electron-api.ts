export const ELECTRON_CHANNELS = {
  state: {
    get: "state:get"
  },
  tasks: {
    create: "task:create",
    update: "task:update",
    delete: "task:delete"
  },
  lists: {
    create: "list:create",
    toggleSuggestions: "list:suggestions"
  },
  steps: {
    add: "step:add",
    update: "step:update",
    delete: "step:delete"
  },
  attachments: {
    add: "attachment:add",
    open: "attachment:open",
    remove: "attachment:remove"
  },
  suggestions: {
    refresh: "suggestions:refresh"
  }
} as const;
