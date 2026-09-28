'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Announcement } from '@/types/announcement';
import { Calendar } from '@/components/Calendar';

export default function CalendarPage(): React.ReactElement {
  const [items, setItems] = useState<Announcement[]>([]);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/announcements', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { items: Announcement[] }) => setItems(d.items))
      .catch(() => setItems([]));
    fetch('/api/calendar/picks', { cache: 'no-store' })
      .then((r) => r.json())
      .then((rows: Array<{ announcementId: string }>) =>
        setPickedIds(new Set(rows.map((r) => r.announcementId))),
      )
      .catch(() => {});
  }, []);

  // 담기/빼기 — 낙관적 갱신 후 서버 반영, 실패하면 되돌린다.
  const togglePick = useCallback((item: Announcement, next: boolean): void => {
    setPickedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(item.id);
      else s.delete(item.id);
      return s;
    });
    const req = next
      ? fetch('/api/calendar/picks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        })
      : fetch(`/api/calendar/picks?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    void req.catch(() => {
      setPickedIds((prev) => {
        const s = new Set(prev);
        if (next) s.delete(item.id);
        else s.add(item.id);
        return s;
      });
    });
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">📅 청약 캘린더</h2>
      <Calendar items={items} pickedIds={pickedIds} onTogglePick={togglePick} />
    </div>
  );
}
