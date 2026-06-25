import { type NextRequest, NextResponse } from 'next/server';
import { loadAnnouncements, loadFilter } from '@/lib/db/store';
import { applyPriority, isExpired, matchesFilter, monthsAgoKST } from '@/lib/filter';

export const dynamic = 'force-dynamic';

// 이전(마감) 공고를 보여줄 때 조회 가능한 최대 과거 범위: 최근 3개월
const MAX_PAST_MONTHS = 3;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const includePast = req.nextUrl.searchParams.get('includePast') === '1';
  const pastCutoff = monthsAgoKST(MAX_PAST_MONTHS);

  const [items, filter] = await Promise.all([loadAnnouncements(), loadFilter()]);
  const filtered = items.filter((a) => {
    if (!matchesFilter(a, filter)) return false;
    // 진행 중이거나 마감일을 알 수 없는 공고는 항상 표시.
    if (!isExpired(a)) return true;
    // 마감된 공고는 체크박스(includePast) ON + 마감일이 최근 3개월 이내일 때만 표시.
    return includePast && (a.applyEnd as string) >= pastCutoff;
  });

  const result = applyPriority(filtered, filter)
    // 마감된 이전 공고에는 NEW 배지를 붙이지 않는다.
    .map((a) => (isExpired(a) ? { ...a, isNew: false } : a))
    .sort((a, b) => {
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      return (b.postedAt ?? '').localeCompare(a.postedAt ?? '');
    });

  return NextResponse.json({ items: result, filter });
}
