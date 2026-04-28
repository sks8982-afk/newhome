import { NextResponse } from 'next/server';
import { markAllSeen } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  await markAllSeen();
  return NextResponse.json({ ok: true });
}
