export interface Client {
  id: string;
  name: string;
  phone: string;
  ticket_id?: string | null;
  created_at?: string;
}

export interface MasterProduct {
  id: string;
  name: string;
  category: string;
  available_stock?: number;
  created_at?: string;
}

export interface PurchaseBatch {
  id: string;
  batch_name: string;
  is_archived: boolean;
  created_at?: string;
  archived_at?: string | null;
}

export type DemandStatus = 'pending' | 'partial' | 'completed';

export interface DemandItem {
  id: string;
  demand_id: string;
  product_name: string;
  quantity: number;
  unit_price?: number;
  fulfilled_quantity?: number;
  is_in_stock: boolean;
  is_delivered: boolean;
  status?: string;
  category?: string;
  created_at?: string;
}

export interface ClientDemand {
  id: string;
  client_id: string;
  batch_id?: string | null;
  status: DemandStatus;
  avance_amount?: number;
  total_amount?: number;
  created_at?: string;
  
  // Joined relational data
  client?: Client;
  items?: DemandItem[];
  batch?: PurchaseBatch;
}

export interface StockAllocationItem {
  itemId: string;
  demandId: string;
  clientName: string;
  clientPhone: string;
  productName: string;
  requiredQty: number;
  demandCreatedAt: string;
  isAlreadyInStock: boolean;
  isDelivered: boolean;
}

export interface SupplierAggregatedItem {
  productName: string;
  totalQuantity: number;
  category?: string;
  clients: {
    clientName: string;
    phone: string;
    quantity: number;
    demandId: string;
  }[];
}

export interface Employee {
  id: string;
  name: string;
  created_at?: string;
}

export type SchoolListStatus = 'done' | 'pending';
export type ReadinessStatus = 'جاهزة بالكامل' | 'جاهزة جزئيا';
export type DeliveryStatus = 'في انتظار التسليم' | 'طلبية مستلمة';

export interface SchoolList {
  id: string;
  client_name: string;
  school_name: string;
  phone?: string | null;
  ticket_id?: string | null;
  avance_amount?: number | null;
  total_amount?: number | null;
  employee_id?: string | null;
  status: SchoolListStatus;
  readiness_status?: ReadinessStatus | string | null;
  delivery_status?: DeliveryStatus | string | null;
  client_id?: string | null;
  created_at?: string;

  // Joined relational data
  employee?: Employee;
  client?: Client;
}

