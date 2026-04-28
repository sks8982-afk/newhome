export type Source = 'LH' | 'CHUNGYAK';

export type HousingType =
  | '행복주택'
  | '국민임대'
  | '영구임대'
  | '공공임대'
  | '분양주택'
  | '신혼희망타운'
  | '기타';

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
  detailUrl: string;
  isPriority: boolean;
  isNew: boolean;
  fetchedAt: string;
  raw?: Record<string, unknown>;
}

export interface UserFilter {
  housingTypes: HousingType[];
  regions: string[];
  priorityCities: string[];
}

export const DEFAULT_FILTER: UserFilter = {
  housingTypes: ['행복주택'],
  regions: ['경기'],
  priorityCities: ['수원', '화성', '오산'],
};
