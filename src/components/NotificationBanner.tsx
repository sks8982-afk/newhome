'use client';

import { useEffect, useState } from 'react';
import type { Announcement } from '@/types/announcement';

interface Props {
  newItems: Announcement[];
  onDismiss: () => void;
}

export function NotificationBanner({ newItems, onDismiss }: Props): React.ReactElement | null {
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    setBrowserPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (newItems.length === 0) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const priority = newItems.find((i) => i.isPriority) ?? newItems[0];
    new Notification('새 청약 공고', {
      body: priority.title,
      tag: priority.id,
    });
  }, [newItems]);

  if (newItems.length === 0) return null;

  const requestPermission = async (): Promise<void> => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
  };

  const priorityCount = newItems.filter((i) => i.isPriority).length;

  return (
    <div className="mb-6 rounded-lg border border-priority-500 bg-priority-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <h2 className="text-base font-semibold text-priority-700">
              새 공고 {newItems.length}건
              {priorityCount > 0 && (
                <span className="ml-2 rounded-full bg-priority-600 px-2 py-0.5 text-xs font-bold text-white">
                  ⭐ 우선지역 {priorityCount}건
                </span>
              )}
            </h2>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {newItems.slice(0, 5).map((i) => (
              <li key={i.id} className={i.isPriority ? 'font-semibold' : ''}>
                {i.isPriority && <span className="mr-1">⭐</span>}
                <a className="hover:underline" href={i.detailUrl} target="_blank" rel="noreferrer">
                  {i.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          {browserPermission !== 'granted' && (
            <button
              type="button"
              onClick={requestPermission}
              className="rounded-md bg-priority-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-priority-700"
            >
              브라우저 알림 허용
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-priority-500 bg-white px-3 py-1.5 text-xs font-medium text-priority-700 hover:bg-priority-100"
          >
            모두 확인
          </button>
        </div>
      </div>
    </div>
  );
}
