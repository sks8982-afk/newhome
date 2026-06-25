import type { Announcement, UserFilter } from '@/types/announcement';

export function matchesFilter(a: Announcement, f: UserFilter): boolean {
  const typeOk =
    f.housingTypes.length === 0 || f.housingTypes.includes(a.housingType);
  const regionOk =
    f.regions.length === 0 ||
    f.regions.some(
      (r) => a.region.includes(r) || (a.city ?? '').includes(r),
    );
  return typeOk && regionOk;
}

export function isPriorityCity(a: Announcement, f: UserFilter): boolean {
  if (f.priorityCities.length === 0) return false;
  return f.priorityCities.some(
    (c) => (a.city ?? '').includes(c) || a.title.includes(c) || a.region.includes(c),
  );
}

export function applyPriority(items: Announcement[], f: UserFilter): Announcement[] {
  return items.map((a) => ({ ...a, isPriority: isPriorityCity(a, f) }));
}

export function diffNew(prevSeen: string[], current: Announcement[]): Announcement[] {
  const seen = new Set(prevSeen);
  return current.filter((a) => !seen.has(a.id));
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 한국시간(KST, UTC+9) 기준 오늘 날짜를 YYYY-MM-DD 로 반환.
// 서버는 UTC 로 동작하므로 9시간을 더해 자정 부근 하루 밀림을 방지한다.
export function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 한국시간 기준 오늘에서 months 개월 이전 날짜를 YYYY-MM-DD 로 반환.
// 이전(마감) 공고를 보여줄 때의 하한 컷오프로 사용한다.
export function monthsAgoKST(months: number): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kst.setUTCMonth(kst.getUTCMonth() - months);
  return kst.toISOString().slice(0, 10);
}

// 마감일(applyEnd)이 오늘보다 이전이면 마감된(만료된) 공고로 본다.
// - 마감일 당일은 아직 유효(>= today)하므로 표시한다.
// - applyEnd 가 없거나 YYYY-MM-DD 형식이 아니면 만료로 보지 않는다(표시 유지).
export function isExpired(a: Announcement, today: string = todayKST()): boolean {
  const end = a.applyEnd;
  if (!end || !ISO_DATE_RE.test(end)) return false;
  return end < today;
}
