import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import {
  sendTelegramMessage,
  answerCallbackQuery,
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

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const targetChatId = '6812050393';

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
    error: 'Invalid type. Use ?type=regular or ?type=out_of_stock',
  });
}

const RUPTURE_METADATA_PREFIX = '__METADATA_EN_RUPTURE__::';

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
  } catch (err) {
    console.error('Error fetching shortage items:', err);
    await sendTelegramMessage(
      '⚠️ حدث خطأ أثناء جلب قائمة الخصاص. يرجى المحاولة مرة أخرى.',
      withBottomKeyboard ? PERSISTENT_KEYBOARD : undefined,
      chatId
    );
  }
}

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // 1. Handle incoming text messages
    if (update.message) {
      const message = update.message;
      const text = (message.text || '').trim();
      const chatId = message.chat.id;

      try {
        if (text === '📦 قائمة الخصاصات العادية' || text === '📦 كل الخصاص') {
          await handleShortageQuery(chatId, 'regular', true);
          return NextResponse.json({ ok: true });
        }

        if (text === '🚫 السلع المقطوعة') {
          await handleShortageQuery(chatId, 'out_of_stock', true);
          return NextResponse.json({ ok: true });
        }

        if (text === '📚 كتب فقط') {
          await handleShortageQuery(chatId, 'books', true);
          return NextResponse.json({ ok: true });
        }

        if (text === '✏️ أدوات فقط') {
          await handleShortageQuery(chatId, 'supplies', true);
          return NextResponse.json({ ok: true });
        }

        // Initial greeting on /start, /help, or any standard message
        const welcomeText =
          'مرحباً بك في نظام المكتبة العصرية 📚. اختر من القائمة أسفله لعرض الخصاص الحالي:';
        await sendTelegramMessage(welcomeText, PERSISTENT_KEYBOARD, chatId);
      } catch (msgError) {
        console.error('Error handling Telegram message:', msgError);
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Handle callback queries from inline buttons
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const data = callbackQuery.data;
      const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id;

      // 1. Immediately call Telegram's answerCallbackQuery API as the very first operation
      if (callbackQuery.id) {
        await answerCallbackQuery(callbackQuery.id);
      }

      // 2. Wrap shortage calculation and message dispatch inside a try...catch block
      try {
        if (data === 'shortages_regular' || data === 'view_shortages' || data === 'shortage_all') {
          await handleShortageQuery(chatId, 'regular', false);
        } else if (data === 'shortages_out_of_stock') {
          await handleShortageQuery(chatId, 'out_of_stock', false);
        } else if (data === 'shortage_books') {
          await handleShortageQuery(chatId, 'books', false);
        } else if (data === 'shortage_supplies') {
          await handleShortageQuery(chatId, 'supplies', false);
        }
      } catch (dispatchError) {
        console.error('Error during Telegram shortage calculation and dispatch:', dispatchError);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook handler exception:', error);
    // Always return status 200 with { ok: true } to Telegram to prevent retry loops
    return NextResponse.json({ ok: true });
  }
}
