import type { CalendarEvent } from './event';
import { addDays } from './event';

// 구글 캘린더 "일정 추가" 링크. 구독 피드와 달리 즉시 반영된다.
// (구독 피드는 구글이 8~24시간마다만 읽어가므로 즉시성이 필요한 버튼은 이쪽을 쓴다.)
const GCAL_TEMPLATE = 'https://calendar.google.com/calendar/render';

export function googleCalendarUrl(e: CalendarEvent): string {
  // 종일 일정의 종료일은 배타적(exclusive)이라 마지막 날 +1 을 넣어야
  // 해당 날짜까지 포함된다. ICS 의 DTEND 와 같은 규칙.
  const dates = `${e.start.replace(/-/g, '')}/${addDays(e.end, 1).replace(/-/g, '')}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates,
    details: e.description,
    ctz: 'Asia/Seoul',
  });
  if (e.location) params.set('location', e.location);
  return `${GCAL_TEMPLATE}?${params.toString()}`;
}
