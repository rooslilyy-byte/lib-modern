import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import type { ClientDemand, MasterProduct, PurchaseBatch } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_BATCH_NAME =
  '\u062f\u0641\u0639\u0629 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0645\u062f\u0631\u0633\u064a \u0627\u0644\u0631\u0626\u064a\u0633\u064a';
const DEFAULT_PRODUCT_CATEGORY = '\u0643\u062a\u0627\u0628 \u0645\u062f\u0631\u0633\u064a';

type DatabaseRow = Record<string, any>;

function unwrap<T>(
  result: { data: T; error: { message: string; details?: string; hint?: string } | null },
  operation: string,
): T {
  if (result.error) {
    const details = [result.error.message, result.error.details, result.error.hint]
      .filter(Boolean)
      .join(' ');
    throw new Error(`${operation}: ${details}`);
  }

  return result.data;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeProductName(value: string): string {
  return value.trim().toLowerCase();
}

async function getActiveBatch(): Promise<PurchaseBatch> {
  const batches = unwrap(
    await supabaseAdmin
      .from('purchase_batches')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1),
    'Loading active purchase batch',
  ) as PurchaseBatch[];

  if (batches.length > 0) {
    return batches[0];
  }

  return unwrap(
    await supabaseAdmin
      .from('purchase_batches')
      .insert({ batch_name: DEFAULT_BATCH_NAME, is_archived: false })
      .select()
      .single(),
    'Creating default purchase batch',
  ) as PurchaseBatch;
}

async function getMasterProductByName(name: string): Promise<MasterProduct | null> {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  const { data, error } = await supabaseAdmin
    .from('master_products')
    .select('*')
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Error fetching master product by name:', error);
    return null;
  }
  return data;
}

async function ensureMasterProducts(names: string[], category = DEFAULT_PRODUCT_CATEGORY): Promise<void> {
  const uniqueNames = Array.from(
    new Set(names.map((n) => (n || '').trim()).filter(Boolean))
  );
  if (uniqueNames.length === 0) return;

  const rows = uniqueNames.map((name) => ({
    name,
    category,
  }));

  unwrap(
    await supabaseAdmin
      .from('master_products')
      .upsert(rows, { onConflict: 'name' }),
    'Upserting master products',
  );
}

async function ensureMasterProduct(name: string, category = DEFAULT_PRODUCT_CATEGORY): Promise<MasterProduct | null> {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  return unwrap(
    await supabaseAdmin
      .from('master_products')
      .upsert({ name: trimmed, category }, { onConflict: 'name' })
      .select()
      .maybeSingle(),
    'Upserting master product',
  ) as MasterProduct | null;
}

async function updateMasterProductStock(productName: string, delta: number): Promise<void> {
  const trimmed = (productName || '').trim();
  if (!trimmed) return;

  const product = await getMasterProductByName(trimmed);
  if (!product) {
    return;
  }

  const availableStock = Math.max(0, Number(product.available_stock) || 0);
  unwrap(
    await supabaseAdmin
      .from('master_products')
      .update({ available_stock: Math.max(0, availableStock + delta) })
      .eq('id', product.id),
    'Updating master product stock',
  );
}

const RUPTURE_METADATA_PREFIX = '__METADATA_EN_RUPTURE__::';

async function getRuptureProductsFromDb(): Promise<{ id?: string; products: Set<string> }> {
  try {
    const { data } = await supabaseAdmin
      .from('purchase_batches')
      .select('id, batch_name')
      .like('batch_name', `${RUPTURE_METADATA_PREFIX}%`)
      .limit(1);

    if (data && data.length > 0) {
      const rawJson = data[0].batch_name.slice(RUPTURE_METADATA_PREFIX.length);
      try {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          return { id: data[0].id, products: new Set(parsed.map((p) => normalizeProductName(String(p)))) };
        }
      } catch (e) {
        console.warn('Error parsing rupture metadata json:', e);
      }
      return { id: data[0].id, products: new Set() };
    }
  } catch (err) {
    console.warn('Error fetching rupture metadata row:', err);
  }
  return { products: new Set() };
}

