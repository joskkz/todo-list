import { addDaysIso, todayIso } from './dates';
import type { TodoInput } from './todo';

/**
 * Demo tasks with due dates relative to today, so every state shows up:
 * overdue, today, upcoming, no date, completed — and, within a day, tasks
 * with a time (`dueTime`, 24h `HH:mm`) next to tasks without one.
 */
export function sampleTodos(today = todayIso()): TodoInput[] {
  const d = (days: number) => addDaysIso(today, days);
  return [
    { title: 'Fix checkout payment bug', description: 'Card payments fail for some EU customers', category: 'urgent', dueDate: d(-2), dueTime: '17:00' },
    { title: 'Review pull requests for release 2.4', category: 'work', dueDate: d(0), dueTime: '10:00' },
    { title: 'Daily stand-up', description: 'Share blockers on the release', category: 'work', dueDate: d(0), dueTime: '09:15' },
    { title: 'Call landlord about heater repair', description: 'Ask for a technician visit this week', category: 'urgent', dueDate: d(0) },
    { title: 'Pay electricity bill', category: 'urgent', dueDate: d(1) },
    { title: 'Gym session', category: 'personal', dueDate: d(1), dueTime: '07:00' },
    { title: 'Renew car insurance', description: 'Compare at least two quotes first', category: 'personal', dueDate: d(2) },
    { title: 'Prepare Q4 sales report', description: 'Pull numbers from the CRM and draft summary slides', category: 'work', dueDate: d(3), dueTime: '16:30' },
    { title: 'Prepare client demo environment', category: 'work', dueDate: d(4), dueTime: '11:00' },
    { title: 'Respond to security audit findings', description: 'Three medium-severity items open', category: 'urgent', dueDate: d(7) },
    { title: 'Book dentist appointment', category: 'personal', dueDate: d(8), dueTime: '14:45' },
    { title: 'Finish chapter 5 for book club', category: 'personal', dueDate: d(13), dueTime: '20:00' },
    { title: 'Plan team offsite agenda', description: 'Two days, include a retro session', category: 'work', dueDate: d(16) },
    { title: 'Draft blog post on onboarding', category: 'work' },
    { title: 'Back up laptop', description: 'External drive plus cloud copy', category: 'personal' },
    { title: 'Submit expense claims', description: 'Last month’s travel receipts', category: 'work', dueDate: d(-4) },
    { title: 'Pick up parcel at post office', category: 'personal', dueDate: d(1), dueTime: '18:00' },
    { title: 'Buy groceries for the week', category: 'personal', dueDate: d(-1), completed: true },
    { title: 'Update project roadmap', description: 'Share with stakeholders after review', category: 'work', dueDate: d(-3), dueTime: '15:00', completed: true },
    { title: 'Renew domain name', category: 'urgent', dueDate: d(-5), completed: true },
  ];
}
