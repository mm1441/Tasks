import { Task } from '../types/Task';

type TaskSection = {
  title: string;
  data: Task[];
};

export function buildDueDateSections(tasks: Task[]): TaskSection[] {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const pastDue: Task[] = [];
  const noDueDate: Task[] = [];
  const byDate: Record<string, Task[]> = {};

  tasks.forEach(task => {
    if (!task.dueDate) {
      noDueDate.push(task);
      return;
    }

    const due = new Date(task.dueDate);

    if (due < startOfToday) {
      pastDue.push(task);
      return;
    }

    const key = due.toISOString().split('T')[0]; // yyyy-mm-dd
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(task);
  });

  const sections: TaskSection[] = [];

  if (pastDue.length) {
    sections.push({
      title: 'Past due',
      data: pastDue,
    });
  }

  Object.keys(byDate)
    .sort()
    .forEach(dateKey => {
      const date = new Date(dateKey);
      sections.push({
        title: date.toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        }),
        data: byDate[dateKey],
      });
    });

  if (noDueDate.length) {
    sections.push({
      title: 'No due date',
      data: noDueDate,
    });
  }

  return sections;
}
