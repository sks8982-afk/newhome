import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import type { Announcement, HousingType } from '@/types/announcement';

const LH_BASE = 'https://apply.lh.or.kr';
// mi=1026: 임대주택(행복주택 포함) 공고 목록 메뉴
const LH_LIST_URL = `${LH_BASE}/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026`;
const LH_MAIN_URL = `${LH_BASE}/lhapply/main.do`;
const MAX_PAGES = 5;
const PAGE_SIZE = 50;

const HOUSING_TYPE_KEYWORDS: Array<[string, HousingType]> = [
  ['행복주택', '행복주택'],
  ['신혼희망', '신혼희망타운'],
  ['국민임대', '국민임대'],
  ['영구임대', '영구임대'],
  ['공공임대', '공공임대'],
  ['분양', '분양주택'],
];

const KOREAN_CITIES = [
  '수원', '화성', '오산', '용인', '성남', '안양', '부천', '평택',
  '시흥', '안산', '광명', '의왕', '군포', '하남', '남양주', '구리',
  '의정부', '고양', '파주', '김포', '이천', '여주', '양주', '동두천',
  '광주', '안성', '포천',
];

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function detectHousingType(typeText: string, title: string): HousingType {
  const haystack = `${typeText} ${title}`;
  for (const [keyword, type] of HOUSING_TYPE_KEYWORDS) {
    if (haystack.includes(keyword)) return type;
  }
  return '기타';
}

function detectCity(text: string): string | undefined {
  return KOREAN_CITIES.find((c) => text.includes(c));
}

function normalizeDate(raw: string): string {
  // "2026.04.28" -> "2026-04-28"
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) {
    return trimmed.replace(/\./g, '-');
  }
  return trimmed;
}

function cleanTitle(raw: string): string {
  // "1일전" 같은 시간 라벨 제거 + 공백 정규화
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\s*\d+일전\s*$/, '')
    .replace(/\s*NEW\s*$/i, '')
    .trim();
}

interface RawRow {
  noticeNo: string;
  typeText: string;
  title: string;
  region: string;
  postedAt: string;
  applyEnd: string;
  status: string;
  detailUrl: string;
}

function parseList(html: string): RawRow[] {
  const $ = cheerio.load(html);
  const rows: RawRow[] = [];

  $('table tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 8) return;

    const titleAnchor = $(tds[2]).find('a').first();
    const noticeNo =
      titleAnchor.attr('data-id1') ?? $(tds[0]).text().trim();
    const typeText = $(tds[1]).text().trim();
    const title = cleanTitle(titleAnchor.text() || $(tds[2]).text());
    const region = $(tds[3]).text().trim();
    const postedAt = normalizeDate($(tds[5]).text());
    const applyEnd = normalizeDate($(tds[6]).text());
    const status = $(tds[7]).text().trim();

    if (!title || !noticeNo) return;

    rows.push({
      noticeNo,
      typeText,
      title,
      region,
      postedAt,
      applyEnd,
      status,
      // 정확한 detail URL 패턴은 알 수 없으므로 list 페이지로 fallback
      detailUrl: LH_LIST_URL,
    });
  });

  return rows;
}

export interface ScrapeOptions {
  housingType?: HousingType;
  region?: string;
}

export async function scrapeLH(_opts: ScrapeOptions = {}): Promise<Announcement[]> {
  const now = new Date().toISOString();

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    Referer: LH_MAIN_URL,
  };

  const seen = new Map<string, RawRow>();
  let lastFirstNo = '';
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let pageRows: RawRow[] = [];
    try {
      const res = await fetch(`${LH_LIST_URL}&currPage=${page}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (!res.ok) {
        console.warn('[scrapeLH] page', page, 'non-200:', res.status);
        break;
      }
      const html = await res.text();
      if (html.includes('eGovFrame 템플릿') && html.includes('잘못된 경로')) {
        console.warn('[scrapeLH] error template (anti-bot block) on page', page);
        break;
      }
      pageRows = parseList(html);
    } catch (err: unknown) {
      console.error('[scrapeLH] page', page, 'fetch failed:', err);
      break;
    }

    if (pageRows.length === 0) break;

    // LH returns the last page repeatedly when paging past the end.
    // Detect by comparing the first row number across pages.
    const firstNo = pageRows[0]?.noticeNo ?? '';
    if (page > 1 && firstNo === lastFirstNo) break;
    lastFirstNo = firstNo;

    for (const r of pageRows) {
      if (!seen.has(r.noticeNo)) seen.set(r.noticeNo, r);
    }

    // Last page is shorter than page size — no more data after.
    if (pageRows.length < PAGE_SIZE) break;
  }

  const rows = [...seen.values()];

  return rows.map((r): Announcement => {
    const housingType = detectHousingType(r.typeText, r.title);
    const city = detectCity(`${r.title} ${r.region}`);
    const id = sha1(`LH:${r.noticeNo}`);
    return {
      id,
      source: 'LH',
      noticeNo: r.noticeNo,
      title: r.title,
      housingType,
      region: r.region,
      city,
      postedAt: r.postedAt,
      applyEnd: r.applyEnd || undefined,
      status: r.status || undefined,
      detailUrl: r.detailUrl,
      isPriority: false,
      isNew: false,
      fetchedAt: now,
    };
  });
}
