import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    if (!q.trim()) {
      return NextResponse.json({ success: true, results: [] });
    }

    // Query demand_items matching the search term `q` using supabaseAdmin
    const { data: items, error } = await supabaseAdmin
      .from('demand_items')
      .select(`
        id,
        product_name,
        quantity,
        is_in_stock,
        is_delivered,
        demand:client_demands!inner (
          id,
          status,
          client:clients!inner (
            id,
            name,
            phone
          )
        )
      `)
      .ilike('product_name', `%${q.trim()}%`);

    if (error) {
      console.error('Database query error during product search:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Fetch progressive fulfillment metadata
    let progressiveMap: Record<string, number> = {};
    try {
      const { data: pbData } = await supabaseAdmin
        .from('purchase_batches')
        .select('batch_name')
        .like('batch_name', '__METADATA_PROGRESSIVE_FULFILLMENT__::%')
        .limit(1);

      if (pbData && pbData.length > 0) {
        const rawJson = pbData[0].batch_name.slice('__METADATA_PROGRESSIVE_FULFILLMENT__::'.length);
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          progressiveMap = parsed;
        }
      }
    } catch {}

    // Map database results to a clean client response format
    const results = (items || []).map((item: any) => {
      const demand = item.demand;
      const client = demand?.client;
      const totalQty = Number(item.quantity) || 0;
      const fulfilledQty = item.fulfilled_quantity !== undefined && item.fulfilled_quantity !== null
        ? Number(item.fulfilled_quantity)
        : (progressiveMap[item.id] !== undefined ? Number(progressiveMap[item.id]) : (item.is_in_stock ? totalQty : 0));

      return {
        id: item.id,
        productName: item.product_name,
        quantity: totalQty,
        fulfilledQuantity: fulfilledQty,
        isInStock: item.is_in_stock,
        isDelivered: item.is_delivered,
        demandId: demand?.id || '',
        clientName: client?.name || '',
        clientPhone: client?.phone || '',
      };
    });

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Error in search product route:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Server error occurred during search' },
      { status: 500 }
    );
  }
}
