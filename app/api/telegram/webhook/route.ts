import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import {
  TELEGRAM_BOT_TOKEN,
  sendTelegramMessage,
  escapeHtml,
  sortArabicFirst,
  SHORTAGE_INLINE_BUTTONS,
} from '@/lib/telegram';
import { normalizeCategory } from '@/lib/categoryUtils';

export const dynamic = 'force-dynamic';

const PERSISTENT_KEYBOARD = {
  keyboard: [
    [{ text: '📦 قائمة الخصاصات العادية' }, { text: '🚫 السلع المقطوعة' }],
    [{ text: '📚 كتب فقط' }, { text: '✏️ أدوات فقط' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const RUPTURE_METADATA_PREFIX = '__METADATA_EN_RUPTURE__::';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action');
  const type = searchParams.get('type');
  const targetChatId = '6812050393';

  // STEP 1: Dedicated self-healing endpoint to register webhook with allowed_updates
  if (action === 'reset_webhook') {
    try {
      const webhookPayload = {
        url: 'https://lib-modern.vercel.app/api/telegram/webhook',
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      };

      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        }
      );

      const data = await response.json();
      return NextResponse.json({
        action: 'reset_webhook',
        sentPayload: webhookPayload,
        telegramResponse: data,
      }, { status: 200 });
    } catch (err: any) {
      console.error('[TELEGRAM_WEBHOOK] Failed to reset webhook:', err);
      return NextResponse.json({
        ok: false,
        error: err?.message || String(err),
      }, { status: 500 });
    }
  }

  // Inspect current Telegram webhook status & registered allowed_updates
  if (action === 'get_webhook_info') {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
    }
  }

  // Browser testing triggers
  if (type === 'regular') {
    await handleShortageQuery(targetChatId, 'regular', false);
    return NextResponse.json({
      success: true,
      message: 'Regular shortages sent to Telegram',
    });
  }

  if (type === 'out_of_stock') {
    await handleShortageQuery(targetChatId, 'out_of_stock', false);
    return NextResponse.json({
      success: true,
      message: 'Out of stock list sent to Telegram',
    });
  }

  return NextResponse.json({
    status: 'active',
    botTokenConfigured: Boolean(TELEGRAM_BOT_TOKEN),
    info: 'Visit ?action=reset_webhook to register allowed_updates, ?action=get_webhook_info to inspect, or ?type=regular to test.',
  });
}

/**
 * Query Supabase for shortage items and dispatch aggregated response.
 */
