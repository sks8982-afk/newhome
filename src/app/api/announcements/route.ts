import { NextResponse } from 'next/server';
import { loadAnnouncements, loadFilter } from '@/lib/db/store';
import { applyPriority, isExpired, matchesFilter } from '@/lib/filter';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const [items, filter] = await Promise.all([loadAnnouncements(), loadFilter()]);
  // 마감일(applyEnd)이 오늘(한국시간) 이전인 공고는 목록에서 제외한다.
  const filtered = items.filter((a) => matchesFilter(a, filter) && !isExpired(a));
  const result = applyPriority(filtered, filter).sort((a, b) => {
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
    return (b.postedAt ?? '').localeCompare(a.postedAt ?? '');
  });
  return NextResponse.json({ items: result, filter });
}
