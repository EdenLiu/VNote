export function localDateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}
export function isTaskUrgent(task, day) {
    if (task.urgencyOverride)
        return task.urgencyOverride === 'urgent';
    return Boolean(task.dueDate && task.dueDate <= day);
}
