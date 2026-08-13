import { createHash } from 'node:crypto';
import type { Announcement, HousingType } from '@/types/announcement';
import { detectCity } from '@/lib/regions';
import { monthsAgoKST, todayKST } from '@/lib/filter';

// 한국부동산원 청약홈 분양정보 조회 서비스 (data.go.kr 15098547)
// - getAPTLttotPblancDetail   : APT 분양(민간·공공분양, 신혼희망타운)
// - getRemndrLttotPblancDetail : APT 무순위/잔여세대 (줍줍)
const BASE = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1';
const APPLYHOME_LIST = 'https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancListView.do';
const PER_PAGE = 100;
const MAX_PAGES = 5;
// 모집공고일 하한: 최근 개월 (활성 + 최근 마감분 확보. 표시 단계에서 3개월로 다시 정리됨)
const LOOKBACK_MONTHS = 6;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Row = Record<string, unknown>;

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// 여러 후보 필드 중 가장 늦은(또는 빠른) 유효 날짜(YYYY-MM-DD)를 고른다.
function pickDate(row: Row, keys: readonly string[], mode: 'max' | 'min'): string | undefined {
  const dates = keys.map((k) => str(row[k])).filter((d) => ISO_DATE_RE.test(d));
  if (dates.length === 0) return undefined;
  return dates.sort()[mode === 'max' ? dates.length - 1 : 0];
}

// APT 분양의 접수 마감일(일반공급·특별공급·순위별 접수 종료일 중 가장 늦은 날).
const APT_END_KEYS = [
  'RCEPT_ENDDE', 'SPSPLY_RCEPT_ENDDE',
  'GNRL_RNK1_CRSPAREA_ENDDE', 'GNRL_RNK1_ETC_AREA_ENDDE', 'GNRL_RNK1_ETC_GG_ENDDE',
  'GNRL_RNK2_CRSPAREA_ENDDE', 'GNRL_RNK2_ETC_AREA_ENDDE', 'GNRL_RNK2_ETC_GG_ENDDE',
] as const;
const APT_START_KEYS = [
  'SPSPLY_RCEPT_BGNDE', 'RCEPT_BGNDE', 'GNRL_RNK1_CRSPAREA_RCPTDE',
] as const;
// 줍줍(잔여세대)의 접수일.
const REMNDR_END_KEYS = ['SUBSCRPT_RCEPT_ENDDE', 'GNRL_RCEPT_ENDDE', 'SPSPLY_RCEPT_ENDDE'] as const;
const REMNDR_START_KEYS = ['SUBSCRPT_RCEPT_BGNDE', 'GNRL_RCEPT_BGNDE', 'SPSPLY_RCEPT_BGNDE'] as const;

function deriveStatus(applyStart: string | undefined, applyEnd: string | undefined): string {
  const today = todayKST();
  if (applyEnd && applyEnd < today) return '접수마감';
  if (applyStart && applyStart > today) return '공고중';
  return '접수중';
}

function detectAptType(row: Row): HousingType {
  const hay = `${str(row.HOUSE_DTL_SECD_NM)} ${str(row.HOUSE_NM)} ${str(row.RENT_SECD_NM)}`;
  if (hay.includes('신혼희망')) return '신혼희망타운';
  return '분양주택';
}

function mapRow(row: Row, kind: 'apt' | 'remndr', now: string): Announcement | null {
  const noticeNo = str(row.PBLANC_NO) || str(row.HOUSE_MANAGE_NO);
  const title = str(row.HOUSE_NM);
  if (!noticeNo || !title) return null;

  const region = str(row.SUBSCRPT_AREA_CODE_NM); // "경기" · "서울" 등
  const address = str(row.HSSPLY_ADRES);
  const city = detectCity(`${title} ${address}`);
  const postedAt = str(row.RCRIT_PBLANC_DE);
  const applyStart = pickDate(row, kind === 'apt' ? APT_START_KEYS : REMNDR_START_KEYS, 'min');
  const applyEnd = pickDate(row, kind === 'apt' ? APT_END_KEYS : REMNDR_END_KEYS, 'max');
  const housingType: HousingType = kind === 'remndr' ? '무순위' : detectAptType(row);
  const detailUrl = str(row.PBLANC_URL) || APPLYHOME_LIST;
  const id = sha1(`CHUNGYAK:${str(row.HOUSE_MANAGE_NO) || noticeNo}`);

  return {
    id,
    source: 'CHUNGYAK',
    noticeNo,
    title,
    housingType,
    region,
    city,
    postedAt,
    applyStart,
    applyEnd,
    status: deriveStatus(applyStart, applyEnd),
    detailUrl,
    isPriority: false,
    isNew: false,
    fetchedAt: now,
  };
}

async function fetchOp(
  op: string,
  key: string,
  region: string | undefined,
  gte: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(PER_PAGE),
      returnType: 'json',
      'cond[RCRIT_PBLANC_DE::GTE]': gte,
    });
    if (region) params.set('cond[SUBSCRPT_AREA_CODE_NM::EQ]', region);
    // serviceKey 는 이미 URL-encoding 된 키일 수 있어 직접 붙인다(이중 인코딩 방지).
    const url = `${BASE}/${op}?${params.toString()}&serviceKey=${key}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) {
        console.warn('[chungyak]', op, region ?? 'ALL', 'page', page, 'status', res.status);
        break;
      }
      const json = (await res.json()) as { data?: Row[] };
      const data = json.data ?? [];
      rows.push(...data);
      if (data.length < PER_PAGE) break;
    } catch (err: unknown) {
      console.error('[chungyak]', op, 'fetch failed:', err);
      break;
    }
  }
  return rows;
}

// regions: 조회할 공급지역명 목록(예: ['경기','서울']). 비어 있으면 전국.
export async function scrapeChungyak(regions: string[] = []): Promise<Announcement[]> {
  const key = process.env.CHUNGYAK_SERVICE_KEY;
  if (!key) {
    console.warn('[chungyak] CHUNGYAK_SERVICE_KEY 미설정 — 청약홈 수집 건너뜀');
    return [];
  }

  const now = new Date().toISOString();
  const gte = monthsAgoKST(LOOKBACK_MONTHS);
  const areas = regions.length > 0 ? regions : [undefined];
  const ops: Array<[string, 'apt' | 'remndr']> = [
    ['getAPTLttotPblancDetail', 'apt'],
    ['getRemndrLttotPblancDetail', 'remndr'],
  ];

  const byId = new Map<string, Announcement>();
  for (const [op, kind] of ops) {
    for (const area of areas) {
      const raw = await fetchOp(op, key, area, gte);
      for (const row of raw) {
        const a = mapRow(row, kind, now);
        if (a && !byId.has(a.id)) byId.set(a.id, a);
      }
    }
  }
  return [...byId.values()];
}
