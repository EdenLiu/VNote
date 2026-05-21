import { contextBridge, ipcRenderer } from "electron";
import type { VNoteApi } from "../shared/types.js";

const api: VNoteApi = {
  getState: () => ipcRenderer.invoke("state:get"),
  createTask: (draft) => ipcRenderer.invoke("task:create", draft),
  updateTask: (id, patch) => ipcRenderer.invoke("task:update", id, patch),
  deleteTask: (id) => ipcRenderer.invoke("task:delete", id),
  createList: (draft) => ipcRenderer.invoke("list:create", draft),
  addStep: (taskId, draft) => ipcRenderer.invoke("step:add", taskId, draft),
  updateStep: (id, patch) => ipcRenderer.invoke("step:update", id, patch),
  deleteStep: (id) => ipcRenderer.invoke("step:delete", id),
  addAttachment: (taskId) => ipcRenderer.invoke("attachment:add", taskId),
  removeAttachment: (id) => ipcRenderer.invoke("attachment:remove", id),
  openAttachment: (id) => ipcRenderer.invoke("attachment:open", id),
  setListSuggestions: (listId, enabled) => ipcRenderer.invoke("list:suggestions", listId, enabled),
  refreshSuggestions: () => ipcRenderer.invoke("suggestions:refresh"),
  addToMyDay: (taskId, day) => ipcRenderer.invoke("myday:add", taskId, day)
};

contextBridge.exposeInMainWorld("vnote", api);
