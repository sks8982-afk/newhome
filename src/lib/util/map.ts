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

// 지도 검색어: 정밀 주소면 주소, 아니면(택지지구 등) 단지명(+도시)으로.
export function mapSearchQuery(item: Announcement): string {
  const address = typeof item.raw?.address === 'string' ? item.raw.address : undefined;
  if (address && isPreciseAddress(address)) return address;
  const name = cleanName(item.title);
  if (name.length >= 4) return item.city ? `${item.city} ${name}` : name;
  return address ?? item.city ?? item.title;
}
