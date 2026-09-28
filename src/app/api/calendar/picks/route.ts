import { NextResponse, type NextRequest } from 'next/server';
import {
  addCalendarPick,
  loadCalendarPicks,
  removeCalendarPick,
} from '@/lib/db/store';

export const dynamic = 'force-dynamic';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(): Promise<NextResponse> {
  const picks = await loadCalendarPicks();
  return NextResponse.json(picks);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const { id, manualStart, manualEnd } = (body ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || id.length === 0) {
      return NextResponse.json({ ok: false, error: 'id 가 필요합니다' }, { status: 400 });
    }
    // 수동 날짜는 형식이 맞을 때만 저장한다(잘못된 값이 캘린더로 새어나가지 않게).
    const start = typeof manualStart === 'string' && ISO_DATE.test(manualStart) ? manualStart : undefined;
    const end = typeof manualEnd === 'string' && ISO_DATE.test(manualEnd) ? manualEnd : undefined;
    await addCalendarPick(id, { start, end });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id 가 필요합니다' }, { status: 400 });
  }
  await removeCalendarPick(id);
  return NextResponse.json({ ok: true });
}
