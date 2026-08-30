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
  const products = unwrap(
    await supabaseAdmin
      .from('master_products')
      .select('*'),
    'Loading master products',
  ) as MasterProduct[];

  const normalizedName = normalizeProductName(name);
  return products.find((product) => normalizeProductName(product.name) === normalizedName) || null;
}

async function ensureMasterProduct(name: string, category = DEFAULT_PRODUCT_CATEGORY): Promise<MasterProduct> {
  const existing = await getMasterProductByName(name);
  if (existing) {
    return existing;
  }

  return unwrap(
    await supabaseAdmin
      .from('master_products')
      .insert({ name, category })
      .select()
      .single(),
    'Creating master product',
  ) as MasterProduct;
}

async function updateMasterProductStock(productName: string, delta: number): Promise<void> {
  const product = await getMasterProductByName(productName);
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

async function getDemandsForBatch(batchId: string): Promise<ClientDemand[]> {
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

    const items = [...((row.items || []) as DatabaseRow[])].sort((a, b) => {
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    }) as ClientDemand['items'];

    demands.push({
      id: row.id,
      client_id: row.client_id,
      batch_id: row.batch_id,
      status: row.status,
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

    return NextResponse.json({
      success: true,
      activeBatch,
      masterProducts,
      demands,
    });
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
      const { clientName, clientPhone, items } = body;
      const cleanPhone = clientPhone.trim();
      const cleanName = clientName.trim();
      const activeBatch = await getActiveBatch();

      const client = unwrap(
        await supabaseAdmin
          .from('clients')
          .insert({ name: cleanName, phone: cleanPhone })
          .select()
          .single(),
        'Creating client',
      ) as DatabaseRow;

      const demand = unwrap(
        await supabaseAdmin
          .from('client_demands')
          .insert({ client_id: client.id, batch_id: activeBatch.id, status: 'pending' })
          .select()
          .single(),
        'Creating client demand',
      ) as DatabaseRow;

      for (const item of items) {
        const productName = item.product_name.trim();
        const quantity = Math.max(1, Math.floor(item.quantity || 1));
        const product = await ensureMasterProduct(productName);
        const availableStock = Math.max(0, Number(product.available_stock) || 0);
        const isInStock = availableStock >= quantity;

        if (isInStock) {
          unwrap(
            await supabaseAdmin
              .from('master_products')
              .update({ available_stock: availableStock - quantity })
              .eq('id', product.id),
            'Allocating available product stock',
          );
        }

        unwrap(
          await supabaseAdmin
            .from('demand_items')
            .insert({
              demand_id: demand.id,
              product_name: productName,
              quantity,
              is_in_stock: isInStock,
              is_delivered: false,
            }),
          'Creating demand item',
        );
      }

      return NextResponse.json({ success: true, demandId: demand.id });
    }

    if (action === 'update_demand') {
      const { demandId, clientName, clientPhone, items } = body;
      const cleanPhone = clientPhone.trim();
      const cleanName = clientName.trim();

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

      unwrap(
        await supabaseAdmin
          .from('clients')
          .update({ name: cleanName, phone: cleanPhone })
          .eq('id', demand.client_id),
        'Updating client',
      );

      const existingItems = unwrap(
        await supabaseAdmin
          .from('demand_items')
          .select('id')
          .eq('demand_id', demandId),
        'Loading existing demand items',
      ) as Array<{ id: string }>;
      const keepIds = new Set(items.map((item: DatabaseRow) => item.id).filter(Boolean));
      const removedIds = existingItems.map((item) => item.id).filter((id) => !keepIds.has(id));

      if (removedIds.length > 0) {
        unwrap(
          await supabaseAdmin.from('demand_items').delete().in('id', removedIds),
          'Removing deleted demand items',
        );
      }

      for (const item of items) {
        const productName = item.product_name.trim();
        const quantity = Math.max(1, Math.floor(item.quantity || 1));
        const isInStock = Boolean(item.is_in_stock);
        const isDelivered = Boolean(item.is_delivered);

        await ensureMasterProduct(productName);

        if (item.id) {
          unwrap(
            await supabaseAdmin
              .from('demand_items')
              .update({
                product_name: productName,
                quantity,
                is_in_stock: isInStock,
                is_delivered: isDelivered,
              })
              .eq('id', item.id),
            'Updating demand item',
          );
        } else {
          unwrap(
            await supabaseAdmin
              .from('demand_items')
              .insert({
                demand_id: demandId,
                product_name: productName,
                quantity,
                is_in_stock: isInStock,
                is_delivered: isDelivered,
              }),
            'Creating replacement demand item',
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
      }
      if (updates.is_delivered !== undefined) {
        update.is_delivered = Boolean(updates.is_delivered);
        if (updates.is_delivered) {
          update.is_in_stock = true;
        }
      }

      if (Object.keys(update).length > 0) {
        unwrap(
          await supabaseAdmin.from('demand_items').update(update).eq('id', itemId),
          'Updating demand item state',
        );
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

      // 2. Iterate over the fetched pending items with strict FIFO math
      for (const item of pendingItems) {
        if (remainingStock <= 0) {
          break;
        }

        const itemQty = Number(item.quantity) || 0;
        if (itemQty <= 0) {
          continue;
        }

        if (remainingStock >= itemQty) {
          // Mark this individual item as fulfilled
          unwrap(
            await supabaseAdmin
              .from('demand_items')
              .update({ is_in_stock: true })
              .eq('id', item.id),
            'Allocating received stock to demand item',
          );

          remainingStock -= itemQty;

          const clientRaw = item.demand?.client;
          const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
          if (client && client.phone) {
            const key = client.phone;
            if (!allocatedClientsMap[key]) {
              allocatedClientsMap[key] = {
                clientName: client.name || '',
                phone: client.phone,
                totalFulfilled: 0,
              };
            }
            allocatedClientsMap[key].totalFulfilled += itemQty;
          }
        } else if (remainingStock < itemQty && remainingStock > 0) {
          // Do NOT mark as fulfilled if the entire row cannot be fulfilled.
          // Break the loop so it remains pending for the next stock arrival.
          break;
        }
      }

      // Any surplus stock is added to master product available stock
      if (remainingStock > 0) {
        await ensureMasterProduct(cleanName);
        await updateMasterProductStock(cleanName, remainingStock);
      }

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

      return NextResponse.json({ success: true, allocatedClients, surplusQty: remainingStock });
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
