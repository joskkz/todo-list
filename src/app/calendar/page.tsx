import type { Metadata } from 'next';
import Calendar from '@/components/Calendar';

export const metadata: Metadata = {
  title: 'Calendar — Tasks',
};

export default function CalendarPage() {
  return <Calendar />;
}
