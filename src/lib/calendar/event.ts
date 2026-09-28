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

// 접수기간이 이 일수를 넘으면 일정은 시작일 하루만 잡는다.
// 수시모집(전세임대)은 접수기간이 9개월이라 그대로 넣으면 캘린더가 통째로 덮인다.
export const LONG_PERIOD_DAYS = 7;

/** 두 YYYY-MM-DD 사이의 일수(같은 날이면 0). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

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
  const rawTo = end && end >= from ? end : from;
  // 접수기간이 너무 길면(수시모집 등) 시작일 하루짜리로 잡는다 — 실제 기간은 설명에 남긴다.
  const longPeriod = daysBetween(from, rawTo) > LONG_PERIOD_DAYS;
  const to = longPeriod ? from : rawTo;

  const cat = housingCategory(a);
  const address = typeof a.raw?.address === 'string' ? a.raw.address : undefined;
  // LH 표기 원문(시각 포함, 예: "2026.09.29 09:00 ~ 2026.09.30 16:00").
  // 인터넷 접수는 마감 시각이 중요해 있으면 그대로 보여준다.
  const periodText = typeof a.raw?.applyPeriod === 'string' ? a.raw.applyPeriod : undefined;

  const lines = [
    `${a.source === 'CHUNGYAK' ? '청약홈' : 'LH'} · ${a.housingType} · ${a.region}`,
    deadlineOnly
      ? `마감일 ${rawTo} (신청 시작일 미공개 — 공고문 확인)`
      : `신청기간 ${periodText ?? `${from} ~ ${rawTo}`}${longPeriod ? ' (상시·수시 접수 — 일정은 시작일만 표시)' : ''}`,
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
