import { NextResponse, type NextRequest } from 'next/server';
import { refreshAnnouncements } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get('user-agent')?.includes('vercel-cron');

  // Vercel adds Authorization: Bearer <CRON_SECRET> automatically when CRON_SECRET is set
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!secret && !isVercelCron && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await refreshAnnouncements({ notify: true });
    return NextResponse.json({
      ok: true,
      total: result.total,
      matched: result.matched,
      newCount: result.newCount,
      notified: result.notified,
      dispatch: result.dispatch,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
