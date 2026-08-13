import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import type { Announcement, HousingType } from '@/types/announcement';
import { detectCity } from '@/lib/regions';
import { mapLimit } from '@/lib/util/concurrency';

const LH_BASE = 'https://apply.lh.or.kr';
const LH_LIST_PATH = `${LH_BASE}/lhapply/apply/wt/wrtanc/selectWrtancList.do`;
const LH_MAIN_URL = `${LH_BASE}/lhapply/main.do`;
// 수집 대상 LH 공고 메뉴 (목록 테이블 구조는 동일)
//   mi=1026: 임대주택(행복주택·국민임대·영구임대·공공임대 등)
//   mi=1027: 분양주택(분양주택·공공분양·신혼희망타운 등)
const LH_MENUS = ['1026', '1027'] as const;
const MAX_PAGES = 5;
const PAGE_SIZE = 50;

function buildListUrl(mi: string, page?: number): string {
  const paging = page ? `&currPage=${page}` : '';
  return `${LH_LIST_PATH}?mi=${mi}${paging}`;
}

const HOUSING_TYPE_KEYWORDS: Array<[string, HousingType]> = [
  ['행복주택', '행복주택'],
  ['신혼희망', '신혼희망타운'],
  ['국민임대', '국민임대'],
  ['영구임대', '영구임대'],
  ['공공임대', '공공임대'],
  ['분양', '분양주택'],
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

// 공고 상세 URL 패턴 (LH 청약플러스 클라이언트 JS 분석 결과):
//   data-id1 -> panId          (공고 고유 ID, 16자리 숫자)
//   data-id2 -> ccrCnntSysDsCd
//   data-id3 -> uppAisTpCd
//   data-id4 -> aisTpCd
function buildDetailUrl(
  mi: string,
  d1: string,
  d2: string,
  d3: string,
  d4: string,
): string {
  const params = new URLSearchParams({
    ccrCnntSysDsCd: d2,
    panId: d1,
    aisTpCd: d4,
    uppAisTpCd: d3,
    mi,
    panKdCd: '',
    otxtPanId: '',
  });
  return `${LH_BASE}/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?${params.toString()}`;
}

function parseList(html: string, mi: string): RawRow[] {
  const $ = cheerio.load(html);
  const rows: RawRow[] = [];

  $('table tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 8) return;

    const titleAnchor = $(tds[2]).find('a.wrtancInfoBtn').first();
    const d1 = titleAnchor.attr('data-id1') ?? '';
    const d2 = titleAnchor.attr('data-id2') ?? '';
    const d3 = titleAnchor.attr('data-id3') ?? '';
    const d4 = titleAnchor.attr('data-id4') ?? '';
    const noticeNo = d1 || $(tds[0]).text().trim();
    const typeText = $(tds[1]).text().trim();
    const title = cleanTitle(titleAnchor.text() || $(tds[2]).text());
    const region = $(tds[3]).text().trim();
    const postedAt = normalizeDate($(tds[5]).text());
    const applyEnd = normalizeDate($(tds[6]).text());
    const status = $(tds[7]).text().trim();

    if (!title || !noticeNo) return;

    const detailUrl =
      d1 && d2 && d3 && d4
        ? buildDetailUrl(mi, d1, d2, d3, d4)
        : buildListUrl(mi);

    rows.push({
      noticeNo,
      typeText,
      title,
      region,
      postedAt,
      applyEnd,
      status,
      detailUrl,
    });
  });

  return rows;
}

export interface ScrapeOptions {
  housingType?: HousingType;
  region?: string;
}

