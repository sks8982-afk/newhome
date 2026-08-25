import { DEFAULT_PROFILE, type UserProfile } from '@/types/announcement';

// 프로필은 개인정보라 서버가 아닌 브라우저(localStorage)에만 저장한다.
const KEY = 'newhome.profile.v1';

export function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<UserProfile>) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: UserProfile): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 저장 실패 무시 */
  }
}

// 프로필이 실제로 설정됐는지(기본값과 다른 유의미한 입력이 있는지).
export function hasProfile(p: UserProfile): boolean {
  return p.birthDate !== '' || p.budgetEok > 0;
}
