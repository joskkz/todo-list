import { addDaysIso, todayIso } from './dates';
import type { TodoInput } from './todo';

/** Demo tasks with due dates relative to today, so every state shows up. */
export function sampleTodos(today = todayIso()): TodoInput[] {
  const d = (days: number) => addDaysIso(today, days);
  return [
    { title: 'Fix checkout payment bug', description: 'Card payments fail for some EU customers', category: 'urgent', dueDate: d(-2) },
    { title: 'Review pull requests for release 2.4', category: 'work', dueDate: d(0) },
    { title: 'Call landlord about heater repair', description: 'Ask for a technician visit this week', category: 'urgent', dueDate: d(0) },
    { title: 'Pay electricity bill', category: 'urgent', dueDate: d(1) },
    { title: 'Renew car insurance', description: 'Compare at least two quotes first', category: 'personal', dueDate: d(2) },
    { title: 'Prepare Q4 sales report', description: 'Pull numbers from the CRM and draft summary slides', category: 'work', dueDate: d(3) },
    { title: 'Prepare client demo environment', category: 'work', dueDate: d(4) },
    { title: 'Respond to security audit findings', description: 'Three medium-severity items open', category: 'urgent', dueDate: d(7) },
    { title: 'Book dentist appointment', category: 'personal', dueDate: d(8) },
    { title: 'Finish chapter 5 for book club', category: 'personal', dueDate: d(13) },
    { title: 'Plan team offsite agenda', description: 'Two days, include a retro session', category: 'work', dueDate: d(16) },
    { title: 'Draft blog post on onboarding', category: 'work' },
    { title: 'Back up laptop', description: 'External drive plus cloud copy', category: 'personal' },
    { title: 'Submit expense claims', description: 'Last month’s travel receipts', category: 'work', dueDate: d(-4) },
    { title: 'Pick up parcel at post office', category: 'personal', dueDate: d(1) },
    { title: 'Buy groceries for the week', category: 'personal', dueDate: d(-1), completed: true },
    { title: 'Update project roadmap', description: 'Share with stakeholders after review', category: 'work', dueDate: d(-3), completed: true },
    { title: 'Renew domain name', category: 'urgent', dueDate: d(-5), completed: true },
  ];
}
