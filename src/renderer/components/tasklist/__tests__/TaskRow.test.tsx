import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from '../TaskRow';
import type { Task } from '@shared/types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    listId: 'inbox',
    title: 'Test Task',
    completed: false,
    important: false,
    notes: '',
    repeat: 'none',
    source: 'manual',
    tags: [],
    steps: [],
    attachments: [],
    createdAt: '2026-05-22T10:00:00.000Z',
    updatedAt: '2026-05-22T10:00:00.000Z',
    ...overrides,
  };
}

describe('TaskRow', () => {
  it('renders the task title', () => {
    render(
      <TaskRow
        task={makeTask({ title: 'Buy groceries' })}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
  });

  it('applies selected class when isSelected is true', () => {
    render(
      <TaskRow task={makeTask()} isSelected={true} onSelect={vi.fn()} onToggleComplete={vi.fn()} />,
    );
    const row = screen.getByRole('button');
    expect(row.className).toContain('selected');
  });

  it('does not apply selected class when isSelected is false', () => {
    render(
      <TaskRow
        task={makeTask()}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    const row = screen.getByRole('button');
    expect(row.className).not.toContain('selected');
  });

  it('calls onSelect when row is clicked', () => {
    const onSelect = vi.fn();
    const task = makeTask();
    render(
      <TaskRow task={task} isSelected={false} onSelect={onSelect} onToggleComplete={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(task);
  });

  it('calls onToggleComplete when checkbox is clicked', () => {
    const onToggleComplete = vi.fn();
    const task = makeTask({ completed: false });
    render(
      <TaskRow
        task={task}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={onToggleComplete}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggleComplete).toHaveBeenCalledWith('task-1', true);
  });

  it('shows completed state on checkbox', () => {
    render(
      <TaskRow
        task={makeTask({ completed: true })}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
  });

  it('shows the important star for important tasks', () => {
    const { container } = render(
      <TaskRow
        task={makeTask({ important: true })}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    // The star icon has class "accent"
    expect(container.querySelector('.accent')).toBeTruthy();
  });

  it('does not show star for normal tasks', () => {
    const { container } = render(
      <TaskRow
        task={makeTask({ important: false })}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    expect(container.querySelector('.accent')).toBeNull();
  });

  it('renders dueDate badge', () => {
    render(
      <TaskRow
        task={makeTask({ dueDate: '2026-06-01' })}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    expect(screen.getByText('2026-06-01')).toBeInTheDocument();
  });

  it('renders tag badges', () => {
    render(
      <TaskRow
        task={makeTask({ tags: ['urgent', 'bug'] })}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('bug')).toBeInTheDocument();
  });

  it('renders attachment count badge', () => {
    render(
      <TaskRow
        task={makeTask({
          attachments: [
            {
              id: '1',
              taskId: 'task-1',
              name: 'a.pdf',
              size: 100,
              storedPath: '/tmp/a.pdf',
              createdAt: '',
            },
            {
              id: '2',
              taskId: 'task-1',
              name: 'b.pdf',
              size: 200,
              storedPath: '/tmp/b.pdf',
              createdAt: '',
            },
          ],
        })}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not render attachment badge when there are no attachments', () => {
    render(
      <TaskRow
        task={makeTask({ attachments: [] })}
        isSelected={false}
        onSelect={vi.fn()}
        onToggleComplete={vi.fn()}
      />,
    );
    // No Paperclip icon — the badge with just a number shouldn't be there
    expect(screen.queryByText('0')).toBeNull();
  });
});
