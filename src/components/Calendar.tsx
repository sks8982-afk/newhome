'use client';

import { useMemo, useState } from 'react';
import type { Announcement } from '@/types/announcement';

interface Props {
  items: Announcement[];
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function Calendar({ items }: Props): React.ReactElement {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));

  const itemsByDate = useMemo(() => {
    const map = new Map<string, Announcement[]>();
    for (const item of items) {
      const key = (item.postedAt || '').slice(0, 10);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const startDow = first.getDay();
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < startDow; i += 1) result.push(null);
    for (let d = 1; d <= lastDay; d += 1) {
      result.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [cursor]);

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
  const todayIso = isoDate(new Date());

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
          onClick={() => setCursor((c) => addMonths(c, -1))}
        >
          ◀ 이전
        </button>
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <button
          type="button"
          className="rounded border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
          onClick={() => setCursor((c) => addMonths(c, 1))}
        >
          다음 ▶
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-24 rounded bg-slate-50" />;
          }
          const key = isoDate(cell);
          const dayItems = itemsByDate.get(key) ?? [];
          const hasPriority = dayItems.some((i) => i.isPriority);
          const isToday = key === todayIso;
          return (
            <div
              key={key}
              className={`h-24 overflow-hidden rounded border p-1 text-left text-[11px] ${
                hasPriority
                  ? 'border-priority-500 bg-priority-50'
                  : 'border-slate-200 bg-white'
              } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${hasPriority ? 'text-priority-700' : 'text-slate-700'}`}>
                  {cell.getDate()}
                </span>
                {dayItems.length > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                    hasPriority ? 'bg-priority-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {dayItems.length}
                  </span>
                )}
              </div>
              <ul className="mt-0.5 space-y-0.5">
                {dayItems.slice(0, 2).map((i) => (
                  <li
                    key={i.id}
                    title={i.title}
                    className={`truncate ${
                      i.isPriority
                        ? 'font-semibold text-priority-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {i.isPriority && '⭐ '}
                    {i.city ?? i.title.slice(0, 10)}
                  </li>
                ))}
                {dayItems.length > 2 && (
                  <li className="text-[10px] text-slate-400">+{dayItems.length - 2}건</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
