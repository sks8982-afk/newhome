import type { Announcement } from '@/types/announcement';
import { scrapeLH } from './lh';
import {
  getUnnotifiedNewItems,
  loadAnnouncements,
  loadFilter,
  loadSeenIds,
  markNotified,
  markSeen,
  upsertAnnouncements,
} from '@/lib/db/store';
import { applyPriority, matchesFilter } from '@/lib/filter';
import { sendTelegramNotification } from '@/lib/notify/telegram';

export interface ScrapeResult {
  total: number;
  matched: number;
  newCount: number;
  newItems: Announcement[];
  notified: boolean;
}

export async function refreshAnnouncements(opts: { notify?: boolean } = {}): Promise<ScrapeResult> {
  const filter = await loadFilter();
  const seenIds = new Set(await loadSeenIds());

  const lhItems = await scrapeLH({
    housingType: filter.housingTypes[0],
    region: filter.regions[0],
  });

  const matched = lhItems.filter((a) => matchesFilter(a, filter));
  const prioritized = applyPriority(matched, filter);
  const tagged = prioritized.map((a) => ({ ...a, isNew: !seenIds.has(a.id) }));

  await upsertAnnouncements(tagged);

  const unnotified = await getUnnotifiedNewItems();
  // Telegram 알림 정책: 우선 도시(priorityCities) 매칭 공고만 발송.
  // 다른 매칭은 DB/사이트에 저장만 되고 알림은 안 감.
  const toNotify = unnotified.filter((a) => a.isPriority);
  let notified = false;
  if (opts.notify && toNotify.length > 0) {
    const ok = await sendTelegramNotification(toNotify);
    if (ok) {
      await markNotified(toNotify.map((i) => i.id));
      notified = true;
    }
  }
  // 우선 매칭이 아닌 unnotified도 markNotified 처리해서 재발송 막기 (이미 사이트에선 보임).
  const skipNotify = unnotified.filter((a) => !a.isPriority).map((i) => i.id);
  if (skipNotify.length > 0) {
    await markNotified(skipNotify);
  }

  return {
    total: lhItems.length,
    matched: matched.length,
    newCount: tagged.filter((a) => a.isNew).length,
    newItems: tagged.filter((a) => a.isNew),
    notified,
  };
}

export async function markAllSeen(): Promise<void> {
  const items = await loadAnnouncements();
  await markSeen(items.map((i) => i.id));
}