async function saveRuptureProductsToDb(products: Set<string>, existingId?: string): Promise<void> {
  const serialized = `${RUPTURE_METADATA_PREFIX}${JSON.stringify(Array.from(products))}`;
  try {
    if (existingId) {
      await supabaseAdmin
        .from('purchase_batches')
        .update({ batch_name: serialized, is_archived: true })
        .eq('id', existingId);
    } else {
      const current = await getRuptureProductsFromDb();
      if (current.id) {
        await supabaseAdmin
          .from('purchase_batches')
          .update({ batch_name: serialized, is_archived: true })
          .eq('id', current.id);
      } else {
        await supabaseAdmin
          .from('purchase_batches')
          .insert({ batch_name: serialized, is_archived: true });
      }
    }
  } catch (err) {
    console.error('Error saving rupture products metadata:', err);
  }
}

const PROGRESSIVE_METADATA_PREFIX = '__METADATA_PROGRESSIVE_FULFILLMENT__::';

async function getProgressiveFulfillmentFromDb(): Promise<{ id?: string; map: Record<string, number> }> {
  try {
    const { data } = await supabaseAdmin
      .from('purchase_batches')
      .select('id, batch_name')
      .like('batch_name', `${PROGRESSIVE_METADATA_PREFIX}%`)
      .limit(1);

    if (data && data.length > 0) {
      const rawJson = data[0].batch_name.slice(PROGRESSIVE_METADATA_PREFIX.length);
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { id: data[0].id, map: parsed };
        }
      } catch (e) {
        console.warn('Error parsing progressive metadata json:', e);
      }
      return { id: data[0].id, map: {} };
    }
  } catch (err) {
    console.warn('Error fetching progressive metadata row:', err);
  }
  return { map: {} };
}

async function saveProgressiveFulfillmentToDb(map: Record<string, number>, existingId?: string): Promise<void> {
  const serialized = `${PROGRESSIVE_METADATA_PREFIX}${JSON.stringify(map)}`;
  try {
    if (existingId) {
      await supabaseAdmin
        .from('purchase_batches')
        .update({ batch_name: serialized, is_archived: true })
        .eq('id', existingId);
    } else {
      const current = await getProgressiveFulfillmentFromDb();
      if (current.id) {
        await supabaseAdmin
          .from('purchase_batches')
          .update({ batch_name: serialized, is_archived: true })
          .eq('id', current.id);
      } else {
        await supabaseAdmin
          .from('purchase_batches')
          .insert({ batch_name: serialized, is_archived: true });
      }
    }
  } catch (err) {
    console.error('Error saving progressive metadata:', err);
  }
}

const AVANCE_METADATA_PREFIX = '__METADATA_AVANCE_PAYMENTS__::';

async function getAvancePaymentsFromDb(): Promise<{ id?: string; map: Record<string, { avance: number; total: number }> }> {
  try {
    const { data } = await supabaseAdmin
      .from('purchase_batches')
      .select('id, batch_name')
      .like('batch_name', `${AVANCE_METADATA_PREFIX}%`)
      .limit(1);

    if (data && data.length > 0) {
      const rawJson = data[0].batch_name.slice(AVANCE_METADATA_PREFIX.length);
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { id: data[0].id, map: parsed };
        }
      } catch (e) {
        console.warn('Error parsing avance metadata json:', e);
      }
      return { id: data[0].id, map: {} };
    }
  } catch (err) {
    console.warn('Error fetching avance metadata row:', err);
  }
  return { map: {} };
}

