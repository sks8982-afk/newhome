import type { Announcement } from '@/types/announcement';
import { prisma } from '@/lib/db/client';
import { sendTelegramNotification } from './telegram';

export interface NotifyChannel {
  name: string;
  chatId: string;
  match: (a: Announcement) => boolean;
}

/**
 * Resolve active channels from environment.
 * Each entry only registers if its chat_id env var is present.
 *
 * Channels:
 *  - 경기 우선 : 경기도 매칭 + 우선도시(수원/화성/오산) 매칭에만 알림
 *  - 서울 전체 : 서울 매칭 모두 알림 (구 무관)
 */
export function getNotifyChannels(): NotifyChannel[] {
  const channels: NotifyChannel[] = [];

  // LH region 표기 정규화: "서울특별시 외" / "경기도 외" 같이 끝에 "외"가
  // 붙은 것은 전국 단위 공고(다자녀 전세임대 등)이므로 단일 지역 매칭에서 제외.
  const isPureRegion = (r: string, keyword: string): boolean => {
    const t = r.trim();
    return t.includes(keyword) && !t.includes('외');
  };

  if (process.env.TELEGRAM_CHAT_ID) {
    channels.push({
      name: '경기 우선',
      chatId: process.env.TELEGRAM_CHAT_ID,
      match: (a) => isPureRegion(a.region, '경기') && a.isPriority,
    });
  }

  if (process.env.TELEGRAM_CHAT_ID_SEOUL) {
    channels.push({
      name: '서울 전체',
      chatId: process.env.TELEGRAM_CHAT_ID_SEOUL,
      match: (a) => isPureRegion(a.region, '서울'),
    });
  }

  return channels;
}

export interface DispatchResult {
  channel: string;
  sent: number;
}

/**
 * For each registered channel, find items that:
 *   1) match the channel rule, and
 *   2) have NOT been notified to this channel's chatId yet.
 * Send them in one Telegram message per channel, then record the chatId
 * in announcement.notifiedChannels[] to prevent duplicates on next runs.
 */
export async function dispatchToChannels(
  items: Announcement[],
): Promise<DispatchResult[]> {
  const channels = getNotifyChannels();
  const results: DispatchResult[] = [];

  for (const ch of channels) {
    const eligible = items.filter(
      (a) => ch.match(a) && !(a.notifiedChannels ?? []).includes(ch.chatId),
    );
    if (eligible.length === 0) {
      results.push({ channel: ch.name, sent: 0 });
      continue;
    }

    const ok = await sendTelegramNotification(eligible, ch.chatId);
    if (!ok) {
      console.warn('[dispatch] failed to send to', ch.name);
      results.push({ channel: ch.name, sent: 0 });
      continue;
    }

    // Record per-channel notification so the same item won't ping
    // this channel again, even if other channels are still pending.
    await Promise.all(
      eligible.map((a) =>
        prisma.announcement.update({
          where: { id: a.id },
          data: {
            notifiedChannels: { push: ch.chatId },
            notifiedAt: a.fetchedAt ? undefined : new Date(),
          },
        }),
      ),
    );

    // legacy: stamp notifiedAt on first send for any channel
    await prisma.announcement.updateMany({
      where: { id: { in: eligible.map((a) => a.id) }, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });

    results.push({ channel: ch.name, sent: eligible.length });
  }

  return results;
}
