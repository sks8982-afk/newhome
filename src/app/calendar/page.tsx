'use client';

import { useEffect, useState } from 'react';
import type { Announcement } from '@/types/announcement';
import { Calendar } from '@/components/Calendar';

export default function CalendarPage(): React.ReactElement {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    fetch('/api/announcements', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { items: Announcement[] }) => setItems(d.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">📅 청약 캘린더</h2>
      <Calendar items={items} />
    </div>
  );
}
