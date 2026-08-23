import { createHash } from 'node:crypto';
import type { Announcement, HousingType } from '@/types/announcement';
import { detectCity } from '@/lib/regions';
import { monthsAgoKST, todayKST } from '@/lib/filter';
import { mapLimit } from '@/lib/util/concurrency';

// 한국부동산원 청약홈 분양정보 조회 서비스 (data.go.kr 15098547)
// - getAPTLttotPblancDetail   : APT 분양(민간·공공분양, 신혼희망타운)
// - getRemndrLttotPblancDetail : APT 무순위/잔여세대 (줍줍)
const BASE = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1';
const APPLYHOME_LIST = 'https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancListView.do';
const PER_PAGE = 100;
const MAX_PAGES = 5;
// 모집공고일 하한: 최근 개월 (활성 + 최근 마감분 확보. 표시 단계에서 3개월로 다시 정리됨)
const LOOKBACK_MONTHS = 6;
// 분양가(주택형별) 조회 동시성 — odcloud 초당 제한 회피용
const PRICE_CONCURRENCY = 3;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Row = Record<string, unknown>;

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// 문자열/숫자 어느 쪽이든 양의 정수로 (아니면 undefined).
function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
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

type Kind = 'apt' | 'remndr' | 'urbty';

function detectAptType(row: Row): HousingType {
  const hay = `${str(row.HOUSE_DTL_SECD_NM)} ${str(row.HOUSE_NM)} ${str(row.RENT_SECD_NM)}`;
  if (hay.includes('신혼희망')) return '신혼희망타운';
  return '분양주택';
}

// 오피스텔/도시형/생활숙박/민간임대 구분.
// HOUSE_SECD_NM 은 "도시형/오피스텔/생활숙박시설/민간임대" 합본 라벨이라 쓰면 안 됨.
// 개별 유형인 HOUSE_DTL_SECD_NM 로만 판별한다.
function detectUrbtyType(row: Row): HousingType {
  const dtl = str(row.HOUSE_DTL_SECD_NM);
  if (dtl.includes('민간임대')) return '민간임대';
  if (dtl.includes('생활숙박')) return '생활숙박시설';
  if (dtl.includes('도시형')) return '도시형생활주택';
  return '오피스텔';
}

