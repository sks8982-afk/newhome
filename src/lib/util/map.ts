import type { Announcement } from '@/types/announcement';

// 도로명+번호, 지번(동/리+숫자), 번지 표기가 있으면 지도에서 잡히는 '정밀 주소'로 본다.
// "동탄2택지개발지구 (A56블럭)", "OO지구 일원" 같은 뭉뚱그린 주소는 false.
function isPreciseAddress(addr: string): boolean {
  return (
    /[가-힣]+(로|길)\s*\d/.test(addr) || // 당수로 178
    /\d+번지/.test(addr) || //  88-39번지
    /[가-힣]+(동|리)\s*\d/.test(addr) || // 소사본동 88
    /\d+-\d+/.test(addr) // 328-2
  );
}

// 공고 제목에서 지도 검색용 단지명만 남긴다([정정공고]·(2회차)·모집공고 등 제거).
function cleanName(title: string): string {
  return title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[A-Za-z]-?\d+\s*블[록럭]/g, ' ') // A56블럭, A-5블록
    .replace(/잔여세대|예비입주자|추가입주자|입주자\s*모집|모집\s*공고|추가모집|추가|공고문?|공공분양|분양주택|주택|신혼희망타운/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 주소 안 괄호에 든 도로명주소를 우선 추출. 예: "…라프리미어(경기도 오산시 초평중앙로 65)"
// → "경기도 오산시 초평중앙로 65" (전체 문자열은 지도에서 안 잡히지만 이건 잡힘).
function roadAddressInParens(addr: string): string | undefined {
  for (const m of addr.matchAll(/\(([^)]{4,})\)/g)) {
    const inner = m[1].trim();
    if (/(로|길)\s*\d/.test(inner)) return inner;
  }
  return undefined;
}

// 정밀주소에서 괄호·블록·'일원/일대' 이하 꼬리를 정리해 핵심만 남긴다.
function tidyAddress(addr: string): string {
  return addr
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*[A-Za-z]-?\d+\s*블[록럭].*$/, '') // A-13블록 이하 제거
    .replace(/\s*(일원|일대)\b.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 지도 검색어: (1) 괄호 안 도로명주소 → (2) 정밀주소 정리본 → (3) 단지명(+도시).
export function mapSearchQuery(item: Announcement): string {
  const address = typeof item.raw?.address === 'string' ? item.raw.address : undefined;
  if (address) {
    const paren = roadAddressInParens(address);
    if (paren) return paren;
    if (isPreciseAddress(address)) {
      const tidy = tidyAddress(address);
      if (isPreciseAddress(tidy)) return tidy;
      // 정리 후 정밀도를 잃으면(택지지구+블록 등) 아래 단지명으로 폴백.
    }
  }
  const name = cleanName(item.title);
  if (name.length >= 4) return item.city ? `${item.city} ${name}` : name;
  return address ?? item.city ?? item.title;
}
