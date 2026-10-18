import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import {
  sendTelegramMessage,
  escapeHtml,
  sortArabicFirst,
  SHORTAGE_INLINE_BUTTONS,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    // Strictly DD/MM/YYYY (e.g. 16/10/2026)
    const day = String(now.getUTCDate()).padStart(2, '0');
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const year = now.getUTCFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // 1. Calculate today's registered demands count
    const startOfToday = new Date(Date.UTC(year, Number(month) - 1, Number(day), 0, 0, 0, 0));
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let demandsCount = 0;
    try {
      const { count, error } = await supabaseAdmin
        .from('demands')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfToday.toISOString());

      if (!error && typeof count === 'number') {
        demandsCount = count;
      }
    } catch (e) {
      console.warn('Error fetching demands table count:', e);
    }

    // Fallback if 0 (e.g. midnight rollover or demand_items check)
    if (demandsCount === 0) {
      try {
        const { count: past24hCount } = await supabaseAdmin
          .from('demands')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', twentyFourHoursAgo.toISOString());

        if (past24hCount && past24hCount > 0) {
          demandsCount = past24hCount;
        }
      } catch (e) {
        // Ignore fallback error
      }
    }

    if (demandsCount === 0) {
      try {
        const { data: recentItems } = await supabaseAdmin
          .from('demand_items')
          .select('demand_id, created_at')
          .gte('created_at', startOfToday.toISOString());

        if (recentItems && recentItems.length > 0) {
          const uniqueDemands = new Set(recentItems.map((i) => i.demand_id).filter(Boolean));
          if (uniqueDemands.size > 0) {
            demandsCount = uniqueDemands.size;
          }
        }
      } catch (e) {
        // Ignore fallback error
      }
    }

    // 2. Fetch all pending shortages from Supabase
    const { data: rawDemandItems, error: itemsError } = await supabaseAdmin
      .from('demand_items')
      .select(`
        id,
        product_name,
        quantity,
        fulfilled_quantity,
        is_in_stock,
        is_delivered,
        status
      `);

    if (itemsError) {
      console.error('Error fetching demand items for daily report:', itemsError);
    }

    const aggregated = new Map<string, { name: string; quantity: number }>();

    for (const it of rawDemandItems || []) {
      if (!it) continue;
      const rawName = (it.product_name || '').trim();
      if (!rawName) continue;

      // Pending shortage: marked as 'خصاص معلق' OR (!is_in_stock AND !is_delivered)
      const isShortage =
        it.status === 'خصاص معلق' ||
        (!it.is_in_stock && !it.is_delivered && it.status !== 'ready');

      if (!isShortage) continue;

      const totalQty = Number(it.quantity) || 0;
      const fulfilled = Number(it.fulfilled_quantity) || 0;
      const stillNeeded = Math.max(0, totalQty - fulfilled);
      if (stillNeeded <= 0) continue;

      const key = rawName.toLowerCase();
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity += stillNeeded;
      } else {
        aggregated.set(key, { name: rawName, quantity: stillNeeded });
      }
    }

    const sortedList = sortArabicFirst(Array.from(aggregated.values()));
    const totalShortageQty = sortedList.reduce((acc, curr) => acc + curr.quantity, 0);

    // 3. Construct Telegram message chunks completely without slicing or cut-offs
    const headerBlock = [
      `<b>تقرير نهاية اليوم [${formattedDate}]</b>`,
      '───────────────',
      `الطلبات المسجلة: ${demandsCount}`,
      `مجموع قطع الخصاص: ${totalShortageQty}`,
      '',
      '<b>لائحة الخصاص المطلوبة:</b>',
    ].join('\n');

    const chunks: string[] = [];
    let currentChunk = headerBlock;

    if (sortedList.length === 0) {
      currentChunk += '\nلا يوجد أي خصاص حالياً.';
      chunks.push(currentChunk.trim());
    } else {
      currentChunk += '\n';
      for (let i = 0; i < sortedList.length; i++) {
        const item = sortedList[i];
        const block = `${i + 1}- ${escapeHtml(item.name)} :\n${item.quantity}\n----------------------------------\n`;
        // Split cleanly into separate messages if approaching Telegram's 4096 character limit
        if (currentChunk.length + block.length > 3500) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        currentChunk += block;
      }
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
    }

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      await sendTelegramMessage(chunks[i], isLast ? SHORTAGE_INLINE_BUTTONS : undefined);
    }

    return NextResponse.json({
      ok: true,
      formattedDate,
      demandsCount,
      totalShortageQty,
      shortagesCount: sortedList.length,
    });
  } catch (error: any) {
    console.error('Error generating midnight daily report:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