async function saveAvancePaymentsToDb(map: Record<string, { avance: number; total: number }>, existingId?: string): Promise<void> {
  const serialized = `${AVANCE_METADATA_PREFIX}${JSON.stringify(map)}`;
  try {
    if (existingId) {
      await supabaseAdmin
        .from('purchase_batches')
        .update({ batch_name: serialized, is_archived: true })
        .eq('id', existingId);
    } else {
      const current = await getAvancePaymentsFromDb();
      if (current.id) {
        await supabaseAdmin
          .from('purchase_batches')
          .update({ batch_name: serialized, is_archived: true })
          .eq('id', current.id);
      } else {
        await supabaseAdmin
          .from('purchase_batches')
          .insert({ batch_name: serialized, is_archived: true });
      }
    }
  } catch (err) {
    console.error('Error saving avance payments metadata:', err);
  }
}

async function getDemandsForBatch(batchId: string): Promise<ClientDemand[]> {
  const { products: ruptureProducts } = await getRuptureProductsFromDb();
  const { map: progressiveMap } = await getProgressiveFulfillmentFromDb();
  const { map: avanceMap } = await getAvancePaymentsFromDb();

  const rows = unwrap(
    await supabaseAdmin
      .from('client_demands')
      .select(`
        id,
        client_id,
        batch_id,
        status,
        created_at,
        client:clients!inner (
          id,
          name,
          phone,
          created_at
        ),
        items:demand_items (*)
      `)
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false }),
    'Loading client demands',
  ) as DatabaseRow[];

  const demands: ClientDemand[] = [];

  for (const row of rows) {
    const relatedClient = Array.isArray(row.client) ? row.client[0] : row.client;
    if (!relatedClient) {
      continue;
    }

    const items = [...((row.items || []) as DatabaseRow[])]
      .sort((a, b) => {
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      })
      .map((it) => {
        const isEnRupture =
          it.status === 'en_rupture' ||
          ruptureProducts.has(normalizeProductName(it.product_name || ''));

        const totalQty = Number(it.quantity) || 0;
        const fulfilledQty = it.fulfilled_quantity !== undefined && it.fulfilled_quantity !== null
          ? Number(it.fulfilled_quantity)
          : (progressiveMap[it.id] !== undefined ? Number(progressiveMap[it.id]) : (it.is_in_stock ? totalQty : 0));

        return {
          ...it,
          fulfilled_quantity: fulfilledQty,
          status: isEnRupture ? ('en_rupture' as const) : ('pending' as const),
        };
      }) as ClientDemand['items'];

    const storedAvance = row.avance_amount !== undefined && row.avance_amount !== null
      ? Number(row.avance_amount)
      : (avanceMap[row.id]?.avance !== undefined ? Number(avanceMap[row.id].avance) : 0);

    const storedTotal = row.total_amount !== undefined && row.total_amount !== null
      ? Number(row.total_amount)
      : (avanceMap[row.id]?.total !== undefined ? Number(avanceMap[row.id].total) : 0);

    demands.push({
      id: row.id,
      client_id: row.client_id,
      batch_id: row.batch_id,
      status: row.status,
      avance_amount: storedAvance,
      total_amount: storedTotal,
      created_at: row.created_at,
      client: {
        id: relatedClient.id,
        name: relatedClient.name,
        phone: relatedClient.phone,
        created_at: relatedClient.created_at,
      },
      items,
    });
  }

  return demands;
}

