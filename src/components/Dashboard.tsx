'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Announcement, UserFilter } from '@/types/announcement';
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

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/announcements', { cache: 'no-store' });
      if (!res.ok) throw new Error(`목록 로드 실패: ${res.status}`);
      const data = (await res.json()) as ListResponse;
      setItems(data.items);
      setFilter(data.filter);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, []);

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

  // initial scrape if no items
  useEffect(() => {
    if (!loading && items.length === 0 && !refreshing && !error) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const newItems = useMemo(() => items.filter((i) => i.isNew), [items]);
  const priorityItems = useMemo(() => items.filter((i) => i.isPriority), [items]);
  const otherItems = useMemo(() => items.filter((i) => !i.isPriority), [items]);

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
              📱 알림 <span className="font-semibold text-priority-700">{filter.priorityCities.join(', ') || '없음'}</span>
              <span className="ml-1 text-slate-400">(우선지역만 텔레그램 발송)</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {lastRefresh && <span>마지막 수집 {lastRefresh}</span>}
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

      <Calendar items={items} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">⭐ 우선 지역 ({priorityItems.length})</h2>
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
        <h2 className="mb-3 text-lg font-semibold">기타 매칭 공고 ({otherItems.length}) <span className="text-xs font-normal text-slate-400">— 알림 발송 X, 사이트에만 표시</span></h2>
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
