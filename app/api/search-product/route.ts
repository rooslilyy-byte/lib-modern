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

    // Map database results to a clean client response format
    const results = (items || []).map((item: any) => {
      const demand = item.demand;
      const client = demand?.client;
      return {
        id: item.id,
        productName: item.product_name,
        quantity: item.quantity,
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
