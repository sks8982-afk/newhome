'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Announcement, UserFilter, UserProfile } from '@/types/announcement';
import { DEFAULT_PROFILE } from '@/types/announcement';
import { buildingType, housingCategory, matchesProfile } from '@/lib/filter';
import { cityKeywords } from '@/lib/regions';
import { hasProfile, loadProfile } from '@/lib/profile';
import { AnnouncementCard } from './AnnouncementCard';
import { Calendar } from './Calendar';
import { NotificationBanner } from './NotificationBanner';

interface ListResponse {
  items: Announcement[];
  filter: UserFilter;
}

export function Dashboard(): React.ReactElement {
  const [items, setItems] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<UserFilter | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includePast, setIncludePast] = useState<boolean>(false);
  const [showRental, setShowRental] = useState<boolean>(true);
  const [showSale, setShowSale] = useState<boolean>(true);
  const [showJupjup, setShowJupjup] = useState<boolean>(true);
  const [uncheckedBuildings, setUncheckedBuildings] = useState<Set<string>>(new Set());
  const [uncheckedCities, setUncheckedCities] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const url = includePast
        ? '/api/announcements?includePast=1'
        : '/api/announcements';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`목록 로드 실패: ${res.status}`);
      const data = (await res.json()) as ListResponse;
      setItems(data.items);
      setFilter(data.filter);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [includePast]);

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      if (!res.ok) throw new Error(`수집 실패: ${res.status}`);
      setLastRefresh(new Date().toLocaleString('ko-KR'));
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const dismissNew = useCallback(async (): Promise<void> => {
    await fetch('/api/seen', { method: 'POST' });
    await load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  // 페이지 로드 시 LH 자동 호출은 의도적으로 하지 않습니다.
  // - 데이터는 매일 10시 cron이 채워두므로 DB만 읽으면 충분.
  // - 새 정보가 필요하면 사용자가 '🔄 지금 새로고침' 버튼을 누르면 됨.

  // 현재 목록에 실제로 존재하는 건물 종류(체크박스 표시용).
  const presentBuildings = useMemo(() => {
    const order = ['아파트', '오피스텔', '도시형·생숙', '기타'];
    const set = new Set(items.map((i) => buildingType(i)));
    return order.filter((b) => set.has(b as ReturnType<typeof buildingType>));
  }, [items]);

  // 임대/분양/줍줍(카테고리) + 건물종류 체크 필터: 켜진 것만 표시.
  const visibleItems = useMemo(
    () =>
      items.filter((i) => {
        const cat = housingCategory(i);
        const catOn =
          (showRental && cat === '임대') ||
          (showSale && cat === '분양') ||
          (showJupjup && cat === '줍줍');
        return catOn && !uncheckedBuildings.has(buildingType(i));
      }),
    [items, showRental, showSale, showJupjup, uncheckedBuildings],
  );

  // 우선 도시 체크 필터: 설정의 priorityCities 로 체크박스를 만들고,
  // 체크 해제한 도시에 해당하는 '우선' 공고는 숨긴다. (비우선 공고는 영향 없음)
  const priorityCities = useMemo(() => filter?.priorityCities ?? [], [filter]);
  const enabledCities = useMemo(
    () => priorityCities.filter((c) => !uncheckedCities.has(c)),
    [priorityCities, uncheckedCities],
  );
  const cityFilteredItems = useMemo(
    () =>
      visibleItems.filter((i) => {
        if (!i.isPriority) return true;
        const hay = `${i.title} ${i.region} ${i.city ?? ''}`;
        return enabledCities.some((c) => cityKeywords(c).some((kw) => hay.includes(kw)));
      }),
    [visibleItems, enabledCities],
  );

  // 🎯 내 조건 맞춤: 프로필(예산·무주택·나이) 기준 대략 매칭 (마감 전만).
  const matchedItems = useMemo(
    () => cityFilteredItems.filter((i) => matchesProfile(i, profile)),
    [cityFilteredItems, profile],
  );

  const newItems = useMemo(() => cityFilteredItems.filter((i) => i.isNew), [cityFilteredItems]);
  const priorityItems = useMemo(() => cityFilteredItems.filter((i) => i.isPriority), [cityFilteredItems]);
  const seoulItems = useMemo(
    () => cityFilteredItems.filter((i) => !i.isPriority && i.region.includes('서울')),
    [cityFilteredItems],
  );
  const otherItems = useMemo(
    () => cityFilteredItems.filter((i) => !i.isPriority && !i.region.includes('서울')),
    [cityFilteredItems],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
        <div className="text-sm text-slate-700">
          {filter && (
            <>
              <span className="font-semibold">필터</span>
              {' · '}
              유형 {filter.housingTypes.length === 0 ? '전체' : filter.housingTypes.join(', ')}
              {' · '}
              지역 {filter.regions.join(', ') || '전체'}
              {' · '}
              📱 알림 <span className="font-semibold text-priority-700">⭐{filter.priorityCities.join('·') || '없음'}</span>
              <span className="mx-1 text-slate-300">/</span>
              <span className="font-semibold text-blue-700">🏙️ 서울 전체</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {lastRefresh && <span>마지막 수집 {lastRefresh}</span>}
          <span className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
            <span className="text-slate-400">유형</span>
            <label className="flex cursor-pointer select-none items-center gap-1 text-slate-700">
              <input
                type="checkbox"
                checked={showRental}
                onChange={(e) => setShowRental(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              임대
            </label>
            <label className="flex cursor-pointer select-none items-center gap-1 text-slate-700">
              <input
                type="checkbox"
                checked={showSale}
                onChange={(e) => setShowSale(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              분양
            </label>
            <label className="flex cursor-pointer select-none items-center gap-1 text-slate-700">
              <input
                type="checkbox"
                checked={showJupjup}
                onChange={(e) => setShowJupjup(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              줍줍
            </label>
          </span>
          {presentBuildings.length > 1 && (
            <span className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
              <span className="text-slate-400">종류</span>
              {presentBuildings.map((b) => (
                <label key={b} className="flex cursor-pointer select-none items-center gap-1 text-slate-700">
                  <input
                    type="checkbox"
                    checked={!uncheckedBuildings.has(b)}
                    onChange={() =>
                      setUncheckedBuildings((prev) => {
                        const next = new Set(prev);
                        if (next.has(b)) next.delete(b);
                        else next.add(b);
                        return next;
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  {b}
                </label>
              ))}
            </span>
          )}
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-slate-600">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            마감된 이전 공고 보기 <span className="text-slate-400">(최근 3개월)</span>
          </label>
          <button
            type="button"
            onClick={() => { void refresh(); }}
            disabled={refreshing}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {refreshing ? '수집 중...' : '🔄 지금 새로고침'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <NotificationBanner newItems={newItems} onDismiss={() => { void dismissNew(); }} />

      <section className="rounded-lg border border-priority-400 bg-priority-50 p-4">
        <h2 className="mb-1 text-lg font-semibold">
          🎯 내 조건 맞춤 ({matchedItems.length})
          <span className="ml-2 text-xs font-normal text-slate-500">
            — 분양·줍줍 예산 이하 + 임대 무주택 자격(대략)
          </span>
        </h2>
        {!hasProfile(profile) ? (
          <p className="rounded-md border border-dashed border-priority-300 bg-white p-4 text-center text-sm text-slate-500">
            <a href="/settings" className="font-semibold text-priority-700 underline">
              설정 → 🎯 내 조건
            </a>
            에서 생년월일·예산 등을 입력하면 맞는 공고만 모아서 보여드립니다.
          </p>
        ) : matchedItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-priority-300 bg-white p-4 text-center text-sm text-slate-500">
            지금 조건에 맞는(마감 전) 공고가 없습니다. 예산을 올리거나 새로고침해 보세요.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {matchedItems.map((i) => (
              <AnnouncementCard key={i.id} item={i} />
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          ※ 대략 분류입니다. 소득·자산 상한, 특별공급 자격, 정확한 1순위는 공고문을 확인하세요.
        </p>
      </section>

      <Calendar items={cityFilteredItems} />

      {priorityCities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
          <span className="font-semibold text-slate-700">⭐ 우선 지역 필터</span>
          <span className="text-xs text-slate-400">— 체크 해제한 지역은 숨김</span>
          {priorityCities.map((c) => (
            <label
              key={c}
              className="ml-1 flex cursor-pointer select-none items-center gap-1 rounded-full border border-priority-500 bg-priority-50 px-2.5 py-0.5 text-priority-700"
            >
              <input
                type="checkbox"
                checked={!uncheckedCities.has(c)}
                onChange={() =>
                  setUncheckedCities((prev) => {
                    const next = new Set(prev);
                    if (next.has(c)) next.delete(c);
                    else next.add(c);
                    return next;
                  })
                }
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              {c}
            </label>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          ⭐ 우선 지역 ({priorityItems.length})
          <span className="ml-2 text-xs font-normal text-slate-400">— 경기 채널 알림 대상</span>
        </h2>
        {priorityItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            우선 지역(수원·화성·오산) 공고가 아직 없습니다.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {priorityItems.map((i) => (
              <AnnouncementCard key={i.id} item={i} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          🏙️ 서울 지역 ({seoulItems.length})
          <span className="ml-2 text-xs font-normal text-slate-400">— 서울 채널 알림 대상</span>
        </h2>
        {seoulItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            서울 매칭 공고가 아직 없습니다.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {seoulItems.map((i) => (
              <AnnouncementCard key={i.id} item={i} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          📋 기타 매칭 공고 ({otherItems.length})
          <span className="ml-2 text-xs font-normal text-slate-400">— 알림 발송 X, 사이트에만 표시</span>
        </h2>
        {otherItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            매칭되는 공고가 없습니다.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {otherItems.map((i) => (
              <AnnouncementCard key={i.id} item={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
