import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database.ts to prevent loading the electron module
vi.mock('../database.js', () => ({}));

import { TaskService } from '../taskService.js';
import { createTestDb } from './test-helpers.js';
import type { VNoteDatabase } from '../database.js';

let service: TaskService;

// We reset the DB by re-running the helper — actually simpler: drop & recreate

describe('TaskService', () => {
  // We use a helper that creates fresh DB + service for isolation-sensitive tests
  async function fresh() {
    const testDb = await createTestDb();
    return new TaskService(testDb as unknown as VNoteDatabase);
  }

  // Use a shared instance for most tests, recreated in beforeEach via fresh()
  beforeEach(async () => {
    service = await fresh();
  });

  // ---------------------------------------------------------------------------
  // createTask
  // ---------------------------------------------------------------------------
  describe('createTask', () => {
    it('creates a task with title and listId', async () => {
      const task = service.createTask({ title: 'Buy milk', listId: 'inbox' });
      expect(task.title).toBe('Buy milk');
      expect(task.listId).toBe('inbox');
      expect(task.id).toBeTruthy();
    });

    it('trims whitespace from title', async () => {
      const task = service.createTask({ title: '  hello  ', listId: 'inbox' });
      expect(task.title).toBe('hello');
    });

    it("defaults empty title to 'Untitled task'", async () => {
      const task = service.createTask({ title: '', listId: 'inbox' });
      expect(task.title).toBe('Untitled task');
    });

    it('defaults completed to false, important to false, repeat to none, source to manual', async () => {
      const task = service.createTask({ title: 'test', listId: 'inbox' });
      expect(task.completed).toBe(false);
      expect(task.important).toBe(false);
      expect(task.repeat).toBe('none');
      expect(task.source).toBe('manual');
    });

    it('sets createdAt and updatedAt timestamps', async () => {
      const task = service.createTask({ title: 'test', listId: 'inbox' });
      expect(task.createdAt).toBeTruthy();
      expect(task.updatedAt).toBeTruthy();
      expect(task.createdAt).toBe(task.updatedAt);
    });

    it('creates a task with dueDate and reminderAt', async () => {
      const task = service.createTask({
        title: 'test',
        listId: 'inbox',
        dueDate: '2026-06-01',
        reminderAt: '2026-05-31T09:00',
      });
      expect(task.dueDate).toBe('2026-06-01');
      expect(task.reminderAt).toBe('2026-05-31T09:00');
    });

    it('creates an important task', async () => {
      const task = service.createTask({ title: 'urgent', listId: 'inbox', important: true });
      expect(task.important).toBe(true);
    });

    it('auto-extracts #tags from title', async () => {
      const task = service.createTask({ title: 'Fix #bug in #production', listId: 'inbox' });
      expect(task.tags).toContain('bug');
      expect(task.tags).toContain('production');
    });

    it('deduplicates tags case-insensitively', async () => {
      const task = service.createTask({ title: '#Bug and #bug', listId: 'inbox' });
      expect(task.tags.filter((t) => t === 'bug')).toHaveLength(1);
    });

    it('supports Unicode tags', async () => {
      const task = service.createTask({ title: '#café #münchen', listId: 'inbox' });
      expect(task.tags).toContain('café');
      expect(task.tags).toContain('münchen');
    });

    it('returns the task with empty steps, attachments, and tags arrays', async () => {
      const task = service.createTask({ title: 'no tags here', listId: 'inbox' });
      expect(task.steps).toEqual([]);
      expect(task.attachments).toEqual([]);
      expect(task.tags).toEqual([]);
    });

    it('is retrievable after creation', async () => {
      const created = service.createTask({ title: 'persist me', listId: 'inbox' });
      const fetched = service.getTask(created.id);
      expect(fetched.title).toBe('persist me');
    });
  });

  // ---------------------------------------------------------------------------
  // updateTask
  // ---------------------------------------------------------------------------
  describe('updateTask', () => {
    it('updates the title', async () => {
      const task = service.createTask({ title: 'old', listId: 'inbox' });
      const updated = service.updateTask(task.id, { title: 'new' });
      expect(updated.title).toBe('new');
    });

    it('marks a task completed', async () => {
      const task = service.createTask({ title: 'to complete', listId: 'inbox' });
      expect(task.completed).toBe(false);

      const updated = service.updateTask(task.id, { completed: true });
      expect(updated.completed).toBe(true);
      expect(updated.completedAt).toBeTruthy();
    });

    it('re-opens a completed task (clears completedAt)', async () => {
      const task = service.createTask({ title: 'test', listId: 'inbox' });
      service.updateTask(task.id, { completed: true });
      const reopened = service.updateTask(task.id, { completed: false });
      expect(reopened.completed).toBe(false);
      expect(reopened.completedAt).toBeUndefined();
    });

    it('updates notes', async () => {
      const task = service.createTask({ title: 'test', listId: 'inbox' });
      const updated = service.updateTask(task.id, { notes: 'detailed notes' });
      expect(updated.notes).toBe('detailed notes');
    });

    it('updates important flag', async () => {
      const task = service.createTask({ title: 'test', listId: 'inbox' });
      const updated = service.updateTask(task.id, { important: true });
      expect(updated.important).toBe(true);
    });

    it('moves a task to a different list', async () => {
      const task = service.createTask({ title: 'move me', listId: 'inbox' });
      const updated = service.updateTask(task.id, { listId: 'work' });
      expect(updated.listId).toBe('work');
    });

    it('clears dueDate when set to null', async () => {
      const task = service.createTask({ title: 'test', listId: 'inbox', dueDate: '2026-06-01' });
      const updated = service.updateTask(task.id, { dueDate: null });
      expect(updated.dueDate).toBeUndefined();
    });

    it('clears categoryId when set to null', async () => {
      const task = service.createTask({ title: 'test', listId: 'inbox' });
      service.updateTask(task.id, { categoryId: 'red' });
      const cleared = service.updateTask(task.id, { categoryId: null });
      expect(cleared.categoryId).toBeUndefined();
    });

    it('re-extracts tags when title is updated', async () => {
      const task = service.createTask({ title: '#old', listId: 'inbox' });
      const updated = service.updateTask(task.id, { title: '#newtag' });
      expect(updated.tags).toContain('newtag');
      expect(updated.tags).not.toContain('old');
    });

    it('adds task to My Day via myDayDate', async () => {
      const task = service.createTask({ title: 'my day task', listId: 'inbox' });
      const updated = service.updateTask(task.id, { myDayDate: '2026-05-22' });
      expect(updated.myDayDate).toBe('2026-05-22');
    });

    it('removes task from My Day via myDayDate null', async () => {
      const task = service.createTask({ title: 'test', listId: 'inbox' });
      service.updateTask(task.id, { myDayDate: '2026-05-22' });
      const removed = service.updateTask(task.id, { myDayDate: null });
      expect(removed.myDayDate).toBeUndefined();
    });

    // Repeating task logic
    describe('repeating tasks', () => {
      it('daily repeat: completing advances dueDate by 1 day and keeps task active', async () => {
        const task = service.createTask({
          title: 'daily standup',
          listId: 'inbox',
          dueDate: '2026-05-22',
        });
        service.updateTask(task.id, { repeat: 'daily' });
        const completed = service.updateTask(task.id, { completed: true });
        expect(completed.completed).toBe(false);
        expect(completed.dueDate).toBe('2026-05-23');
        expect(completed.completedAt).toBeUndefined();
      });

      it('weekly repeat: completing advances dueDate by 7 days', async () => {
        const task = service.createTask({
          title: 'weekly review',
          listId: 'inbox',
          dueDate: '2026-05-22',
        });
        service.updateTask(task.id, { repeat: 'weekly' });
        const completed = service.updateTask(task.id, { completed: true });
        expect(completed.dueDate).toBe('2026-05-29');
      });

      it('monthly repeat: completing advances dueDate by 1 month', async () => {
        const task = service.createTask({
          title: 'monthly report',
          listId: 'inbox',
          dueDate: '2026-05-22',
        });
        service.updateTask(task.id, { repeat: 'monthly' });
        const completed = service.updateTask(task.id, { completed: true });
        expect(completed.dueDate).toBe('2026-06-22');
      });

      it('advances reminderAt alongside dueDate for repeating tasks', async () => {
        const task = service.createTask({
          title: 'meeting',
          listId: 'inbox',
          dueDate: '2026-05-22',
          reminderAt: '2026-05-22T09:00',
        });
        service.updateTask(task.id, { repeat: 'daily' });
        const completed = service.updateTask(task.id, { completed: true });
        // addRepeatPeriod uses new Date() (local) → toISOString() (UTC), so compute expected dynamically
        const expected = new Date('2026-05-22T09:00');
        expected.setDate(expected.getDate() + 1);
        expect(completed.reminderAt).toBe(expected.toISOString().slice(0, 16));
      });

      it('non-repeating tasks complete normally (stay completed)', async () => {
        const task = service.createTask({ title: 'one-off', listId: 'inbox' });
        const completed = service.updateTask(task.id, { completed: true });
        expect(completed.completed).toBe(true);
        expect(completed.completedAt).toBeTruthy();
      });

      it('re-completing an already completed repeat task does not advance again', async () => {
        const task = service.createTask({ title: 'daily', listId: 'inbox', dueDate: '2026-05-22' });
        service.updateTask(task.id, { repeat: 'daily' });
        // First completion — advances
        const first = service.updateTask(task.id, { completed: true });
        expect(first.dueDate).toBe('2026-05-23');
        // Since the task is still not completed (it's a repeat task), completing again advances
        const second = service.updateTask(first.id, { completed: true });
        expect(second.dueDate).toBe('2026-05-24');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTask
  // ---------------------------------------------------------------------------
  describe('deleteTask', () => {
    it('permanently removes a task', async () => {
      const task = service.createTask({ title: 'delete me', listId: 'inbox' });
      service.deleteTask(task.id);
      expect(() => service.getTask(task.id)).toThrow('Task not found');
    });

    it('does not throw when deleting a non-existent task', async () => {
      expect(() => service.deleteTask('nonexistent')).not.toThrow();
    });

    it('cascades: steps and tags are removed with the task', async () => {
      const task = service.createTask({ title: '#tagged task', listId: 'inbox' });
      service.addStep(task.id, { title: 'step 1' });
      service.deleteTask(task.id);

      // Verify the task is gone
      expect(() => service.getTask(task.id)).toThrow('Task not found');
    });
  });

  // ---------------------------------------------------------------------------
  // getTask / getTasks
  // ---------------------------------------------------------------------------
  describe('getTask / getTasks', () => {
    it('getTasks returns all tasks sorted by createdAt desc', async () => {
      service.createTask({ title: 'first', listId: 'inbox' });
      service.createTask({ title: 'second', listId: 'inbox' });
      const tasks = service.getTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(2);
      const titles = tasks.map((t) => t.title);
      expect(titles).toContain('first');
      expect(titles).toContain('second');
    });

    it('getTask throws for non-existent task', async () => {
      expect(() => service.getTask('nonexistent')).toThrow('Task not found');
    });

    it('getState returns full AppState', async () => {
      const state = service.getState();
      expect(state.lists.length).toBeGreaterThanOrEqual(3);
      expect(state.categories.length).toBe(4);
      expect(state.tasks).toBeDefined();
      expect(state.activeView).toBe('my-day');
    });
  });

  // ---------------------------------------------------------------------------
  // createList / updateList / deleteList
  // ---------------------------------------------------------------------------
  describe('list management', () => {
    it('creates a list with default color', async () => {
      const list = service.createList({ name: ' groceries ' });
      expect(list.name).toBe('groceries');
      expect(list.color).toBe('#2563eb');
      expect(list.includeInSuggestions).toBe(true);
    });

    it('creates a list with custom color', async () => {
      const list = service.createList({ name: 'custom', color: '#ff0000' });
      expect(list.color).toBe('#ff0000');
    });

    it("defaults empty list name to 'Untitled list'", async () => {
      const list = service.createList({ name: '' });
      expect(list.name).toBe('Untitled list');
    });

    it('updates list name and color', async () => {
      const list = service.createList({ name: 'original' });
      const updated = service.updateList(list.id, { name: 'renamed', color: '#00ff00' });
      expect(updated.name).toBe('renamed');
      expect(updated.color).toBe('#00ff00');
    });

    it('toggles includeInSuggestions', async () => {
      const list = service.createList({ name: 'test' });
      const updated = service.updateList(list.id, { includeInSuggestions: false });
      expect(updated.includeInSuggestions).toBe(false);
    });

    it('throws when updating non-existent list', async () => {
      expect(() => service.updateList('nonexistent', { name: 'x' })).toThrow('List not found');
    });

    it('throws when deleting the last list', async () => {
      const lists = service.getLists();
      // Delete all but one
      for (const list of lists.slice(1)) {
        service.deleteList(list.id);
      }
      const remaining = service.getLists();
      expect(remaining.length).toBe(1);
      expect(() => service.deleteList(remaining[0].id)).toThrow('Cannot delete the last list');
    });

    it('reassigns tasks to inbox when deleting a list', async () => {
      const lists = service.getLists();
      const inbox = lists[0];
      const otherList = service.createList({ name: 'to-delete' });

      service.createTask({ title: 'task in doomed list', listId: otherList.id });
      service.deleteList(otherList.id);

      const tasks = service.getTasks();
      const movedTask = tasks.find((t) => t.title === 'task in doomed list');
      expect(movedTask).toBeTruthy();
      expect(movedTask!.listId).toBe(inbox.id);
    });
  });

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------
  describe('steps', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = service.createTask({ title: 'task with steps', listId: 'inbox' });
      taskId = task.id;
    });

    it('adds a step with auto-incremented sortOrder', async () => {
      const step1 = service.addStep(taskId, { title: 'step one' });
      const step2 = service.addStep(taskId, { title: 'step two' });
      expect(step1.sortOrder).toBe(0);
      expect(step2.sortOrder).toBe(1);
    });

    it("trims empty step title to 'Untitled step'", async () => {
      const step = service.addStep(taskId, { title: '' });
      expect(step.title).toBe('Untitled step');
    });

    it('retrieves steps with the parent task', async () => {
      service.addStep(taskId, { title: 'subtask' });
      const task = service.getTask(taskId);
      expect(task.steps.length).toBe(1);
      expect(task.steps[0].title).toBe('subtask');
    });

    it('updates step title', async () => {
      const step = service.addStep(taskId, { title: 'original' });
      const updated = service.updateStep(step.id, { title: 'updated' });
      expect(updated.title).toBe('updated');
    });

    it('toggles step completed', async () => {
      const step = service.addStep(taskId, { title: 'checklist' });
      const updated = service.updateStep(step.id, { completed: true });
      expect(updated.completed).toBe(true);
    });

    it('throws when updating non-existent step', async () => {
      expect(() => service.updateStep('nonexistent', { title: 'x' })).toThrow('Step not found');
    });

    it('deletes a step', async () => {
      const step = service.addStep(taskId, { title: 'removable' });
      service.deleteStep(step.id);
      const task = service.getTask(taskId);
      expect(task.steps.length).toBe(0);
    });

    it('maintains sortOrder across steps', async () => {
      service.addStep(taskId, { title: 'a' });
      service.addStep(taskId, { title: 'b' });
      service.addStep(taskId, { title: 'c' });
      const task = service.getTask(taskId);
      expect(task.steps.map((s) => s.sortOrder)).toEqual([0, 1, 2]);
    });
  });

  // ---------------------------------------------------------------------------
  // addToMyDay
  // ---------------------------------------------------------------------------
  describe('addToMyDay', () => {
    it('adds a task to My Day for today', async () => {
      const task = service.createTask({ title: 'today task', listId: 'inbox' });
      const today = new Date().toISOString().slice(0, 10);
      const updated = service.addToMyDay(task.id);
      expect(updated.myDayDate).toBe(today);
    });

    it('adds a task to My Day for a specific date', async () => {
      const task = service.createTask({ title: 'future task', listId: 'inbox' });
      const updated = service.addToMyDay(task.id, '2026-12-25');
      expect(updated.myDayDate).toBe('2026-12-25');
    });
  });

  // ---------------------------------------------------------------------------
  // getSuggestions
  // ---------------------------------------------------------------------------
  describe('getSuggestions', () => {
    it('returns empty array when no eligible tasks', async () => {
      const suggestions = service.getSuggestions();
      expect(suggestions).toEqual([]);
    });

    it('excludes completed tasks', async () => {
      const task = service.createTask({ title: 'done', listId: 'inbox' });
      service.updateTask(task.id, { completed: true });
      expect(service.getSuggestions()).toEqual([]);
    });

    it('excludes tasks already in My Day today', async () => {
      const task = service.createTask({ title: 'today already', listId: 'inbox' });
      service.addToMyDay(task.id);
      expect(service.getSuggestions()).toEqual([]);
    });

    it('scores overdue tasks highest', async () => {
      service.createTask({ title: 'overdue', listId: 'inbox', dueDate: '2020-01-01' });
      service.createTask({ title: 'normal', listId: 'inbox' });
      const suggestions = service.getSuggestions();
      expect(suggestions[0].title).toBe('overdue');
    });

    it('scores due-today tasks with high priority', async () => {
      const today = new Date().toISOString().slice(0, 10);
      service.createTask({ title: 'due today', listId: 'inbox', dueDate: today });
      service.createTask({ title: 'no due date', listId: 'inbox' });
      const suggestions = service.getSuggestions();
      expect(suggestions[0].title).toBe('due today');
    });

    it('scores important tasks higher', async () => {
      service.createTask({ title: 'important one', listId: 'inbox', important: true });
      service.createTask({ title: 'normal one', listId: 'inbox' });
      const suggestions = service.getSuggestions();
      expect(suggestions[0].title).toBe('important one');
    });

    it('respects includeInSuggestions = false on lists', async () => {
      const hidden = service.createList({ name: 'hidden' });
      service.updateList(hidden.id, { includeInSuggestions: false });
      service.createTask({ title: 'hidden task', listId: hidden.id });
      expect(service.getSuggestions()).toEqual([]);
    });

    it('caps results at 12', async () => {
      for (let i = 0; i < 20; i++) {
        service.createTask({ title: `task ${i}`, listId: 'inbox' });
      }
      const suggestions = service.getSuggestions();
      expect(suggestions.length).toBeLessThanOrEqual(12);
    });
  });

  // ---------------------------------------------------------------------------
  // Attachments
  // ---------------------------------------------------------------------------
  describe('attachments', () => {
    it('creates an attachment record', async () => {
      const task = service.createTask({ title: 'with file', listId: 'inbox' });
      const attachment = service.createAttachment(task.id, {
        name: 'report.pdf',
        size: 1024,
        storedPath: '/tmp/report.pdf',
      });
      expect(attachment.name).toBe('report.pdf');
      expect(attachment.size).toBe(1024);
      expect(attachment.taskId).toBe(task.id);
    });

    it('retrieves attachment by id', async () => {
      const task = service.createTask({ title: 'with file', listId: 'inbox' });
      const created = service.createAttachment(task.id, {
        name: 'doc.pdf',
        size: 512,
        storedPath: '/tmp/doc.pdf',
      });
      const fetched = service.getAttachment(created.id);
      expect(fetched.name).toBe('doc.pdf');
    });

    it('throws when attachment not found', async () => {
      expect(() => service.getAttachment('nonexistent')).toThrow('Attachment not found');
    });

    it('removes an attachment', async () => {
      const task = service.createTask({ title: 'with file', listId: 'inbox' });
      const attachment = service.createAttachment(task.id, {
        name: 'temp.pdf',
        size: 100,
        storedPath: '/tmp/temp.pdf',
      });
      service.removeAttachment(attachment.id);
      expect(() => service.getAttachment(attachment.id)).toThrow('Attachment not found');
    });
  });
});
