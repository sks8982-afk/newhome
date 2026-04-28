import { NextResponse } from 'next/server';
import { loadAnnouncements, loadFilter } from '@/lib/db/store';
import { applyPriority, matchesFilter } from '@/lib/filter';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const [items, filter] = await Promise.all([loadAnnouncements(), loadFilter()]);
  const filtered = items.filter((a) => matchesFilter(a, filter));
  const result = applyPriority(filtered, filter).sort((a, b) => {
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
    return (b.postedAt ?? '').localeCompare(a.postedAt ?? '');
  });
  return NextResponse.json({ items: result, filter });
}
