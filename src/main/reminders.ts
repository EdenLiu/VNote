import { Notification } from 'electron';
import type { TaskService } from './taskService.js';

export class ReminderScheduler {
  private timer: NodeJS.Timeout | undefined;
  private readonly shown = new Set<string>();

  constructor(private readonly service: TaskService) {}

  start() {
    this.stop();
    this.check();
    this.timer = setInterval(() => this.check(), 30_000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private check() {
    const now = Date.now();
    for (const task of this.service.getTasks()) {
      if (!task.reminderAt || task.completed) continue;
      const key = `${task.id}:${task.reminderAt}`;
      if (new Date(task.reminderAt).getTime() <= now && !this.shown.has(key)) {
        this.shown.add(key);
        new Notification({ title: 'VNote reminder', body: task.title }).show();
      }
    }
  }
}
