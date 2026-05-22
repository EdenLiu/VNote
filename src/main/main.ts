import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addAttachment, openAttachment, removeAttachment } from "./attachments.js";
import { VNoteDatabase } from "./database.js";
import { ReminderScheduler } from "./reminders.js";
import { TaskService } from "./taskService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let service: TaskService;
let reminders: ReminderScheduler;

function registerIpc() {
  ipcMain.handle("state:get", () => service.getState());
  ipcMain.handle("task:create", (_event, draft) => service.createTask(draft));
  ipcMain.handle("task:update", (_event, id, patch) => service.updateTask(id, patch));
  ipcMain.handle("task:delete", (_event, id) => service.deleteTask(id));
  ipcMain.handle("list:create", (_event, draft) => service.createList(draft));
  ipcMain.handle("list:update", (_event, listId, patch) => service.updateList(listId, patch));
  ipcMain.handle("list:delete", (_event, listId) => service.deleteList(listId));
  ipcMain.handle("list:suggestions", (_event, listId, enabled) => service.setListSuggestions(listId, enabled));
  ipcMain.handle("step:add", (_event, taskId, draft) => service.addStep(taskId, draft));
  ipcMain.handle("step:update", (_event, id, patch) => service.updateStep(id, patch));
  ipcMain.handle("step:delete", (_event, id) => service.deleteStep(id));
  ipcMain.handle("attachment:add", (_event, taskId) => addAttachment(service, taskId));
  ipcMain.handle("attachment:open", (_event, id) => openAttachment(service, id));
  ipcMain.handle("attachment:remove", (_event, id) => removeAttachment(service, id));
  ipcMain.handle("suggestions:refresh", () => service.getSuggestions());
  ipcMain.handle("myday:add", (_event, taskId, day) => service.addToMyDay(taskId, day));
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: "VNote",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Required for the ESM preload emitted by the NodeNext TypeScript build.
      sandbox: false
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    await window.loadURL(devServer);
  } else {
    await window.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  service = new TaskService(await VNoteDatabase.open());
  registerIpc();
  reminders = new ReminderScheduler(service);
  reminders.start();
  await createWindow();
});

app.on("window-all-closed", () => {
  reminders?.stop();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
