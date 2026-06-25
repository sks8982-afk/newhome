// 시(市) → 그 시에 속한 주요 동·신도시·지구 이름.
//
// 우선도시(priorityCities)나 지역 필터에 "화성"처럼 시 이름만 추가해도,
// 여기 등록된 하위 지역명("동탄","봉담"...)까지 자동으로 매칭된다.
// (예: 제목이 "병점복합타운 ..."처럼 '화성' 글자가 없어도 화성으로 인식)
//
// ⚠️ 부분일치(substring)로 매칭하므로 다른 행정구역과 글자가 겹치는 토큰은
//    오탐을 일으킨다. 아래 목록은 전국 타 시도 공고 약 2,400건에 대해
//    오탐 0건으로 검증된 안전 토큰만 담는다. 토큰 추가 시 같은 검증이 필요하다.
//    (배제 예: 광교→용인 겹침, 운암→광주 운암동, 가장→부사/대전 가장동,
//             남양→남양주 / 대신 "남양뉴타운" 사용, 태안→충남 태안군)
export const CITY_DISTRICTS: Record<string, readonly string[]> = {
  수원: ['영통', '권선', '팔달', '호매실', '매탄', '망포', '세류', '고색', '곡반정', '율전', '매교', '우만'],
  화성: ['동탄', '봉담', '향남', '병점', '비봉', '발안', '남양뉴타운', '송산그린시티', '새솔동', '진안동', '팔탄', '양감'],
  오산: ['세교', '궐동', '세마', '지곶', '수청', '갈곶', '누읍'],
};

// 도시명 + 그 도시의 하위 지역명을 합친 매칭 키워드 목록.
// 등록되지 않은 도시는 도시명 자체만 반환한다.
export function cityKeywords(city: string): string[] {
  return [city, ...(CITY_DISTRICTS[city] ?? [])];
}

// 텍스트에 하위 지역명이 있으면 상위 시(市)를 돌려준다 (예: "병점복합타운" → 화성).
// 어떤 하위 지역명에도 해당하지 않으면 undefined.
export function districtToCity(text: string): string | undefined {
  for (const [city, districts] of Object.entries(CITY_DISTRICTS)) {
    if (districts.some((d) => text.includes(d))) return city;
  }
  return undefined;
}
