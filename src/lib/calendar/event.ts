import type { Announcement } from '@/types/announcement';
import { housingCategory } from '@/lib/filter';

// 공고 하나를 캘린더 일정으로 옮길 때 쓰는 최소 정보.
// 날짜는 모두 YYYY-MM-DD (종일 일정, 포함 범위).
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // 신청 시작일 (포함)
  end: string; // 신청 종료일 (포함)
  url: string;
  description: string;
  location?: string;
  /** 신청 시작일이 없어 마감일만으로 만든 일정인지. */
  deadlineOnly: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 에 일수를 더한다. 월·연 경계에서 안전하도록 UTC 기준 계산. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * 공고 → 일정. 기준은 게시일(postedAt)이 아니라 신청일(applyStart)이다.
 * 신청 시작일이 없는 공고(전세임대 수시모집 등)는 마감일 하루짜리로 만든다.
 * 둘 다 없으면 일정으로 만들 수 없어 null.
 */
export function toCalendarEvent(a: Announcement): CalendarEvent | null {
  const start = a.applyStart && ISO_DATE.test(a.applyStart) ? a.applyStart : undefined;
  const end = a.applyEnd && ISO_DATE.test(a.applyEnd) ? a.applyEnd : undefined;
  if (!start && !end) return null;

  const deadlineOnly = !start;
  const from = start ?? (end as string);
  // 종료일이 시작일보다 빠른 비정상 데이터는 시작일 하루짜리로 처리.
  const to = end && end >= from ? end : from;

  const cat = housingCategory(a);
  const address = typeof a.raw?.address === 'string' ? a.raw.address : undefined;

  const lines = [
    `${a.source === 'CHUNGYAK' ? '청약홈' : 'LH'} · ${a.housingType} · ${a.region}`,
    deadlineOnly ? `마감일 ${to} (신청 시작일 미공개 — 공고문 확인)` : `신청기간 ${from} ~ ${to}`,
    `게시일 ${a.postedAt || '-'}`,
    address ? `주소 ${address}` : '',
    '',
    a.detailUrl,
  ].filter(Boolean);

  return {
    id: a.id,
    title: `[${cat}${deadlineOnly ? ' 마감' : ' 신청'}] ${a.title}`,
    start: from,
    end: to,
    url: a.detailUrl,
    description: lines.join('\n'),
    location: address,
    deadlineOnly,
  };
}
