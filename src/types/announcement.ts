export type Source = 'LH' | 'CHUNGYAK';

export type HousingType =
  | '행복주택'
  | '국민임대'
  | '영구임대'
  | '공공임대'
  | '분양주택'
  | '신혼희망타운'
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
  regions: ['경기'],
  priorityCities: ['수원', '화성', '오산'],
};