async function handleShortageQuery(
  chatId: string | number,
  filter: 'regular' | 'out_of_stock' | 'all' | 'books' | 'supplies',
  withBottomKeyboard: boolean = false
) {
  try {
    // 1. Query Supabase for demand items, master products, and rupture metadata row
    const [itemsResult, masterResult, ruptureBatchesResult] = await Promise.all([
      supabaseAdmin
        .from('demand_items')
        .select(`
          id,
          product_name,
          quantity,
          fulfilled_quantity,
          is_in_stock,
          is_delivered,
          status
        `),
      supabaseAdmin
        .from('master_products')
        .select('name, category'),
      supabaseAdmin
        .from('purchase_batches')
        .select('id, batch_name')
        .like('batch_name', `${RUPTURE_METADATA_PREFIX}%`)
        .limit(1),
    ]);

    const rawDemandItems = itemsResult.data || [];
    const masterProducts = masterResult.data || [];

    // Parse rupture products set exactly like the dashboard
    const ruptureProducts = new Set<string>();
    const ruptureRow = ruptureBatchesResult.data?.[0];
    if (ruptureRow && ruptureRow.batch_name) {
      try {
        const rawJson = ruptureRow.batch_name.slice(RUPTURE_METADATA_PREFIX.length);
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            ruptureProducts.add(String(p).trim().toLowerCase());
          }
        }
      } catch (e) {
        console.warn('Error parsing rupture metadata json:', e);
      }
    }

    // 2. Build category map for quick lookup
    const categoryMap = new Map<string, string>();
    for (const mp of masterProducts) {
      if (mp && mp.name) {
        categoryMap.set(mp.name.trim().toLowerCase(), mp.category || 'كتب');
      }
    }

    // 3. Aggregate shortage items by product name matching dashboard criteria
    const aggregated = new Map<string, { name: string; quantity: number }>();

    for (const it of rawDemandItems) {
      if (!it) continue;
      const rawName = (it.product_name || '').trim();
      if (!rawName) continue;

      // Filter out items already delivered or marked in stock
      if (it.is_delivered || it.is_in_stock) continue;

      const totalQty = Number(it.quantity) || 0;
      const fulfilled = Number(it.fulfilled_quantity) || 0;
      const stillNeeded = Math.max(0, totalQty - fulfilled);
      if (stillNeeded <= 0) continue;

      const normKey = rawName.toLowerCase();
      const statusStr = String(it.status || '').trim().toLowerCase();

      // Check if product is discontinued / out of stock (En Rupture)
      const isRupture =
        statusStr === 'en_rupture' ||
        statusStr === 'مقطوع' ||
        statusStr === 'مقطوعة' ||
        statusStr.includes('rupture') ||
        ruptureProducts.has(normKey);

      if (filter === 'out_of_stock') {
        if (!isRupture) continue;
      } else if (filter === 'regular') {
        if (isRupture) continue;
      }

      const prodCategory = categoryMap.get(normKey) || 'كتب';
      const normCat = normalizeCategory(prodCategory);

      // Apply category filter if requested
      if (filter === 'books') {
        if (normCat !== 'books' && prodCategory !== 'كتب') continue;
      } else if (filter === 'supplies') {
        if (normCat !== 'fournitures' && prodCategory !== 'أدوات' && normCat !== 'others') continue;
      }

      const existing = aggregated.get(normKey);
      if (existing) {
        existing.quantity += stillNeeded;
      } else {
        aggregated.set(normKey, { name: rawName, quantity: stillNeeded });
      }
    }

    // Arabic-first alphabetical sorting
    const sortedList = sortArabicFirst(Array.from(aggregated.values()));
    const totalSum = sortedList.reduce((acc, curr) => acc + curr.quantity, 0);

    let headerTitle = '<b>قائمة الخصاصات العادية</b>\n───────────────';
    let emptyMessage = 'لا يوجد أي خصاص عادي حالياً.';
    let summaryTitle = 'مجموع قطع الخصاص';

    if (filter === 'out_of_stock') {
      headerTitle = '<b>قائمة السلع المقطوعة</b>\n───────────────';
      emptyMessage = 'لا يوجد أي سلع مقطوعة حالياً.';
      summaryTitle = 'مجموع قطع السلع المقطوعة';
    } else if (filter === 'books') {
      headerTitle = '<b>لائحة خصاص الكتب</b>\n───────────────';
      emptyMessage = 'لا يوجد أي خصاص في الكتب حالياً.';
    } else if (filter === 'supplies') {
      headerTitle = '<b>لائحة خصاص الأدوات</b>\n───────────────';
      emptyMessage = 'لا يوجد أي خصاص في الأدوات حالياً.';
    }

    if (sortedList.length === 0) {
      const emptyText = `${headerTitle}\n\n${emptyMessage}`;
      await sendTelegramMessage(
        emptyText,
        withBottomKeyboard ? PERSISTENT_KEYBOARD : SHORTAGE_INLINE_BUTTONS,
        chatId
      );
      return;
    }

    const itemBlocks = sortedList.map((item, idx) => {
      return `${idx + 1}- ${escapeHtml(item.name)} :\n${item.quantity}\n----------------------------------`;
    });

    const summaryLines = [
      '',
      '───────────────',
      `${summaryTitle}: <b>${totalSum}</b>`,
      `عدد الأصناف: <b>${sortedList.length}</b>`,
    ];

    // Chunk messages cleanly across separate messages if approaching Telegram's limits
    const chunks: string[] = [];
    let currentChunk = `${headerTitle}\n\n`;

    for (const block of itemBlocks) {
      if (currentChunk.length + block.length + 1 > 3500) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += `${block}\n`;
    }

    const summaryText = summaryLines.join('\n');
    if (currentChunk.length + summaryText.length + 1 > 3500) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      chunks.push(summaryText.trim());
    } else {
      currentChunk += summaryText;
      chunks.push(currentChunk.trim());
    }

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const markup = isLast
        ? (withBottomKeyboard ? PERSISTENT_KEYBOARD : SHORTAGE_INLINE_BUTTONS)
        : undefined;
      await sendTelegramMessage(chunks[i], markup, chatId);
    }
  } catch (err: any) {
    console.error('[TELEGRAM_WEBHOOK_PROCESSING_ERROR]:', err);
    const errMsg = err?.message || String(err);
    await sendTelegramMessage(
      `⚠️ تعذر جلب قائمة الخصاص:\n<code>${escapeHtml(errMsg)}</code>`,
      withBottomKeyboard ? PERSISTENT_KEYBOARD : undefined,
      chatId
    );
  }
}

