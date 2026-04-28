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
  let notified = false;
  if (opts.notify && unnotified.length > 0) {
    const ok = await sendTelegramNotification(unnotified);
    if (ok) {
      await markNotified(unnotified.map((i) => i.id));
      notified = true;
    }
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
