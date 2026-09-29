import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import type { ClientDemand, MasterProduct, PurchaseBatch, Employee, SchoolList } from '@/lib/types';

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

async function ensureMasterProductsWithCategories(
  items: { product_name: string; category?: string }[]
): Promise<void> {
  const map = new Map<string, string>();
  for (const item of items) {
    const name = (item.product_name || '').trim();
    if (!name) continue;
    const cat = item.category ? item.category.trim() : DEFAULT_PRODUCT_CATEGORY;
    map.set(name, cat);
  }

  if (map.size === 0) return;

  const rows = Array.from(map.entries()).map(([name, category]) => ({
    name,
    category,
  }));

  unwrap(
    await supabaseAdmin
      .from('master_products')
      .upsert(rows, { onConflict: 'name' }),
    'Upserting master products with categories',
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
          ticket_id,
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
        ticket_id: relatedClient.ticket_id || null,
        created_at: relatedClient.created_at,
      },
      items,
    });
  }

  return demands;
}

async function getEmployeesFromDb(): Promise<Employee[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.warn('Error loading employees from db:', error);
      return [];
    }
    return (data || []) as Employee[];
  } catch (err) {
    console.warn('Exception loading employees:', err);
    return [];
  }
}

async function getSchoolListsFromDb(): Promise<SchoolList[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('school_lists')
      .select(`
        id,
        client_name,
        school_name,
        phone,
        employee_id,
        status,
        client_id,
        created_at,
        employee:employees (
          id,
          name
        ),
        client:clients (
          id,
          name,
          phone,
          ticket_id
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error loading school lists from db:', error);
      return [];
    }
    return (data || []).map((row: any) => ({
      ...row,
      employee: Array.isArray(row.employee) ? row.employee[0] : row.employee,
      client: Array.isArray(row.client) ? row.client[0] : row.client,
    })) as SchoolList[];
  } catch (err) {
    console.warn('Exception loading school lists:', err);
    return [];
  }
}

async function checkAndUpdateFulfilledSchoolLists(clientIds: string[]): Promise<void> {
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));
  if (uniqueClientIds.length === 0) return;

  try {
    for (const cId of uniqueClientIds) {
      const { data: demands } = await supabaseAdmin
        .from('client_demands')
        .select(`
          id,
          items:demand_items (
            id,
            quantity,
            fulfilled_quantity,
            is_in_stock,
            is_delivered
          )
        `)
        .eq('client_id', cId);

      if (!demands || demands.length === 0) continue;

      let allFulfilled = true;
      let totalItemsCount = 0;

      for (const d of demands) {
        const items = d.items || [];
        totalItemsCount += items.length;
        for (const it of items) {
          const totalQty = Number(it.quantity) || 0;
          const fulfilled = Number(it.fulfilled_quantity) || (it.is_in_stock ? totalQty : 0);
          if (!it.is_in_stock && !it.is_delivered && fulfilled < totalQty) {
            allFulfilled = false;
            break;
          }
        }
        if (!allFulfilled) break;
      }

      if (allFulfilled && totalItemsCount > 0) {
        await supabaseAdmin
          .from('school_lists')
          .update({ status: 'done' })
          .eq('client_id', cId)
          .eq('status', 'pending');
      }
    }
  } catch (err) {
    console.warn('Warning: Could not check/update fulfilled school lists:', err);
  }
}

async function getAllMasterProductsFromDb(): Promise<{ products: MasterProduct[]; totalCount: number }> {
  const CHUNK_SIZE = 1000;
  let all: MasterProduct[] = [];
  let from = 0;
  let totalCount = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, count, error } = await supabaseAdmin
      .from('master_products')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(from, from + CHUNK_SIZE - 1);

    if (error) {
      console.error('Error fetching master products chunk:', error);
      break;
    }

    if (count !== null && count !== undefined) {
      totalCount = count;
    }

    if (data && data.length > 0) {
      all = all.concat(data as MasterProduct[]);
      if (data.length < CHUNK_SIZE) {
        hasMore = false;
      } else {
        from += CHUNK_SIZE;
      }
    } else {
      hasMore = false;
    }
  }

  return { products: all, totalCount: totalCount || all.length };
}

export async function GET() {
  try {
    const activeBatch = await getActiveBatch();

    const [
      { products: masterProducts, totalCount: masterProductsCount },
      demands,
      employees,
      schoolLists,
    ] = await Promise.all([
      getAllMasterProductsFromDb(),
      getDemandsForBatch(activeBatch.id),
      getEmployeesFromDb(),
      getSchoolListsFromDb(),
    ]);

    const response = NextResponse.json({
      success: true,
      activeBatch,
      masterProducts,
      masterProductsCount,
      demands,
      employees,
      schoolLists,
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
      const { clientName, clientPhone, items, avance_amount, total_amount, ticketId, ticket_id } = body;
      const cleanPhone = (clientPhone || '').trim();
      const cleanName = (clientName || '').trim();
      const rawTicket = ticket_id !== undefined ? ticket_id : ticketId;
      const cleanTicketId = rawTicket ? String(rawTicket).trim() : null;
      const activeBatch = await getActiveBatch();
      const numAvance = avance_amount !== undefined && avance_amount !== null && avance_amount !== '' ? Number(avance_amount) : 0;
      const numTotal = total_amount !== undefined && total_amount !== null && total_amount !== '' ? Number(total_amount) : 0;

      // 1. Create client
      let client: DatabaseRow;
      try {
        client = unwrap(
          await supabaseAdmin
            .from('clients')
            .insert({ name: cleanName, phone: cleanPhone, ticket_id: cleanTicketId })
            .select()
            .single(),
          'Creating client with ticket_id',
        ) as DatabaseRow;
      } catch {
        client = unwrap(
          await supabaseAdmin
            .from('clients')
            .insert({ name: cleanName, phone: cleanPhone })
            .select()
            .single(),
          'Creating client fallback',
        ) as DatabaseRow;
      }

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

      // 3. Bulk Safe Upsert Master Products with Categories (onConflict: 'name')
      const validItems = (Array.isArray(items) ? items : []).filter(
        (it: any) => it && it.product_name && it.product_name.trim()
      );
      await ensureMasterProductsWithCategories(validItems);


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
      const { demandId, clientName, clientPhone, items, avance_amount, total_amount, ticketId, ticket_id } = body;
      const cleanPhone = (clientPhone || '').trim();
      const cleanName = (clientName || '').trim();
      const rawTicket = ticket_id !== undefined ? ticket_id : ticketId;
      const cleanTicketId = rawTicket !== undefined ? (String(rawTicket || '').trim() || null) : undefined;
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
      const clientUpdates: DatabaseRow = { name: cleanName, phone: cleanPhone };
      if (cleanTicketId !== undefined) {
        clientUpdates.ticket_id = cleanTicketId;
      }

      try {
        unwrap(
          await supabaseAdmin
            .from('clients')
            .update(clientUpdates)
            .eq('id', demand.client_id),
          'Updating client with ticket_id',
        );
      } catch {
        unwrap(
          await supabaseAdmin
            .from('clients')
            .update({ name: cleanName, phone: cleanPhone })
            .eq('id', demand.client_id),
          'Updating client fallback',
        );
      }

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

      if (updates.is_in_stock || updates.is_delivered) {
        try {
          const { data: itData } = await supabaseAdmin
            .from('demand_items')
            .select('demand:client_demands (client_id)')
            .eq('id', itemId)
            .single();
          const cliId = (itData?.demand as any)?.client_id;
          if (cliId) {
            await checkAndUpdateFulfilledSchoolLists([cliId]);
          }
        } catch {}
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

      // Smart relational link: If client demands are 100% fulfilled, mark linked school_lists as 'done'
      const allocatedClientIds = pendingItems
        .map((it) => {
          const cRaw = it.demand?.client;
          const c = Array.isArray(cRaw) ? cRaw[0] : cRaw;
          return c?.id;
        })
        .filter(Boolean);

      await checkAndUpdateFulfilledSchoolLists(allocatedClientIds);

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

    if (action === 'update_product_category' || action === 'update_master_product') {
      const { productId, productName, category } = body;
      const cleanCategory = (category || 'others').trim();

      let query = supabaseAdmin.from('master_products').update({ category: cleanCategory });
      if (productId) {
        query = query.eq('id', productId);
      } else if (productName) {
        query = query.eq('name', productName.trim());
      } else {
        return NextResponse.json({ success: false, message: 'productId or productName required' }, { status: 400 });
      }

      const product = unwrap(
        await query.select().single(),
        'Updating product category',
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

    // --- EMPLOYEES CRUD ---
    if (action === 'add_employee') {
      const { name } = body;
      const cleanName = (name || '').trim();
      if (!cleanName) {
        return NextResponse.json({ success: false, message: 'Employee name is required' }, { status: 400 });
      }

      const employee = unwrap(
        await supabaseAdmin
          .from('employees')
          .insert({ name: cleanName })
          .select()
          .single(),
        'Creating employee',
      );

      return NextResponse.json({ success: true, employee });
    }

    if (action === 'update_employee') {
      const { id, name } = body;
      const cleanName = (name || '').trim();
      if (!cleanName) {
        return NextResponse.json({ success: false, message: 'Employee name is required' }, { status: 400 });
      }

      const employee = unwrap(
        await supabaseAdmin
          .from('employees')
          .update({ name: cleanName })
          .eq('id', id)
          .select()
          .single(),
        'Updating employee',
      );

      return NextResponse.json({ success: true, employee });
    }

    if (action === 'delete_employee') {
      const { id } = body;
      unwrap(
        await supabaseAdmin
          .from('employees')
          .delete()
          .eq('id', id),
        'Deleting employee',
      );

      return NextResponse.json({ success: true });
    }

    // --- SCHOOL LISTS CRUD & LINKING ---
    if (action === 'create_school_list') {
      const { client_name, school_name, phone, employee_id, status, client_id } = body;
      const cleanClientName = (client_name || '').trim();
      const cleanSchoolName = (school_name || '').trim();
      const cleanPhone = (phone || '').trim() || null;
      const listStatus = status === 'done' ? 'done' : 'pending';

      let schoolList: DatabaseRow | null = null;
      try {
        schoolList = unwrap(
          await supabaseAdmin
            .from('school_lists')
            .insert({
              client_name: cleanClientName,
              school_name: cleanSchoolName,
              phone: cleanPhone,
              employee_id: employee_id || null,
              status: listStatus,
              client_id: client_id || null,
            })
            .select(`
              id,
              client_name,
              school_name,
              phone,
              employee_id,
              status,
              client_id,
              created_at,
              employee:employees (
                id,
                name
              ),
              client:clients (
                id,
                name,
                phone,
                ticket_id
              )
            `)
            .single(),
          'Creating school list',
        ) as DatabaseRow | null;
      } catch {
        schoolList = unwrap(
          await supabaseAdmin
            .from('school_lists')
            .insert({
              client_name: cleanClientName,
              school_name: cleanSchoolName,
              employee_id: employee_id || null,
              status: listStatus,
              client_id: client_id || null,
            })
            .select(`
              id,
              client_name,
              school_name,
              employee_id,
              status,
              client_id,
              created_at,
              employee:employees (
                id,
                name
              ),
              client:clients (
                id,
                name,
                phone,
                ticket_id
              )
            `)
            .single(),
          'Creating school list fallback',
        ) as DatabaseRow | null;
      }

      if (!schoolList) {
        return NextResponse.json({ success: false, message: 'Failed to create school list' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        schoolList: {
          ...schoolList,
          employee: Array.isArray(schoolList.employee) ? schoolList.employee[0] : schoolList.employee,
          client: Array.isArray(schoolList.client) ? schoolList.client[0] : schoolList.client,
        },
      });
    }

    if (action === 'update_school_list') {
      const { id, updates } = body;
      const safeUpdates: DatabaseRow = {};
      if (updates.client_name !== undefined) safeUpdates.client_name = updates.client_name.trim();
      if (updates.school_name !== undefined) safeUpdates.school_name = updates.school_name.trim();
      if (updates.phone !== undefined) safeUpdates.phone = (updates.phone || '').trim() || null;
      if (updates.employee_id !== undefined) safeUpdates.employee_id = updates.employee_id || null;
      if (updates.status !== undefined) safeUpdates.status = updates.status;
      if (updates.client_id !== undefined) safeUpdates.client_id = updates.client_id || null;

      let schoolList: DatabaseRow | null = null;
      try {
        schoolList = unwrap(
          await supabaseAdmin
            .from('school_lists')
            .update(safeUpdates)
            .eq('id', id)
            .select(`
              id,
              client_name,
              school_name,
              phone,
              employee_id,
              status,
              client_id,
              created_at,
              employee:employees (
                id,
                name
              ),
              client:clients (
                id,
                name,
                phone,
                ticket_id
              )
            `)
            .single(),
          'Updating school list',
        ) as DatabaseRow | null;
      } catch {
        const fallbackUpdates = { ...safeUpdates };
        delete fallbackUpdates.phone;
        schoolList = unwrap(
          await supabaseAdmin
            .from('school_lists')
            .update(fallbackUpdates)
            .eq('id', id)
            .select(`
              id,
              client_name,
              school_name,
              employee_id,
              status,
              client_id,
              created_at,
              employee:employees (
                id,
                name
              ),
              client:clients (
                id,
                name,
                phone,
                ticket_id
              )
            `)
            .single(),
          'Updating school list fallback',
        ) as DatabaseRow | null;
      }

      if (!schoolList) {
        return NextResponse.json({ success: false, message: 'School list not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        schoolList: {
          ...schoolList,
          employee: Array.isArray(schoolList.employee) ? schoolList.employee[0] : schoolList.employee,
          client: Array.isArray(schoolList.client) ? schoolList.client[0] : schoolList.client,
        },
      });
    }

    if (action === 'delete_school_list') {
      const { id } = body;
      unwrap(
        await supabaseAdmin
          .from('school_lists')
          .delete()
          .eq('id', id),
        'Deleting school list',
      );

      return NextResponse.json({ success: true });
    }

    if (action === 'link_school_list_client') {
      const { listId, clientId } = body;
      const targetClientId = clientId || null;
      const updateData: DatabaseRow = { client_id: targetClientId };
      if (targetClientId) {
        updateData.status = 'pending';
      }

      const schoolList = unwrap(
        await supabaseAdmin
          .from('school_lists')
          .update(updateData)
          .eq('id', listId)
          .select(`
            id,
            client_name,
            school_name,
            employee_id,
            status,
            client_id,
            created_at,
            employee:employees (
              id,
              name
            ),
            client:clients (
              id,
              name,
              phone
            )
          `)
          .single(),
        'Linking client to school list',
      ) as DatabaseRow | null;

      if (!schoolList) {
        return NextResponse.json({ success: false, message: 'School list not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        schoolList: {
          ...schoolList,
          employee: Array.isArray(schoolList.employee) ? schoolList.employee[0] : schoolList.employee,
          client: Array.isArray(schoolList.client) ? schoolList.client[0] : schoolList.client,
        },
      });
    }

    if (action === 'convert_school_list_to_client') {
      const { listId } = body;

      // 1. Fetch current school list record
      const schoolList = unwrap(
        await supabaseAdmin
          .from('school_lists')
          .select('*')
          .eq('id', listId)
          .maybeSingle(),
        'Loading school list for conversion',
      ) as DatabaseRow | null;

      if (!schoolList) {
        return NextResponse.json({ success: false, message: 'School list not found' }, { status: 404 });
      }

      const cleanClientName = (schoolList.client_name || '').trim();
      let targetClientId: string | null = schoolList.client_id || null;
      let clientRow: DatabaseRow | null = null;

      // Step A: Check if client exists in clients table (or create new if missing)
      if (targetClientId) {
        const existingClient = unwrap(
          await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('id', targetClientId)
            .maybeSingle(),
          'Checking existing linked client',
        ) as DatabaseRow | null;
        if (existingClient) {
          clientRow = existingClient;
        }
      }

      if (!clientRow && cleanClientName) {
        // Search by name (case-insensitive)
        const { data: matchedClients } = await supabaseAdmin
          .from('clients')
          .select('*')
          .ilike('name', cleanClientName)
          .limit(1);

        if (matchedClients && matchedClients.length > 0 && matchedClients[0]) {
          const foundClient = matchedClients[0];
          clientRow = foundClient;
          targetClientId = foundClient.id;
        } else {
          // INSERT new client with list's client_name and phone
          const insertedClient = unwrap(
            await supabaseAdmin
              .from('clients')
              .insert({ name: cleanClientName, phone: schoolList.phone || '' })
              .select()
              .single(),
            'Inserting new client from school list',
          ) as DatabaseRow | null;
          if (insertedClient) {
            clientRow = insertedClient;
            targetClientId = insertedClient.id;
          }
        }
      }

      if (!targetClientId || !clientRow) {
        return NextResponse.json(
          { success: false, message: 'Could not create or resolve client' },
          { status: 400 },
        );
      }

      // Step B: Update current school_lists record to link this client_id
      const updatedList = unwrap(
        await supabaseAdmin
          .from('school_lists')
          .update({
            client_id: targetClientId,
            status: 'pending',
          })
          .eq('id', listId)
          .select(`
            id,
            client_name,
            school_name,
            employee_id,
            status,
            client_id,
            created_at,
            employee:employees (
              id,
              name
            ),
            client:clients (
              id,
              name,
              phone
            )
          `)
          .single(),
        'Updating school list with client link',
      ) as DatabaseRow | null;

      if (!updatedList) {
        return NextResponse.json(
          { success: false, message: 'Failed to update school list' },
          { status: 500 },
        );
      }

      // Step C Preparation: Ensure a client_demands record exists in the active batch
      const activeBatch = await getActiveBatch();
      const { data: existingDemands } = await supabaseAdmin
        .from('client_demands')
        .select('id')
        .eq('client_id', targetClientId)
        .eq('batch_id', activeBatch.id)
        .limit(1);

      let demandId = '';
      if (existingDemands && existingDemands.length > 0 && existingDemands[0]) {
        demandId = existingDemands[0].id;
      } else {
        let newDemand: DatabaseRow | null = null;
        try {
          newDemand = unwrap(
            await supabaseAdmin
              .from('client_demands')
              .insert({
                client_id: targetClientId,
                batch_id: activeBatch.id,
                status: 'pending',
                avance_amount: 0,
                total_amount: 0,
              })
              .select()
              .single(),
            'Creating initial client demand',
          ) as DatabaseRow;
        } catch {
          newDemand = unwrap(
            await supabaseAdmin
              .from('client_demands')
              .insert({
                client_id: targetClientId,
                batch_id: activeBatch.id,
                status: 'pending',
              })
              .select()
              .single(),
            'Creating initial client demand fallback',
          ) as DatabaseRow;
        }
        demandId = newDemand?.id || '';
      }

      return NextResponse.json({
        success: true,
        clientId: targetClientId,
        demandId: demandId,
        schoolList: {
          ...updatedList,
          employee: Array.isArray(updatedList.employee) ? updatedList.employee[0] : updatedList.employee,
          client: Array.isArray(updatedList.client) ? updatedList.client[0] : updatedList.client,
        },
      });
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
