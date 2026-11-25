import { contextBridge, ipcRenderer } from 'electron';
import { ELECTRON_CHANNELS } from '../shared/electron-api.js';
const api = {
    getAiSettings: () => ipcRenderer.invoke(ELECTRON_CHANNELS.aiSettings.get),
    saveAiSettings: (patch) => ipcRenderer.invoke(ELECTRON_CHANNELS.aiSettings.save, patch),
    getState: () => ipcRenderer.invoke('state:get'),
    createTask: (draft) => ipcRenderer.invoke('task:create', draft),
    updateTask: (id, patch) => ipcRenderer.invoke('task:update', id, patch),
    moveTaskPlan: (id, days) => ipcRenderer.invoke(ELECTRON_CHANNELS.tasks.movePlan, id, days),
    deleteTask: (id) => ipcRenderer.invoke('task:delete', id),
    createList: (draft) => ipcRenderer.invoke('list:create', draft),
    updateList: (id, patch) => ipcRenderer.invoke('list:update', id, patch),
    deleteList: (id) => ipcRenderer.invoke('list:delete', id),
    addStep: (taskId, draft) => ipcRenderer.invoke('step:add', taskId, draft),
    updateStep: (id, patch) => ipcRenderer.invoke('step:update', id, patch),
    deleteStep: (id) => ipcRenderer.invoke('step:delete', id),
    addAttachment: (taskId) => ipcRenderer.invoke('attachment:add', taskId),
    removeAttachment: (id) => ipcRenderer.invoke('attachment:remove', id),
    openAttachment: (id) => ipcRenderer.invoke('attachment:open', id),
    setListSuggestions: (listId, enabled) => ipcRenderer.invoke('list:suggestions', listId, enabled),
    refreshSuggestions: () => ipcRenderer.invoke('suggestions:refresh'),
    getAiRecommendations: () => ipcRenderer.invoke(ELECTRON_CHANNELS.suggestions.recommend),
    acceptAiRecommendation: (id) => ipcRenderer.invoke(ELECTRON_CHANNELS.suggestions.accept, id),
    addToMyDay: (taskId, day) => ipcRenderer.invoke('myday:add', taskId, day),
    getWeeklyReport: () => ipcRenderer.invoke(ELECTRON_CHANNELS.reports.weekly),
    generateWeeklyReportDraft: () => ipcRenderer.invoke(ELECTRON_CHANNELS.reports.generateDraft),
};
contextBridge.exposeInMainWorld('vnote', api);
