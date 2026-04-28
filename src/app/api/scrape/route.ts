import { NextResponse } from 'next/server';
import { refreshAnnouncements } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  try {
    const result = await refreshAnnouncements({ notify: true });
    return NextResponse.json({
      ok: true,
      total: result.total,
      matched: result.matched,
      newCount: result.newCount,
      notified: result.notified,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
