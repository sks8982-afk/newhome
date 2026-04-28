import type { Announcement } from '@/types/announcement';
import { scrapeLH } from './lh';
import {
  loadAnnouncements,
  loadFilter,
  loadSeenIds,
  markSeen,
  upsertAnnouncements,
} from '@/lib/db/store';
import { applyPriority, matchesFilter } from '@/lib/filter';
import { dispatchToChannels, type DispatchResult } from '@/lib/notify/channels';

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

  const lhItems = await scrapeLH();

  const matched = lhItems.filter((a) => matchesFilter(a, filter));
  const prioritized = applyPriority(matched, filter);
  const tagged = prioritized.map((a) => ({ ...a, isNew: !seenIds.has(a.id) }));

  await upsertAnnouncements(tagged);

  let dispatch: DispatchResult[] = [];
  if (opts.notify) {
    // Reload from DB so notifiedChannels[] reflects what each row already has.
    const all = await loadAnnouncements();
    dispatch = await dispatchToChannels(all);
  }

  return {
    total: lhItems.length,
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
