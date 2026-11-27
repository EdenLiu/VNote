import type { WeeklyReportDueTask, WeeklyReportGroup } from '@shared/types';

const deadlineEntry = ({ taskId, title, dueDate, wording = title }: WeeklyReportDueTask) => ({
  taskId,
  label: `${title} (${dueDate})`,
  draftLabel: `${wording} (${dueDate})`,
});

export function reportSections(group: WeeklyReportGroup) {
  return [
    {
      heading: 'Completed this week',
      entries: group.tasks.map(({ taskId, title, wording = title, completionCount }) => {
        const count = completionCount ? ` ×${completionCount}` : '';
        return { taskId, label: title + count, draftLabel: wording + count };
      }),
    },
    { heading: 'Due in the next 3 days', entries: group.dueSoon.map(deadlineEntry) },
    { heading: 'Overdue', entries: group.overdue.map(deadlineEntry) },
  ].filter((section) => section.entries.length > 0);
}

export function formatWeeklyReport(groups: WeeklyReportGroup[]): string {
  return groups
    .map((group) => {
      const lines = [`${group.listName}:`];
      for (const { heading, entries } of reportSections(group)) {
        lines.push(heading, ...entries.map(({ draftLabel }) => `- ${draftLabel}`));
      }
      return lines.join('\n');
    })
    .join('\n\n');
}
