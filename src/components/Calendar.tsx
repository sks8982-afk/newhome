'use client';

import { useMemo, useState } from 'react';
import type { Announcement } from '@/types/announcement';
import { AnnouncementCard } from './AnnouncementCard';
import { addDays, daysBetween, LONG_PERIOD_DAYS } from '@/lib/calendar/event';

interface Props {
  items: Announcement[];
  /** 캘린더에 담은 공고 id — 신청기간을 달력에 함께 표시한다. */
  pickedIds?: Set<string>;
  onTogglePick?: (item: Announcement, next: boolean) => void;
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

function formatKoreanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

export function Calendar({
  items,
  pickedIds,
  onTogglePick,
}: Props): React.ReactElement {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // 담은 공고의 신청기간(applyStart~applyEnd)을 날짜별로 펼친다.
  // 게시일 기준 itemsByDate 와 별개로, 달력에 "신청" 표시를 얹기 위한 맵.
  const applyByDate = useMemo(() => {
    const map = new Map<string, Announcement[]>();
    if (!pickedIds || pickedIds.size === 0) return map;
    for (const item of items) {
      if (!pickedIds.has(item.id)) continue;
      const start = item.applyStart ?? item.applyEnd;
      const end = item.applyEnd ?? item.applyStart;
      if (!start || !end) continue;
      // 수시모집(전세임대)은 접수기간이 9개월짜리라 매일 칠하면 달력이 도배된다.
      // 기간이 1주일을 넘으면 시작일만 찍는다.
      const marks: string[] = [];
      if (daysBetween(start, end) > LONG_PERIOD_DAYS) {
        marks.push(start);
      } else {
        let cur = start;
        for (let i = 0; i < 400 && cur <= end; i += 1) {
          marks.push(cur);
          cur = addDays(cur, 1);
        }
      }
      for (const d of marks) {
        const arr = map.get(d) ?? [];
        arr.push(item);
        map.set(d, arr);
      }
    }
    return map;
  }, [items, pickedIds]);

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

  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) ?? [] : [];
  const selectedApplyItems = selectedDate ? applyByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
              return <div key={`empty-${idx}`} className="h-14 rounded bg-slate-50 sm:h-24" />;
            }
            const key = isoDate(cell);
            const dayItems = itemsByDate.get(key) ?? [];
            const dayApply = applyByDate.get(key) ?? [];
            const hasPriority = dayItems.some((i) => i.isPriority);
            const isToday = key === todayIso;
            const isSelected = key === selectedDate;
            const hasApply = dayApply.length > 0;
            const hasItems = dayItems.length > 0 || hasApply;

            const baseClasses = `h-14 sm:h-24 overflow-hidden rounded border p-1 text-left text-[11px] transition`;
            const colorClasses = hasApply
              ? 'border-indigo-400 bg-indigo-50'
              : hasPriority
                ? 'border-priority-500 bg-priority-50'
                : 'border-slate-200 bg-white';
            const interactionClasses = hasItems
              ? 'cursor-pointer hover:shadow-sm hover:border-slate-400'
              : 'cursor-default';
            const todayRing = isToday ? 'ring-2 ring-blue-400' : '';
            const selectedRing = isSelected ? 'ring-2 ring-slate-900' : '';

            return (
              <button
                key={key}
                type="button"
                disabled={!hasItems}
                onClick={() =>
                  setSelectedDate((prev) => (prev === key ? null : key))
                }
                className={`${baseClasses} ${colorClasses} ${interactionClasses} ${todayRing} ${selectedRing}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${hasPriority ? 'text-priority-700' : 'text-slate-700'}`}>
                    {cell.getDate()}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {hasApply && (
                      <>
                        {/* 모바일 칸은 45px 남짓이라 배지 두 개가 안 들어간다 — 점으로 표시 */}
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600 sm:hidden" />
                        <span className="hidden rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white sm:inline">
                          📅{dayApply.length}
                        </span>
                      </>
                    )}
                    {dayItems.length > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                        hasPriority ? 'bg-priority-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {dayItems.length}
                      </span>
                    )}
                  </span>
                </div>
                <ul className="mt-0.5 hidden space-y-0.5 sm:block">
                  {dayApply.slice(0, 2).map((i) => (
                    <li key={`a-${i.id}`} title={`신청 ${i.title}`} className="truncate font-semibold text-indigo-700">
                      📅 {i.city ?? i.title.slice(0, 10)}
                    </li>
                  ))}
                  {dayItems.slice(0, hasApply ? 1 : 2).map((i) => (
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
                  {dayItems.length > (hasApply ? 1 : 2) && (
                    <li className="text-[10px] text-slate-400">
                      +{dayItems.length - (hasApply ? 1 : 2)}건
                    </li>
                  )}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              📅 {formatKoreanDate(selectedDate)}
              <span className="ml-2 hidden text-xs font-normal text-slate-500 sm:inline">
                — 클릭하면 LH 상세 페이지로 이동
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              ✕ 닫기
            </button>
          </div>
          {selectedApplyItems.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold text-indigo-700">
                📅 이 날 신청 가능 ({selectedApplyItems.length}건) — 캘린더에 담은 공고
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {selectedApplyItems.map((i) => (
                  <AnnouncementCard
                    key={`a-${i.id}`}
                    item={i}
                    picked
                    onTogglePick={onTogglePick}
                  />
                ))}
              </div>
            </div>
          )}
          {selectedItems.length === 0 ? (
            selectedApplyItems.length === 0 && (
              <p className="text-sm text-slate-500">이 날짜에 매칭된 공고가 없습니다.</p>
            )
          ) : (
            <>
              {selectedApplyItems.length > 0 && (
                <p className="mb-2 text-xs font-semibold text-slate-600">
                  📰 이 날 게시된 공고 ({selectedItems.length}건)
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {selectedItems.map((i) => (
                  <AnnouncementCard
                    key={i.id}
                    item={i}
                    picked={pickedIds?.has(i.id) ?? false}
                    onTogglePick={onTogglePick}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
