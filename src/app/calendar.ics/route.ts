import { loadAnnouncements, loadCalendarPicks } from '@/lib/db/store';
import { toCalendarEvent } from '@/lib/calendar/event';
import { buildIcs } from '@/lib/calendar/ics';

export const dynamic = 'force-dynamic';

// 구글 캘린더 "URL로 추가"용 구독 피드.
// 사용자가 "캘린더에 추가"를 누른 공고만 담는다(전체 공고가 아님).
export async function GET(): Promise<Response> {
  try {
    const [picks, announcements] = await Promise.all([
      loadCalendarPicks(),
      loadAnnouncements(),
    ]);
    const byId = new Map(announcements.map((a) => [a.id, a]));

    const events = picks
      .map((p) => {
        const a = byId.get(p.announcementId);
        if (!a) return null;
        // 수동 입력 날짜가 있으면 공고의 신청일보다 우선한다.
        const merged = p.manualStart
          ? { ...a, applyStart: p.manualStart, applyEnd: p.manualEnd ?? a.applyEnd }
          : a;
        return toCalendarEvent(merged);
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const ics = buildIcs(events, { calendarName: '내집 알리미 - 신청일정' });

    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="newhome.ics"',
        // 구글이 자체 주기(8~24시간)로 가져가므로 중간 캐시는 두지 않는다.
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(`ICS 생성 실패: ${message}`, { status: 500 });
  }
}