// 한 메뉴(mi)의 공고 목록을 페이지 순회하며 수집한다.
async function fetchMenuRows(
  mi: string,
  headers: Record<string, string>,
): Promise<RawRow[]> {
  const seen = new Map<string, RawRow>();
  let lastFirstNo = '';
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let pageRows: RawRow[] = [];
    try {
      const res = await fetch(buildListUrl(mi, page), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (!res.ok) {
        console.warn('[scrapeLH] mi', mi, 'page', page, 'non-200:', res.status);
        break;
      }
      const html = await res.text();
      if (html.includes('eGovFrame 템플릿') && html.includes('잘못된 경로')) {
        console.warn('[scrapeLH] error template (anti-bot block) mi', mi, 'page', page);
        break;
      }
      pageRows = parseList(html, mi);
    } catch (err: unknown) {
      console.error('[scrapeLH] mi', mi, 'page', page, 'fetch failed:', err);
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
  return [...seen.values()];
}

interface LhDetail {
  priceMin?: number; // 만원
  priceMax?: number; // 만원
  units?: number;
  address?: string;
}

// LH 분양 상세페이지 파싱: 주택형 안내 표의 '평균분양가격(원)'·'금회공급세대수',
// 그리고 공급위치(주소). 청약홈 API에 없는 정보라 여기서만 파싱한다.
function parseLhDetail(html: string): LhDetail {
  const $ = cheerio.load(html);
  const out: LhDetail = {};

  $('table').each((_, tbl) => {
    if (out.priceMin !== undefined) return;
    const trs = $(tbl).find('tr');
    if (trs.length < 2) return;
    const header = $(trs[0]).find('th,td').map((__, c) => $(c).text().replace(/\s+/g, '')).get();
    const priceIdx = header.findIndex((t) => t.includes('평균분양가격') || t.includes('분양가격'));
    if (priceIdx < 0) return;
    const unitIdx = header.findIndex((t) => t.includes('금회공급세대수'));
    const prices: number[] = [];
    let units = 0;
    trs.slice(1).each((__, tr) => {
      const cells = $(tr).find('th,td');
      if (cells.length <= priceIdx) return;
      const won = Number.parseInt($(cells[priceIdx]).text().replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(won) && won > 0) prices.push(won);
      if (unitIdx >= 0 && cells.length > unitIdx) {
        const u = Number.parseInt($(cells[unitIdx]).text().replace(/[^0-9]/g, ''), 10);
        if (Number.isFinite(u)) units += u;
      }
    });
    if (prices.length > 0) {
      out.priceMin = Math.round(Math.min(...prices) / 10000); // 원 → 만원
      out.priceMax = Math.round(Math.max(...prices) / 10000);
      if (units > 0) out.units = units;
    }
  });

  // 공급위치(주소) — 라벨 인접 셀에서 best-effort 추출.
  const label = $('th,td').filter((_, el) => /공급위치|대지위치|소재지/.test($(el).text().trim())).first();
  const addr = label.next('td').text().replace(/\s+/g, ' ').trim();
  if (addr && addr.length <= 120) out.address = addr;

  return out;
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

  // 임대(1026) + 분양(1027) 메뉴를 모두 수집하고 noticeNo(panId) 기준으로 중복 제거.
  const byNoticeNo = new Map<string, RawRow>();
  for (const mi of LH_MENUS) {
    const menuRows = await fetchMenuRows(mi, headers);
    for (const r of menuRows) {
      if (!byNoticeNo.has(r.noticeNo)) byNoticeNo.set(r.noticeNo, r);
    }
  }

  const rows = [...byNoticeNo.values()];

  const items = rows.map((r): Announcement => {
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

  // LH 분양(공공분양·신혼희망타운)만 상세페이지에서 금액·세대수·주소를 보강.
  // 임대는 분양가 개념이 없어 제외. (청약홈 API에 없어 파싱하는 최소 범위)
  const saleItems = items.filter(
    (a) => a.housingType === '분양주택' || a.housingType === '신혼희망타운',
  );
  const enriched = new Map<string, Announcement>();
  await mapLimit(saleItems, 4, async (a) => {
    try {
      const res = await fetch(a.detailUrl, { headers, cache: 'no-store' });
      if (!res.ok) return;
      const d = parseLhDetail(await res.text());
      const raw: Record<string, unknown> = {};
      if (d.priceMin !== undefined) { raw.priceMin = d.priceMin; raw.priceMax = d.priceMax; }
      if (d.units !== undefined) raw.units = d.units;
      if (d.address) raw.address = d.address;
      if (Object.keys(raw).length > 0) enriched.set(a.id, { ...a, raw });
    } catch {
      /* 상세 파싱 실패 시 금액 없이 표시 */
    }
  });
  return items.map((a) => enriched.get(a.id) ?? a);
}
