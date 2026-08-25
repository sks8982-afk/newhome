export type Source = 'LH' | 'CHUNGYAK';

export type HousingType =
  | '행복주택'
  | '국민임대'
  | '영구임대'
  | '공공임대'
  | '분양주택'
  | '신혼희망타운'
  | '무순위'
  | '임의공급'
  | '오피스텔'
  | '도시형생활주택'
  | '생활숙박시설'
  | '민간임대'
  | '기타';

export type AnnouncementStatus = '접수중' | '공고중' | '정정공고중' | '마감' | string;

export interface Announcement {
  id: string;
  source: Source;
  noticeNo: string;
  title: string;
  housingType: HousingType;
  region: string;
  city?: string;
  postedAt: string;
  applyStart?: string;
  applyEnd?: string;
  status?: AnnouncementStatus;
  detailUrl: string;
  isPriority: boolean;
  isNew: boolean;
  fetchedAt: string;
  notifiedChannels?: string[];
  raw?: Record<string, unknown>;
}

export interface UserFilter {
  housingTypes: HousingType[];
  regions: string[];
  priorityCities: string[];
}

// housingTypes: 비워두면 전체(공공임대/행복주택/영구임대/국민임대/분양 등 모두)
// priorityCities: Telegram 알림은 이 도시에 해당하는 공고만 발송
export const DEFAULT_FILTER: UserFilter = {
  housingTypes: [],
  regions: ['경기', '서울'],
  priorityCities: ['수원', '화성', '오산'],
};

// 내 조건 맞춤 매칭용 프로필 (브라우저 localStorage 저장).
export interface UserProfile {
  birthDate: string; // "YYYY-MM-DD" (빈 값이면 미설정)
  isHomeless: boolean; // 무주택 여부
  hasIncome: boolean; // 소득 있음
  savingsCount: number; // 청약통장 납입 횟수
  budgetEok: number; // 예산 상한(억). 0이면 예산 필터 미적용
}

export const DEFAULT_PROFILE: UserProfile = {
  birthDate: '',
  isHomeless: true,
  hasIncome: true,
  savingsCount: 0,
  budgetEok: 6,
};
