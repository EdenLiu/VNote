export function recommendationReason(task, listName, evidence, today) {
    switch (evidence.basis) {
        case 'dueDate':
            if (!task.dueDate)
                return;
            if (task.dueDate === today)
                return `Due today (${today}).`;
            if (task.dueDate < today)
                return `Overdue since ${task.dueDate}.`;
            return `Due on ${task.dueDate}.`;
        case 'plannedStartDate':
            return task.plannedStartDate && `Planned to start on ${task.plannedStartDate}.`;
        case 'plannedEndDate':
            return task.plannedEndDate && `Planned to finish on ${task.plannedEndDate}.`;
        case 'important':
            if (task.important)
                return `Starred as important in ${listName}.`;
            return;
        case 'title':
        case 'notes':
            if (task[evidence.basis]?.includes(evidence.quote))
                return `Task ${evidence.basis}: “${evidence.quote}”`;
    }
}
export function supportsRecommendation(item, task, listName, today) {
    return (task.listId === item.listId &&
        recommendationReason(task, listName, item.evidence, today) === item.reason);
}
