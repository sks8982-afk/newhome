import type { Announcement } from '@/types/announcement';

const TELEGRAM_API = 'https://api.telegram.org';

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: unknown;
}

function escapeMarkdownV2(text: string): string {
  // chars to escape per Telegram MarkdownV2 spec
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (m) => `\\${m}`);
}

function renderMessage(items: Announcement[]): string {
  const priority = items.filter((i) => i.isPriority);
  const others = items.filter((i) => !i.isPriority);
  const lines: string[] = [];
  lines.push(`🏠 *새 청약 공고 ${items.length}건*`);
  lines.push('');

  const renderItem = (a: Announcement): string => {
    const star = a.isPriority ? '⭐ ' : '• ';
    const title = escapeMarkdownV2(a.title);
    const metaParts = [
      a.housingType,
      a.region,
      a.city,
      a.status,
      `게시 ${a.postedAt || '-'}`,
      a.applyEnd ? `마감 ${a.applyEnd}` : null,
    ].filter(Boolean);
    const meta = escapeMarkdownV2(metaParts.join(' · '));
    const url = a.detailUrl;
    return `${star}[${title}](${url})\n   _${meta}_`;
  };

  if (priority.length > 0) {
    lines.push(`⭐ *우선 지역 ${priority.length}건*`);
    lines.push(...priority.map(renderItem));
    lines.push('');
  }
  if (others.length > 0) {
    lines.push(`📋 *기타 매칭 ${others.length}건*`);
    lines.push(...others.map(renderItem));
  }
  return lines.join('\n');
}

export async function sendTelegramNotification(items: Announcement[]): Promise<boolean> {
  if (items.length === 0) return false;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[notify] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing, skipping');
    return false;
  }

  const text = renderMessage(items);

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json()) as TelegramResponse;
    if (!data.ok) {
      console.error('[notify] telegram error', data.description);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error('[notify] telegram send failed', err);
    return false;
  }
}
