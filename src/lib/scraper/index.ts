import type { Announcement } from '@/types/announcement';
import { scrapeLH, enrichLhSaleItems } from './lh';
import { scrapeChungyak } from './chungyak';
import {
  loadAnnouncements,
  loadFilter,
  loadSeenIds,
  markSeen,
  upsertAnnouncements,
} from '@/lib/db/store';
import { applyPriority, matchesFilter, monthsAgoKST } from '@/lib/filter';
import { dispatchToChannels, type DispatchResult } from '@/lib/notify/channels';

// 이미 저장된 LH 분양 중 금액/주소가 아직 없는 항목(마감 3개월 이내)을 상세페이지로 보강.
// 마감되어 활성 목록에서 빠진 과거 공고까지 커버. 한 번 채워지면 다음엔 건너뛴다.
const BACKFILL_MAX = 40;
async function backfillLhDetails(): Promise<void> {
  const cutoff = monthsAgoKST(3);
  const stored = await loadAnnouncements();
  const need = stored
    .filter(
      (a) =>
        a.source === 'LH' &&
        (a.housingType === '분양주택' || a.housingType === '신혼희망타운') &&
        a.raw?.address === undefined &&
        a.raw?.priceMin === undefined &&
        a.raw?.enrichTried === undefined && // 이미 시도한 건 재시도 안 함
        (a.applyEnd === undefined || a.applyEnd >= cutoff),
    )
    .slice(0, BACKFILL_MAX);
  if (need.length === 0) return;
  const enriched = await enrichLhSaleItems(need);
  // 금액/주소를 못 얻은 항목(든든전세·잔여매각 등)은 enrichTried 표시로 재시도 방지.
  const toUpsert = enriched.map((a) =>
    a.raw?.address !== undefined || a.raw?.priceMin !== undefined
      ? a
      : { ...a, raw: { ...(a.raw ?? {}), enrichTried: true } },
  );
  await upsertAnnouncements(toUpsert);
}

export interface ScrapeResult {
  total: number;
  matched: number;
  newCount: number;
  newItems: Announcement[];
  notified: boolean;
  dispatch: DispatchResult[];
}

export async function refreshAnnouncements(
  opts: { notify?: boolean } = {},
): Promise<ScrapeResult> {
  const filter = await loadFilter();
  const seenIds = new Set(await loadSeenIds());

  // LH(임대/분양) + 청약홈(민간·공공분양, 줍줍)을 함께 수집.
  const [lhItems, chungyakItems] = await Promise.all([
    scrapeLH(),
    scrapeChungyak(filter.regions),
  ]);
  const allItems = [...lhItems, ...chungyakItems];

  const matched = allItems.filter((a) => matchesFilter(a, filter));
  const prioritized = applyPriority(matched, filter);
  const tagged = prioritized.map((a) => ({ ...a, isNew: !seenIds.has(a.id) }));

  await upsertAnnouncements(tagged);

  // 저장분 중 LH 분양 상세(금액·주소) 미보강 항목 보강.
  await backfillLhDetails();

  let dispatch: DispatchResult[] = [];
  if (opts.notify) {
    // Reload from DB so notifiedChannels[] reflects what each row already has.
    const all = await loadAnnouncements();
    dispatch = await dispatchToChannels(all);
  }

  return {
    total: allItems.length,
    matched: matched.length,
    newCount: tagged.filter((a) => a.isNew).length,
    newItems: tagged.filter((a) => a.isNew),
    notified: dispatch.some((d) => d.sent > 0),
    dispatch,
  };
}

export async function markAllSeen(): Promise<void> {
  const items = await loadAnnouncements();
  await markSeen(items.map((i) => i.id));
}
