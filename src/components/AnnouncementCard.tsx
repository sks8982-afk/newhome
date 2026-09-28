'use client';

import { useState } from 'react';
import type { Announcement } from '@/types/announcement';
import { mapSearchQuery } from '@/lib/util/map';
import { toCalendarEvent } from '@/lib/calendar/event';
import { googleCalendarUrl } from '@/lib/calendar/gcal';

interface Props {
  item: Announcement;
  /** 구독 피드(캘린더)에 담긴 공고인지. */
  picked?: boolean;
  /** 담기/빼기 토글. 없으면 ... 메뉴를 감춘다. */
  onTogglePick?: (item: Announcement, next: boolean) => void;
}

// 만원 단위 → "3.5억" (소수 첫째자리, 정수면 "3억")
function toEok(manwon: number): string {
  return `${(manwon / 10000).toFixed(1).replace(/\.0$/, '')}억`;
}

// ㎡ → 평 (1평 = 3.3058㎡)
function toPyeong(m2: number): number {
  return Math.round(m2 / 3.3058);
}
function range(min: number, max: number, f: (n: number) => number | string): string {
  const a = f(min);
  const b = f(max);
  return a === b ? `${a}` : `${a}~${b}`;
}

export function AnnouncementCard({ item, picked = false, onTogglePick }: Props): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const base = 'min-w-0 rounded-lg border p-3 sm:p-4 transition hover:shadow-sm bg-white';
  const priorityCls = item.isPriority
    ? 'border-priority-500 bg-priority-50 ring-1 ring-priority-500'
    : 'border-slate-200';

  const priceMin = typeof item.raw?.priceMin === 'number' ? item.raw.priceMin : undefined;
  const priceMax = typeof item.raw?.priceMax === 'number' ? item.raw.priceMax : undefined;
  const units = typeof item.raw?.units === 'number' ? item.raw.units : undefined;
  const address = typeof item.raw?.address === 'string' ? item.raw.address : undefined;
  const areaMin = typeof item.raw?.areaMin === 'number' ? item.raw.areaMin : undefined;
  const areaMax = typeof item.raw?.areaMax === 'number' ? item.raw.areaMax : undefined;

  const isJupjup = item.housingType === '무순위' || item.housingType === '임의공급';
  const typeLabel = item.housingType === '무순위' ? '줍줍' : item.housingType;
  const unitLabel = units !== undefined ? `${isJupjup ? '잔여 ' : ''}${units}세대` : undefined;

  // 지도 검색어: 정밀 주소면 주소, 택지지구처럼 뭉뚱그린 주소면 단지명으로 자동 선택.
  const mapQuery = mapSearchQuery(item);
  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(mapQuery)}`;
  const kakaoUrl = `https://map.kakao.com/?q=${encodeURIComponent(mapQuery)}`;

  // 신청일(없으면 마감일) 기준 일정. 둘 다 없으면 일정 메뉴를 숨긴다.
  const calEvent = toCalendarEvent(item);
  const gcalUrl = calEvent ? googleCalendarUrl(calEvent) : '';

  return (
    <article className={`${base} ${priorityCls}`}>
      <div className="mb-1 flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
          {item.source === 'CHUNGYAK' ? '청약홈' : item.source}
        </span>
        <span
          className={`rounded px-2 py-0.5 ${
            isJupjup
              ? 'bg-violet-100 font-semibold text-violet-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {typeLabel}
        </span>
        <span className="text-slate-500">{item.region}</span>
        {item.status && (
          <span
            className={`rounded px-2 py-0.5 font-semibold ${
              item.status === '접수중'
                ? 'bg-rose-100 text-rose-700'
                : item.status === '공고중'
                  ? 'bg-blue-100 text-blue-700'
                  : item.status === '정정공고중'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
            }`}
          >
            {item.status}
          </span>
        )}
        {item.isPriority && (
          <span className="rounded-full bg-priority-600 px-2 py-0.5 font-bold text-white">
            ⭐ 우선
          </span>
        )}
        {item.isNew && (
          <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
            NEW
          </span>
        )}
        {picked && (
          <span className="rounded bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">
            📅 담음
          </span>
        )}
      </div>
        {onTogglePick && calEvent && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="일정 메뉴"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded px-2 py-1 text-base leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              …
            </button>
            {menuOpen && (
              <>
                {/* 바깥 클릭으로 닫기 */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onTogglePick(item, !picked);
                      // 담을 때는 구글 캘린더 추가 창도 함께 연다(구독 피드는
                      // 구글이 8~24시간마다 읽어가 즉시 반영되지 않기 때문).
                      if (!picked) window.open(gcalUrl, '_blank', 'noopener');
                    }}
                    className="block w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {picked ? '📅 캘린더에서 빼기' : '📅 캘린더에 추가'}
                  </button>
                  <a
                    href={gcalUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    🗓 구글 캘린더만 열기
                  </a>
                  <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-400">
                    {calEvent.deadlineOnly
                      ? `신청 시작일 미공개 — 마감일(${calEvent.end}) 기준`
                      : `신청 ${calEvent.start} ~ ${calEvent.end}`}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <a
        href={item.detailUrl}
        target="_blank"
        rel="noreferrer"
        className="block text-sm font-semibold leading-snug text-slate-900 hover:underline sm:text-base line-clamp-2"
      >
        {item.title}
      </a>

      {(priceMin !== undefined || unitLabel) && (
        <p className="mt-1 text-xs font-semibold text-amber-700">
          {priceMin !== undefined ? (
            <>
              💰 {toEok(priceMin)}
              {priceMax !== undefined && priceMax !== priceMin ? `~${toEok(priceMax)}` : ''}
              {unitLabel ? <span className="ml-1 font-normal text-slate-500">· {unitLabel}</span> : null}
            </>
          ) : (
            <span className="text-violet-700">🏠 {unitLabel}</span>
          )}
        </p>
      )}

      {areaMin !== undefined && (
        <p className="mt-1 text-xs text-slate-600">
          📐 전용 {range(areaMin, areaMax ?? areaMin, (n) => Math.round(n))}㎡
          {' · '}
          {range(areaMin, areaMax ?? areaMin, toPyeong)}평
        </p>
      )}

      <p className="mt-1 text-xs text-slate-500">
        게시 {item.postedAt || '-'}
        {item.applyStart && (
          <span className="font-semibold text-blue-700"> · 신청 {item.applyStart}</span>
        )}
        {item.applyEnd && ` · 마감 ${item.applyEnd}`}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400">📍</span>
        <a
          href={naverUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-green-300 bg-green-50 px-1.5 py-0.5 font-medium text-green-700 hover:bg-green-100"
        >
          네이버지도
        </a>
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
        >
          카카오맵
        </a>
        {address && (
          <span className="line-clamp-2 w-full break-words text-slate-400 sm:line-clamp-1 sm:w-auto sm:min-w-0 sm:flex-1" title={address}>
            {address}
          </span>
        )}
      </div>
    </article>
  );
}
