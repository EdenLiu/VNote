import fs from "node:fs/promises";
import path from "node:path";
import { app, dialog, shell } from "electron";
import type { AttachmentResult } from "../shared/types.js";
import type { TaskService } from "./taskService.js";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export async function addAttachment(service: TaskService, taskId: string): Promise<AttachmentResult | undefined> {
  const result = await dialog.showOpenDialog({ title: "Attach file", properties: ["openFile"] });
  if (result.canceled || result.filePaths.length === 0) return undefined;

  const sourcePath = result.filePaths[0];
  const stat = await fs.stat(sourcePath);
  if (stat.size > MAX_ATTACHMENT_BYTES) throw new Error("Attachment exceeds the 25 MB limit.");

  const attachmentDir = path.join(app.getPath("userData"), "attachments");
  await fs.mkdir(attachmentDir, { recursive: true });
  const storedPath = path.join(attachmentDir, `${crypto.randomUUID()}-${path.basename(sourcePath)}`);
  await fs.copyFile(sourcePath, storedPath);

  return {
    attachment: service.createAttachment(taskId, {
      name: path.basename(sourcePath),
      size: stat.size,
      storedPath
    })
  };
}

export async function openAttachment(service: TaskService, attachmentId: string) {
  await shell.openPath(service.getAttachment(attachmentId).storedPath);
}

export async function removeAttachment(service: TaskService, attachmentId: string) {
  const attachment = service.getAttachment(attachmentId);
  service.removeAttachment(attachmentId);
  await fs.rm(attachment.storedPath, { force: true });
}
