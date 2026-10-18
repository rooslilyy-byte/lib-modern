export const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || '8979060793:AAGFXkNqRbw3vQIw37dUHLXWXeC4BaQ0E-U';

export const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CHAT_ID || '6812050393';

/**
 * Escapes characters that have special meaning in Telegram's HTML parse mode.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send a message to a Telegram chat using standard POST fetch to Telegram Bot API.
 */
export async function sendTelegramMessage(
  text: string,
  replyMarkup?: any,
  chatId?: string | number
): Promise<any> {
  const targetChat = chatId || TELEGRAM_CHAT_ID;
  if (!targetChat || !TELEGRAM_BOT_TOKEN) {
    console.warn('Telegram token or chat ID is missing. Skipping notification.');
    return null;
  }

  try {
    const payload: Record<string, any> = {
      chat_id: targetChat,
      text,
      parse_mode: 'HTML',
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.warn('Telegram API sendMessage response not OK:', data);
    }
    return data;
  } catch (error) {
    console.error('Failed to dispatch Telegram message:', error);
    return null;
  }
}

/**
 * Answer a Telegram callback query to dismiss the loading state on the client.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  if (!callbackQueryId || !TELEGRAM_BOT_TOKEN) return false;

  try {
    const payload: Record<string, any> = {
      callback_query_id: callbackQueryId,
    };
    if (text) {
      payload.text = text;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    return Boolean(data.ok);
  } catch (error) {
    console.error('Failed to answer Telegram callback query:', error);
    return false;
  }
}

export const SHORTAGE_INLINE_BUTTONS = {
  inline_keyboard: [
    [
      {
        text: '📦 قائمة الخصاصات العادية',
        callback_data: 'shortages_regular',
      },
      {
        text: '🚫 السلع المقطوعة',
        callback_data: 'shortages_out_of_stock',
      },
    ],
  ],
};

/**
 * Sort products alphabetically: Arabic first (localeCompare 'ar'),
 * then Latin/French (localeCompare 'fr' sensitivity 'base').
 */
export function sortArabicFirst<T extends { name: string }>(items: T[]): T[] {
  const arabicRegex = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

  const arabicList: T[] = [];
  const latinList: T[] = [];

  for (const item of items) {
    const trimmed = (item.name || '').trim();
    if (arabicRegex.test(trimmed)) {
      arabicList.push(item);
    } else {
      latinList.push(item);
    }
  }

  arabicList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  latinList.sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' })
  );

  return [...arabicList, ...latinList];
}

/**
 * Notify the group/chat about a newly requested shortage item.
 */
export async function notifyNewShortage(
  productName: string,
  quantity: number,
  category: string
): Promise<any> {
  const safeName = escapeHtml(productName.trim());
  const safeCat = escapeHtml(category.trim());
  const safeQty = Math.max(1, Math.floor(quantity || 1));

  const text = [
    `<b>${safeName}</b>`,
    `الكمية: ${safeQty} قطعة | الصنف: ${safeCat}`,
  ].join('\n');

  return sendTelegramMessage(text, SHORTAGE_INLINE_BUTTONS);
}
