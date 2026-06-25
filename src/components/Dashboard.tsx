'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Announcement, UserFilter } from '@/types/announcement';
import { housingCategory } from '@/lib/filter';
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

  // 임대/분양 체크 필터: 둘 다 켜져 있으면 전체 표시.
  const visibleItems = useMemo(
    () =>
      items.filter((i) => {
        const cat = housingCategory(i);
        return (showRental && cat === '임대') || (showSale && cat === '분양');
      }),
    [items, showRental, showSale],
  );

  const newItems = useMemo(() => visibleItems.filter((i) => i.isNew), [visibleItems]);
  const priorityItems = useMemo(() => visibleItems.filter((i) => i.isPriority), [visibleItems]);
  const seoulItems = useMemo(
    () => visibleItems.filter((i) => !i.isPriority && i.region.includes('서울')),
    [visibleItems],
  );
  const otherItems = useMemo(
    () => visibleItems.filter((i) => !i.isPriority && !i.region.includes('서울')),
    [visibleItems],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
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
        <div className="flex items-center gap-2 text-xs text-slate-500">
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
          </span>
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

      <Calendar items={visibleItems} />

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
