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
