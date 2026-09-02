-- ====================================================================
-- DATABASE SCHEMA: مكتبة وراقة اهل سوس - نظام متابعة خصاصات الدخول المدرسي
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLIENTS TABLE (الزبناء)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching clients by phone or name
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);

-- 2. MASTER PRODUCTS TABLE (كتالوج السلع الرئيسي للتكميل التلقائي)
CREATE TABLE IF NOT EXISTS public.master_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'كتاب مدرسي',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for autocomplete lookup
CREATE INDEX IF NOT EXISTS idx_master_products_name ON public.master_products(name);

-- 3. PURCHASE BATCHES TABLE (دفعات الطلبيات والمشتريات)
CREATE TABLE IF NOT EXISTS public.purchase_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name TEXT NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- Insert default active batch if none exists
INSERT INTO public.purchase_batches (batch_name, is_archived)
SELECT 'دفعة الدخول المدرسي الرئيسي', false
WHERE NOT EXISTS (SELECT 1 FROM public.purchase_batches WHERE is_archived = false);

-- 4. CLIENT DEMANDS TABLE (طلبيات الخصاص للزبناء)
CREATE TABLE IF NOT EXISTS public.client_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.purchase_batches(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'completed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_demands_client ON public.client_demands(client_id);
CREATE INDEX IF NOT EXISTS idx_client_demands_batch ON public.client_demands(batch_id);
CREATE INDEX IF NOT EXISTS idx_client_demands_status ON public.client_demands(status);

-- 5. DEMAND ITEMS TABLE (عناصر كل طلبية خصاص)
CREATE TABLE IF NOT EXISTS public.demand_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id UUID NOT NULL REFERENCES public.client_demands(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    fulfilled_quantity INTEGER DEFAULT 0,
    is_in_stock BOOLEAN DEFAULT FALSE,
    is_delivered BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demand_items_demand ON public.demand_items(demand_id);
CREATE INDEX IF NOT EXISTS idx_demand_items_product ON public.demand_items(product_name);
CREATE INDEX IF NOT EXISTS idx_demand_items_stock ON public.demand_items(is_in_stock, is_delivered);
CREATE INDEX IF NOT EXISTS idx_demand_items_status ON public.demand_items(status);

-- --------------------------------------------------------------------
-- HELPER TRIGGER TO AUTOMATICALLY UPDATE CLIENT DEMAND STATUS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_client_demand_status()
RETURNS TRIGGER AS $$
DECLARE
    target_demand_id UUID;
    total_count INTEGER;
    delivered_count INTEGER;
    new_status TEXT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_demand_id := OLD.demand_id;
    ELSE
        target_demand_id := NEW.demand_id;
    END IF;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_delivered = TRUE)
    INTO total_count, delivered_count
    FROM public.demand_items
    WHERE demand_id = target_demand_id;

    IF total_count = 0 THEN
        new_status := 'pending';
    ELSIF delivered_count = total_count THEN
        new_status := 'completed';
    ELSIF delivered_count > 0 THEN
        new_status := 'partial';
    ELSE
        new_status := 'pending';
    END IF;

    UPDATE public.client_demands
    SET status = new_status
    WHERE id = target_demand_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_demand_status ON public.demand_items;
CREATE TRIGGER trg_update_demand_status
AFTER INSERT OR UPDATE OR DELETE ON public.demand_items
FOR EACH ROW EXECUTE FUNCTION update_client_demand_status();

-- Add available_stock column if missing
ALTER TABLE public.master_products ADD COLUMN IF NOT EXISTS available_stock INTEGER DEFAULT 0;

-- Add status column to demand_items if missing
ALTER TABLE public.demand_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Enable Row Level Security (RLS) and allow anonymous dashboard access
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access clients" ON public.clients;
CREATE POLICY "Public full access clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access master_products" ON public.master_products;
CREATE POLICY "Public full access master_products" ON public.master_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access purchase_batches" ON public.purchase_batches;
CREATE POLICY "Public full access purchase_batches" ON public.purchase_batches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access client_demands" ON public.client_demands;
CREATE POLICY "Public full access client_demands" ON public.client_demands FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access demand_items" ON public.demand_items;
CREATE POLICY "Public full access demand_items" ON public.demand_items FOR ALL USING (true) WITH CHECK (true);
