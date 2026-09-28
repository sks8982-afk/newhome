import type { CalendarEvent } from './event';
import { addDays } from './event';

// iCalendar(RFC 5545) 피드 생성.
// 구글 캘린더 "URL로 추가"가 읽어가는 형식이라 규격을 정확히 지켜야 한다.

const CRLF = '\r\n';

/** TEXT 값 이스케이프 — 역슬래시·세미콜론·쉼표·개행 (RFC 5545 3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * 한 줄을 75옥텟으로 접는다(RFC 5545 3.1). 이어지는 줄은 공백 한 칸으로 시작.
 * 기준이 문자 수가 아니라 UTF-8 바이트 수라, 한글(3바이트)은 글자 중간에서
 * 잘리지 않도록 코드포인트 단위로 누적한다.
 */
function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf8');
    if (bytes + size > limit) {
      out.push(current);
      current = ' ';
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join(CRLF);
}

/** YYYY-MM-DD → YYYYMMDD (DATE 값 형식). */
function toDateValue(date: string): string {
  return date.replace(/-/g, '');
}

/** Date → YYYYMMDDTHHMMSSZ (UTC). */
function toStampValue(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

export interface IcsOptions {
  calendarName: string;
  /** DTSTAMP 로 쓸 시각. 테스트 재현성을 위해 주입 가능. */
  now?: Date;
}

export function buildIcs(events: CalendarEvent[], opts: IcsOptions): string {
  const stamp = toStampValue(opts.now ?? new Date());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//newhome//내집 알리미//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
    'X-WR-TIMEZONE:Asia/Seoul',
  ];

  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      // UID 는 공고 id 기준으로 고정 — 값이 바뀌면 구독자에게 새 일정이 아니라
      // 기존 일정의 수정으로 반영된다.
      `UID:${e.id}@newhome`,
      `DTSTAMP:${stamp}`,
      // 종일 일정의 DTEND 는 배타적(exclusive)이라 마지막 날 +1 을 넣어야
      // 해당 날짜까지 포함된다. (RFC 5545 3.6.1)
      `DTSTART;VALUE=DATE:${toDateValue(e.start)}`,
      `DTEND;VALUE=DATE:${toDateValue(addDays(e.end, 1))}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `URL:${escapeText(e.url)}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
