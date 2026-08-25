import type {
  Announcement,
  HousingType,
  UserFilter,
  UserProfile,
} from '@/types/announcement';
import { cityKeywords } from './regions';

// 주택 유형을 3개 카테고리로 분류한다.
//  - 줍줍: 무순위/잔여세대 (청약홈)
//  - 분양: 분양주택·신혼희망타운 (LH 분양 mi1027 + 청약홈 APT 분양)
//  - 임대: 그 외 전부 (행복주택·국민/영구/공공임대·기타)
const SALE_HOUSING_TYPES: readonly HousingType[] = [
  '분양주택', '신혼희망타운', '오피스텔', '도시형생활주택', '생활숙박시설',
];

export type HousingCategory = '임대' | '분양' | '줍줍';

export function housingCategory(a: Announcement): HousingCategory {
  if (a.housingType === '무순위' || a.housingType === '임의공급') return '줍줍';
  return SALE_HOUSING_TYPES.includes(a.housingType) ? '분양' : '임대';
}

// 건물 종류(물리적). 데이터로 구분 가능한 것만:
//  - 오피스텔 / 도시형·생숙(도시형생활주택·생활숙박시설) : 청약홈이 명시.
//  - 기타 : LH 매입·전세임대 등 물리적 종류 미상.
//  - 아파트 : 그 외(행복주택·국민/영구/공공임대·분양·무순위·임의공급·민간임대 등).
// (빌라·다세대·단독은 데이터에 표기가 없어 구분 불가.)
export type BuildingType = '아파트' | '오피스텔' | '도시형·생숙' | '기타';

export function buildingType(a: Announcement): BuildingType {
  switch (a.housingType) {
    case '오피스텔':
      return '오피스텔';
    case '도시형생활주택':
    case '생활숙박시설':
      return '도시형·생숙';
    case '기타':
      return '기타';
    default:
      return '아파트';
  }
}

export function matchesFilter(a: Announcement, f: UserFilter): boolean {
  const typeOk =
    f.housingTypes.length === 0 || f.housingTypes.includes(a.housingType);
  const regionOk =
    f.regions.length === 0 ||
    f.regions.some(
      (r) => a.region.includes(r) || (a.city ?? '').includes(r),
    );
  return typeOk && regionOk;
}

export function isPriorityCity(a: Announcement, f: UserFilter): boolean {
  if (f.priorityCities.length === 0) return false;
  // 우선도시 이름뿐 아니라 그 도시의 하위 지역명(동탄→화성 등)도 함께 매칭한다.
  const haystack = `${a.title} ${a.region} ${a.city ?? ''}`;
  return f.priorityCities.some((c) =>
    cityKeywords(c).some((kw) => haystack.includes(kw)),
  );
}

export function applyPriority(items: Announcement[], f: UserFilter): Announcement[] {
  return items.map((a) => ({ ...a, isPriority: isPriorityCity(a, f) }));
}

export function diffNew(prevSeen: string[], current: Announcement[]): Announcement[] {
  const seen = new Set(prevSeen);
  return current.filter((a) => !seen.has(a.id));
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 한국시간(KST, UTC+9) 기준 오늘 날짜를 YYYY-MM-DD 로 반환.
// 서버는 UTC 로 동작하므로 9시간을 더해 자정 부근 하루 밀림을 방지한다.
export function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 한국시간 기준 오늘에서 months 개월 이전 날짜를 YYYY-MM-DD 로 반환.
// 이전(마감) 공고를 보여줄 때의 하한 컷오프로 사용한다.
export function monthsAgoKST(months: number): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kst.setUTCMonth(kst.getUTCMonth() - months);
  return kst.toISOString().slice(0, 10);
}

// 마감일(applyEnd)이 오늘보다 이전이면 마감된(만료된) 공고로 본다.
// - 마감일 당일은 아직 유효(>= today)하므로 표시한다.
// - applyEnd 가 없거나 YYYY-MM-DD 형식이 아니면 만료로 보지 않는다(표시 유지).
export function isExpired(a: Announcement, today: string = todayKST()): boolean {
  const end = a.applyEnd;
  if (!end || !ISO_DATE_RE.test(end)) return false;
  return end < today;
}

// 생년월일(YYYY-MM-DD) → 만 나이. 형식이 틀리면 undefined.
export function ageFromKST(birthDate: string, today: string = todayKST()): number | undefined {
  if (!ISO_DATE_RE.test(birthDate)) return undefined;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

// 내 조건 대략 매칭 (마감 전 공고 대상).
//  - 분양/줍줍/오피스텔: 최고분양가 ≤ 예산(억)
//  - 임대: 무주택 필수 + 나이로 청년/고령 전용 공고만 걸러냄
// (소득·자산 상한, 특별공급 자격, 정확한 1순위는 공고문 확인 필요 — 대략 분류용)
export function matchesProfile(
  a: Announcement,
  p: UserProfile,
  today: string = todayKST(),
): boolean {
  if (isExpired(a, today)) return false;
  // 관심지역만 — 우선도시(수원·화성·오산, isPriority) + 서울. 나머지 지역은 제외.
  if (!a.isPriority && !a.region.includes('서울')) return false;
  const cat = housingCategory(a);

  if (cat === '분양' || cat === '줍줍') {
    if (!p.budgetEok) return false;
    const priceMax = typeof a.raw?.priceMax === 'number' ? a.raw.priceMax : undefined;
    return priceMax !== undefined && priceMax <= p.budgetEok * 10000; // raw 가격은 만원 단위
  }

  // 임대
  if (!p.isHomeless) return false;
  const age = ageFromKST(p.birthDate, today);
  if (age !== undefined) {
    if ((a.title.includes('고령') || a.title.includes('경로')) && age < 60) return false;
    if (a.title.includes('청년') && (age < 19 || age > 39)) return false;
  }
  return true;
}