function mapRow(row: Row, kind: Kind, now: string): Announcement | null {
  const noticeNo = str(row.PBLANC_NO) || str(row.HOUSE_MANAGE_NO);
  const title = str(row.HOUSE_NM);
  if (!noticeNo || !title) return null;

  const region = str(row.SUBSCRPT_AREA_CODE_NM); // "경기" · "서울" 등
  const address = str(row.HSSPLY_ADRES);
  const city = detectCity(`${title} ${address}`);
  const postedAt = str(row.RCRIT_PBLANC_DE);
  // apt 는 순위별 접수일, remndr/urbty 는 SUBSCRPT_RCEPT_* 를 쓴다.
  const startKeys = kind === 'apt' ? APT_START_KEYS : REMNDR_START_KEYS;
  const endKeys = kind === 'apt' ? APT_END_KEYS : REMNDR_END_KEYS;
  const applyStart = pickDate(row, startKeys, 'min');
  const applyEnd = pickDate(row, endKeys, 'max');
  const housingType: HousingType =
    kind === 'remndr' ? '무순위' : kind === 'urbty' ? detectUrbtyType(row) : detectAptType(row);
  const detailUrl = str(row.PBLANC_URL) || APPLYHOME_LIST;
  const id = sha1(`CHUNGYAK:${str(row.HOUSE_MANAGE_NO) || noticeNo}`);

  // 지도 검색용 주소 + 세대수(줍줍=잔여세대수)를 raw 에 저장 (모두 API 제공값).
  const units = num(row.TOT_SUPLY_HSHLDCO);
  const raw: Record<string, unknown> = {};
  if (address) raw.address = address;
  if (units) raw.units = units;

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
    raw: Object.keys(raw).length > 0 ? raw : undefined,
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

const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

interface MdlInfo {
  priceMin?: number; // 만원
  priceMax?: number;
  areaMin?: number; // 전용면적 ㎡
  areaMax?: number;
}

// 주택형별(평형별) 상세에서 분양가(만원)·전용면적(㎡, HOUSE_TY)을 뽑는다.
// 정상 응답은 항상 data 배열을 가지므로, data 가 없으면(초당 제한 등 일시 오류)
// 짧게 backoff 후 재시도한다. data:[] 같은 정상 응답은 재시도하지 않는다.
async function fetchMdlInfo(
  mdlOp: string,
  key: string,
  houseManageNo: string,
  attempt = 0,
): Promise<MdlInfo | undefined> {
  if (!houseManageNo) return {};
  const params = new URLSearchParams({
    page: '1',
    perPage: '50',
    returnType: 'json',
    'cond[HOUSE_MANAGE_NO::EQ]': houseManageNo,
  });
  const url = `${BASE}/${mdlOp}?${params.toString()}&serviceKey=${key}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { data?: Row[] };
      if (Array.isArray(json.data)) {
        // APT: LTTOT_TOP_AMOUNT / HOUSE_TY, 오피스텔: SUPLY_AMOUNT / EXCLUSE_AR (둘 다 만원·㎡)
        const amounts = json.data
          .map((r) => num(r.LTTOT_TOP_AMOUNT) ?? num(r.SUPLY_AMOUNT))
          .filter((n): n is number => n !== undefined);
        const sizes = json.data
          .map((r) => Number.parseFloat(str(r.HOUSE_TY) || str(r.EXCLUSE_AR) || str(r.TP)))
          .filter((n) => Number.isFinite(n) && n > 10 && n < 300);
        const info: MdlInfo = {};
        if (amounts.length > 0) { info.priceMin = Math.min(...amounts); info.priceMax = Math.max(...amounts); }
        if (sizes.length > 0) { info.areaMin = Math.min(...sizes); info.areaMax = Math.max(...sizes); }
        return info;
      }
    }
  } catch {
    /* 아래 재시도로 처리 */
  }
  if (attempt < 3) {
    await sleep(300 * (attempt + 1));
    return fetchMdlInfo(mdlOp, key, houseManageNo, attempt + 1);
  }
  return undefined;
}

interface Entry {
  a: Announcement;
  houseManageNo: string;
  kind: Kind;
}

// 종류별 주택형별(Mdl) 오퍼레이션.
const MDL_OP: Record<Kind, string> = {
  apt: 'getAPTLttotPblancMdl',
  remndr: 'getRemndrLttotPblancMdl',
  urbty: 'getUrbtyOfctlLttotPblancMdl',
};

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
  const ops: Array<[string, Kind]> = [
    ['getAPTLttotPblancDetail', 'apt'], // APT 분양(민간·공공분양·신혼희망타운)
    ['getRemndrLttotPblancDetail', 'remndr'], // APT 무순위/잔여세대(줍줍)
    ['getUrbtyOfctlLttotPblancDetail', 'urbty'], // 오피스텔/도시형/생활숙박/민간임대
  ];

  const byId = new Map<string, Entry>();
  for (const [op, kind] of ops) {
    for (const area of areas) {
      const rows = await fetchOp(op, key, area, gte);
      for (const row of rows) {
        const a = mapRow(row, kind, now);
        if (!a || byId.has(a.id)) continue;
        byId.set(a.id, { a, houseManageNo: str(row.HOUSE_MANAGE_NO) || a.noticeNo, kind });
      }
    }
  }

  // 공고마다 주택형별 API로 분양가·전용면적을 붙인다.
  // 동시성은 odcloud 초당 호출 제한을 넘지 않게 낮게 유지한다.
  const entries = [...byId.values()];
  return mapLimit(entries, PRICE_CONCURRENCY, async (e) => {
    const info = await fetchMdlInfo(MDL_OP[e.kind], key, e.houseManageNo);
    if (!info || (info.priceMin === undefined && info.areaMin === undefined)) return e.a;
    return {
      ...e.a,
      raw: {
        ...(e.a.raw ?? {}),
        ...(info.priceMin !== undefined ? { priceMin: info.priceMin, priceMax: info.priceMax } : {}),
        ...(info.areaMin !== undefined ? { areaMin: info.areaMin, areaMax: info.areaMax } : {}),
      },
    };
  });
}