export async function POST(req: Request) {
  // Read payload defensively
  let body: any;
  try {
    body = await req.json();
  } catch (parseErr) {
    console.error('[TELEGRAM_WEBHOOK] JSON Parse Error:', parseErr);
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 200 });
  }

  try {
    // 1. Detect and handle callback_query from inline buttons
    if (body?.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackQueryId = callbackQuery.id;
      const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id || '6812050393';
      const callbackData = callbackQuery.data;

      // IMMEDIATELY fire answerCallbackQuery to Telegram (without awaiting long calculations first) so the UI unfreezes immediately:
      if (callbackQueryId && TELEGRAM_BOT_TOKEN) {
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackQueryId }),
        }).catch((err) => console.error('[TELEGRAM_WEBHOOK] answerCallbackQuery failed:', err));
      }

      // ROUTE DISPATCH WITH TRY-CATCH
      try {
        if (
          callbackData === 'shortages_regular' ||
          callbackData === 'view_shortages' ||
          callbackData === 'shortage_all'
        ) {
          await handleShortageQuery(chatId, 'regular', false);
        } else if (callbackData === 'shortages_out_of_stock') {
          await handleShortageQuery(chatId, 'out_of_stock', false);
        } else if (callbackData === 'shortage_books') {
          await handleShortageQuery(chatId, 'books', false);
        } else if (callbackData === 'shortage_supplies') {
          await handleShortageQuery(chatId, 'supplies', false);
        }
      } catch (err: any) {
        console.error('[TELEGRAM_WEBHOOK_PROCESSING_ERROR]:', err);
        const errMsg = err?.message || String(err);
        await sendTelegramMessage(
          `⚠️ تعذر جلب قائمة الخصاص:\n<code>${escapeHtml(errMsg)}</code>`,
          undefined,
          chatId
        );
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 2. Detect and handle standard text messages
    if (body?.message) {
      const message = body.message;
      const text = (message.text || '').trim();
      const chatId = message.chat?.id || '6812050393';

      try {
        if (text === '📦 قائمة الخصاصات العادية' || text === '📦 كل الخصاص') {
          await handleShortageQuery(chatId, 'regular', true);
        } else if (text === '🚫 السلع المقطوعة') {
          await handleShortageQuery(chatId, 'out_of_stock', true);
        } else if (text === '📚 كتب فقط') {
          await handleShortageQuery(chatId, 'books', true);
        } else if (text === '✏️ أدوات فقط') {
          await handleShortageQuery(chatId, 'supplies', true);
        } else {
          const welcomeText =
            'مرحباً بك في نظام المكتبة العصرية 📚. اختر من القائمة أسفله لعرض الخصاص الحالي:';
          await sendTelegramMessage(welcomeText, PERSISTENT_KEYBOARD, chatId);
        }
      } catch (err: any) {
        console.error('[TELEGRAM_WEBHOOK_PROCESSING_ERROR]:', err);
        const errMsg = err?.message || String(err);
        await sendTelegramMessage(
          `⚠️ تعذر جلب قائمة الخصاص:\n<code>${escapeHtml(errMsg)}</code>`,
          undefined,
          chatId
        );
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[TELEGRAM_WEBHOOK_UNEXPECTED_EXCEPTION]:', error);
    // Always return status 200 with { ok: true } to Telegram to prevent retry loops
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