export async function GET() {
  try {
    const activeBatch = await getActiveBatch();

    const masterProducts = unwrap(
      await supabaseAdmin
        .from('master_products')
        .select('*')
        .order('name', { ascending: true }),
      'Loading master products',
    ) as MasterProduct[];

    const demands = await getDemandsForBatch(activeBatch.id);

    const response = NextResponse.json({
      success: true,
      activeBatch,
      masterProducts,
      demands,
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Error fetching database store data:', error);
    return NextResponse.json(
      { success: false, message: errorMessage(error) || 'Failed to fetch database data' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create_demand') {
      const { clientName, clientPhone, items, avance_amount, total_amount } = body;
      const cleanPhone = (clientPhone || '').trim();
      const cleanName = (clientName || '').trim();
      const activeBatch = await getActiveBatch();
      const numAvance = avance_amount !== undefined && avance_amount !== null && avance_amount !== '' ? Number(avance_amount) : 0;
      const numTotal = total_amount !== undefined && total_amount !== null && total_amount !== '' ? Number(total_amount) : 0;

      // 1. Create client
      const client = unwrap(
        await supabaseAdmin
          .from('clients')
          .insert({ name: cleanName, phone: cleanPhone })
          .select()
          .single(),
        'Creating client',
      ) as DatabaseRow;

      // 2. Create client demand
      let demand: DatabaseRow;
      try {
        demand = unwrap(
          await supabaseAdmin
            .from('client_demands')
            .insert({ 
              client_id: client.id, 
              batch_id: activeBatch.id, 
              status: 'pending',
              avance_amount: numAvance,
              total_amount: numTotal
            })
            .select()
            .single(),
          'Creating client demand',
        ) as DatabaseRow;
      } catch {
        demand = unwrap(
          await supabaseAdmin
            .from('client_demands')
            .insert({ client_id: client.id, batch_id: activeBatch.id, status: 'pending' })
            .select()
            .single(),
          'Creating client demand fallback',
        ) as DatabaseRow;

        if (numAvance > 0 || numTotal > 0) {
          const { id: avId, map: avMap } = await getAvancePaymentsFromDb();
          avMap[demand.id] = { avance: numAvance, total: numTotal };
          await saveAvancePaymentsToDb(avMap, avId);
        }
      }

      // 3. Bulk Safe Upsert Master Products (onConflict: 'name')
      const validItems = (Array.isArray(items) ? items : []).filter(
        (it: any) => it && it.product_name && it.product_name.trim()
      );
      const productNames = validItems.map((it: any) => it.product_name.trim());
      await ensureMasterProducts(productNames);

      // 4. Bulk Insert Demand Items in a single network request
      if (validItems.length > 0) {
        const demandItemsToInsert = validItems.map((item: any) => ({
          demand_id: demand.id,
          product_name: item.product_name.trim(),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          fulfilled_quantity: 0,
          is_in_stock: false,
          is_delivered: false,
          status: 'pending',
        }));

        try {
          unwrap(
            await supabaseAdmin
              .from('demand_items')
              .insert(demandItemsToInsert),
            'Bulk creating demand items',
          );
        } catch {
          const fallbackItems = demandItemsToInsert.map(
            ({ fulfilled_quantity, status, ...rest }) => rest
          );
          unwrap(
            await supabaseAdmin
              .from('demand_items')
              .insert(fallbackItems),
            'Bulk creating demand items fallback',
          );
        }
      }

      return NextResponse.json({ success: true, demandId: demand.id });
    }

    if (action === 'update_demand') {
      const { demandId, clientName, clientPhone, items, avance_amount, total_amount } = body;
      const cleanPhone = (clientPhone || '').trim();
      const cleanName = (clientName || '').trim();
      const numAvance = avance_amount !== undefined && avance_amount !== null && avance_amount !== '' ? Number(avance_amount) : 0;
      const numTotal = total_amount !== undefined && total_amount !== null && total_amount !== '' ? Number(total_amount) : 0;

      const demand = unwrap(
        await supabaseAdmin
          .from('client_demands')
          .select('*')
          .eq('id', demandId)
          .maybeSingle(),
        'Loading demand to update',
      ) as DatabaseRow | null;

      if (!demand) {
        return NextResponse.json({ success: false, message: 'Demand not found' }, { status: 404 });
      }

      // 1. Update client details
      unwrap(
        await supabaseAdmin
          .from('clients')
          .update({ name: cleanName, phone: cleanPhone })
          .eq('id', demand.client_id),
        'Updating client',
      );

      // 2. Update demand amounts
      try {
        await supabaseAdmin
          .from('client_demands')
          .update({ avance_amount: numAvance, total_amount: numTotal })
          .eq('id', demandId);
      } catch {
        const { id: avId, map: avMap } = await getAvancePaymentsFromDb();
        avMap[demandId] = { avance: numAvance, total: numTotal };
        await saveAvancePaymentsToDb(avMap, avId);
      }

      // 3. Bulk Safe Upsert Master Products (onConflict: 'name')
      const validItems = (Array.isArray(items) ? items : []).filter(
        (it: any) => it && it.product_name && it.product_name.trim()
      );
      const productNames = validItems.map((it: any) => it.product_name.trim());
      await ensureMasterProducts(productNames);

      // 4. Clean update: Delete all existing demand items for this demand/client
      unwrap(
        await supabaseAdmin
          .from('demand_items')
          .delete()
          .eq('demand_id', demandId),
        'Deleting existing demand items',
      );

      // 5. Bulk Insert newly submitted array of products into demand_items table
      if (validItems.length > 0) {
        const demandItemsToInsert = validItems.map((item: any) => ({
          demand_id: demandId,
          product_name: item.product_name.trim(),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          fulfilled_quantity: Number(item.fulfilled_quantity) || 0,
          is_in_stock: Boolean(item.is_in_stock),
          is_delivered: Boolean(item.is_delivered),
          status: item.status || (item.is_in_stock ? 'ready' : 'pending'),
        }));

        try {
          unwrap(
            await supabaseAdmin
              .from('demand_items')
              .insert(demandItemsToInsert),
            'Bulk inserting updated demand items',
          );
        } catch {
          const fallbackItems = demandItemsToInsert.map(
            ({ fulfilled_quantity, status, ...rest }) => rest
          );
          unwrap(
            await supabaseAdmin
              .from('demand_items')
              .insert(fallbackItems),
            'Bulk inserting updated demand items fallback',
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'update_item_state') {
      const { itemId, updates } = body;
      const update: DatabaseRow = {};

      if (updates.is_in_stock !== undefined) {
        update.is_in_stock = Boolean(updates.is_in_stock);
        try {
          const { id: progId, map: progMap } = await getProgressiveFulfillmentFromDb();
          const { data: itData } = await supabaseAdmin
            .from('demand_items')
            .select('quantity')
            .eq('id', itemId)
            .single();
          const totalQty = itData ? Number(itData.quantity) : 0;
          if (update.is_in_stock) {
            progMap[itemId] = totalQty;
            update.fulfilled_quantity = totalQty;
          } else {
            delete progMap[itemId];
            update.fulfilled_quantity = 0;
          }
          await saveProgressiveFulfillmentToDb(progMap, progId);
        } catch {
          // Handled gracefully
        }
      }
      if (updates.is_delivered !== undefined) {
        update.is_delivered = Boolean(updates.is_delivered);
        if (updates.is_delivered) {
          update.is_in_stock = true;
        }
      }

      if (Object.keys(update).length > 0) {
        try {
          await supabaseAdmin.from('demand_items').update(update).eq('id', itemId);
        } catch {
          // Column fulfilled_quantity might not exist yet; remove it and retry
          const safeUpdate = { ...update };
          delete safeUpdate.fulfilled_quantity;
          if (Object.keys(safeUpdate).length > 0) {
            unwrap(
              await supabaseAdmin.from('demand_items').update(safeUpdate).eq('id', itemId),
              'Updating demand item state fallback',
            );
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'auto_allocate_stock') {
      const { productName, receivedQty } = body;
      const cleanName = productName.trim();
      let remainingStock = parseInt(receivedQty, 10);
      if (isNaN(remainingStock) || remainingStock < 0) {
        remainingStock = 0;
      }

      const activeBatches = unwrap(
        await supabaseAdmin
          .from('purchase_batches')
          .select('id')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(1),
        'Loading active batch for stock allocation',
      ) as Array<{ id: string }>;
      const activeBatchId = activeBatches[0]?.id;

      // 1. Fetch all pending/unfulfilled items matching the received product name, ORDERED BY creation date ASC (oldest first)
      let itemsQuery = supabaseAdmin
        .from('demand_items')
        .select(`
          id,
          demand_id,
          product_name,
          quantity,
          is_in_stock,
          is_delivered,
          created_at,
          demand:client_demands!inner (
            id,
            batch_id,
            created_at,
            client:clients!inner (
              id,
              name,
              phone
            )
          )
        `)
        .eq('is_in_stock', false)
        .eq('is_delivered', false)
        .ilike('product_name', cleanName)
        .order('created_at', { ascending: true });

      if (activeBatchId) {
        itemsQuery = itemsQuery.eq('demand.batch_id', activeBatchId);
      }

      let pendingItems = unwrap(
        await itemsQuery,
        'Loading pending items for stock allocation',
      ) as DatabaseRow[];

      // Fallback matching using normalizeProductName if direct ilike yielded no items
      if (pendingItems.length === 0) {
        let fallbackQuery = supabaseAdmin
          .from('demand_items')
          .select(`
            id,
            demand_id,
            product_name,
            quantity,
            is_in_stock,
            is_delivered,
            created_at,
            demand:client_demands!inner (
              id,
              batch_id,
              created_at,
              client:clients!inner (
                id,
                name,
                phone
              )
            )
          `)
          .eq('is_in_stock', false)
          .eq('is_delivered', false)
          .order('created_at', { ascending: true });

        if (activeBatchId) {
          fallbackQuery = fallbackQuery.eq('demand.batch_id', activeBatchId);
        }

        const allItems = unwrap(
          await fallbackQuery,
          'Loading all pending items fallback for stock allocation',
        ) as DatabaseRow[];

        pendingItems = allItems.filter(
          (item) => normalizeProductName(item.product_name) === normalizeProductName(cleanName),
        );
      }

      // Ensure strict FIFO ordering by creation date ASC (oldest first)
      pendingItems.sort((a, b) => {
        const timeA = new Date(a.created_at || a.demand?.created_at || 0).getTime();
        const timeB = new Date(b.created_at || b.demand?.created_at || 0).getTime();
        return timeA - timeB;
      });

      const allocatedClientsMap: Record<
        string,
        { clientName: string; phone: string; totalFulfilled: number }
      > = {};

      // 2. Load progressive fulfillment map
      const { id: progId, map: progMap } = await getProgressiveFulfillmentFromDb();
      let hasProgChanges = false;

      // 3. Iterate over the fetched pending items with Progressive Fulfillment math on SINGLE row
      for (const item of pendingItems) {
        if (remainingStock <= 0) {
          break;
        }

        const totalQty = Number(item.quantity) || 0;
        if (totalQty <= 0) {
          continue;
        }

        const currentFulfilled = item.fulfilled_quantity !== undefined && item.fulfilled_quantity !== null
          ? Number(item.fulfilled_quantity)
          : (progMap[item.id] !== undefined ? Number(progMap[item.id]) : 0);

        const stillNeeded = Math.max(0, totalQty - currentFulfilled);
        if (stillNeeded <= 0) {
          continue; // Already fulfilled row, skip
        }

        const clientRaw = item.demand?.client;
        const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
        const clientKey = client && client.phone ? client.phone : item.id;

        const recordAllocation = (allocatedQty: number) => {
          if (client && client.phone && allocatedQty > 0) {
            if (!allocatedClientsMap[clientKey]) {
              allocatedClientsMap[clientKey] = {
                clientName: client.name || '',
                phone: client.phone,
                totalFulfilled: 0,
              };
            }
            allocatedClientsMap[clientKey].totalFulfilled += allocatedQty;
          }
        };

        if (remainingStock < stillNeeded && remainingStock > 0) {
          // PARTIAL FULFILLMENT: Add incomingStock to fulfilled_quantity.
          // The row status MUST REMAIN 'pending' (is_in_stock: false).
          const newFulfilled = currentFulfilled + remainingStock;
          progMap[item.id] = newFulfilled;
          hasProgChanges = true;

          try {
            await supabaseAdmin
              .from('demand_items')
              .update({ fulfilled_quantity: newFulfilled })
              .eq('id', item.id);
          } catch {
            // Handled via metadata
          }

          recordAllocation(remainingStock);
          remainingStock = 0;
          break;
        } else if (remainingStock >= stillNeeded) {
          // FULL FULFILLMENT: Set fulfilled_quantity = totalQty, status = 'ready' (is_in_stock: true)
          progMap[item.id] = totalQty;
          hasProgChanges = true;

          try {
            unwrap(
              await supabaseAdmin
                .from('demand_items')
                .update({ is_in_stock: true, fulfilled_quantity: totalQty })
                .eq('id', item.id),
              'Allocating received stock to demand item',
            );
          } catch {
            // If fulfilled_quantity column does not exist yet
            unwrap(
              await supabaseAdmin
                .from('demand_items')
                .update({ is_in_stock: true })
                .eq('id', item.id),
              'Allocating received stock to demand item fallback',
            );
          }

          remainingStock -= stillNeeded;
          recordAllocation(stillNeeded);
        }
      }

      if (hasProgChanges) {
        await saveProgressiveFulfillmentToDb(progMap, progId);
      }

      // Surplus stock is strictly discarded (zero global inventory tracking)

      const allocatedClients = Object.values(allocatedClientsMap).map((client) => {
        let rawPhone = client.phone.replace(/\D/g, '');
        if (rawPhone.startsWith('0')) rawPhone = `212${rawPhone.slice(1)}`;
        const message = `\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064a\u0643\u0645 \u0648\u0631\u062d\u0645\u0629 \u0627\u0644\u0644\u0647 \u0648\u0628\u0631\u0643\u0627\u062a\u0647 \u0627\u0644\u0633\u064a\u062f(\u0629) ${client.clientName}\u060c\n\n\u0646\u062e\u0628\u0631\u0643\u0645 \u0623\u0646 \u0627\u0644\u0645\u0646\u062a\u062c "${cleanName}" (\u0639\u062f\u062f: ${client.totalFulfilled}) \u0642\u062f \u0648\u0635\u0644 \u0648\u0647\u0648 \u062c\u0627\u0647\u0632 \u0644\u0644\u062a\u0633\u0644\u064a\u0645!`;

        return {
          clientName: client.clientName,
          phone: client.phone,
          fulfilledQty: client.totalFulfilled,
          link: `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`,
        };
      });

      // If product was in rupture, remove it from rupture metadata since stock has arrived and was allocated
      try {
        const { id: rId, products: rProducts } = await getRuptureProductsFromDb();
        const normAllocated = normalizeProductName(cleanName);
        if (rProducts.has(normAllocated)) {
          rProducts.delete(normAllocated);
          await saveRuptureProductsToDb(rProducts, rId);
        }
      } catch (rErr) {
        console.warn('Warning: Could not update rupture status after auto-allocation:', rErr);
      }

      return NextResponse.json({ success: true, allocatedClients, surplusQty: remainingStock });
    }

    // --- MARK EN RUPTURE (Out of Stock) ---
    if (action === 'mark_en_rupture') {
      const { productName } = body;
      const cleanName = productName.trim();
      const normalizedName = normalizeProductName(cleanName);

      // 1. Persist to DB rupture metadata row
      const { id, products } = await getRuptureProductsFromDb();
      products.add(normalizedName);
      await saveRuptureProductsToDb(products, id);

      // 2. Also attempt updating DB column on demand_items if it exists
      const { data: items } = await supabaseAdmin
        .from('demand_items')
        .select('id, product_name')
        .eq('is_in_stock', false)
        .eq('is_delivered', false);

      const targetIds = (items || [])
        .filter((item) => normalizeProductName(item.product_name) === normalizedName)
        .map((item) => item.id);

      if (targetIds.length > 0) {
        try {
          await supabaseAdmin
            .from('demand_items')
            .update({ status: 'en_rupture' })
            .in('id', targetIds);
        } catch {
          // Column status might not exist yet in schema cache
        }
      }

      return NextResponse.json({ success: true, updatedCount: targetIds.length });
    }

    // --- RESTORE FROM RUPTURE ---
    if (action === 'restore_en_rupture') {
      const { productName } = body;
      const cleanName = productName.trim();
      const normalizedName = normalizeProductName(cleanName);

      // 1. Remove from DB rupture metadata row
      const { id, products } = await getRuptureProductsFromDb();
      products.delete(normalizedName);
      await saveRuptureProductsToDb(products, id);

      // 2. Also attempt updating DB column on demand_items if it exists
      const { data: items } = await supabaseAdmin
        .from('demand_items')
        .select('id, product_name')
        .eq('is_in_stock', false)
        .eq('is_delivered', false);

      const targetIds = (items || [])
        .filter((item) => normalizeProductName(item.product_name) === normalizedName)
        .map((item) => item.id);

      if (targetIds.length > 0) {
        try {
          await supabaseAdmin
            .from('demand_items')
            .update({ status: 'pending' })
            .in('id', targetIds);
        } catch {
          // Column status might not exist yet in schema cache
        }
      }

      return NextResponse.json({ success: true, updatedCount: targetIds.length });
    }

    if (action === 'delete_demand') {
      const { demandId } = body;
      unwrap(
        await supabaseAdmin.from('client_demands').delete().eq('id', demandId),
        'Deleting demand',
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_bulk_customers') {
      const { clientIds } = body;
      if (Array.isArray(clientIds) && clientIds.length > 0) {
        unwrap(
          await supabaseAdmin.from('client_demands').delete().in('client_id', clientIds),
          'Deleting customer demands',
        );
        unwrap(
          await supabaseAdmin.from('clients').delete().in('id', clientIds),
          'Deleting customers',
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'update_stock') {
      const { productName, deltaQty } = body;
      const cleanName = productName.trim();
      const delta = parseInt(deltaQty, 10) || 0;
      await updateMasterProductStock(cleanName, delta);
      return NextResponse.json({ success: true });
    }

    if (action === 'add_master_product') {
      const { name, category } = body;
      const cleanName = name.trim();
      const productCategory = category || DEFAULT_PRODUCT_CATEGORY;

      const product = unwrap(
        await supabaseAdmin
          .from('master_products')
          .upsert(
            { name: cleanName, category: productCategory },
            { onConflict: 'name' },
          )
          .select()
          .single(),
        'Adding master product',
      ) as MasterProduct;

      return NextResponse.json({ success: true, product });
    }

    if (action === 'archive_batch') {
      const { newBatchName } = body;
      const now = new Date().toISOString();

      unwrap(
        await supabaseAdmin
          .from('purchase_batches')
          .update({ is_archived: true, archived_at: now })
          .eq('is_archived', false),
        'Archiving active batches',
      );

      const batch = unwrap(
        await supabaseAdmin
          .from('purchase_batches')
          .insert({ batch_name: newBatchName, is_archived: false })
          .select()
          .single(),
        'Creating replacement batch',
      ) as PurchaseBatch;

      return NextResponse.json({ success: true, batch });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error executing database store action:', error);
    return NextResponse.json(
      { success: false, message: errorMessage(error) || 'Database action failed' },
      { status: 500 },
    );
  }
}
