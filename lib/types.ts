export interface Client {
  id: string;
  name: string;
  phone: string;
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
  is_in_stock: boolean;
  is_delivered: boolean;
  status?: string;
  created_at?: string;
}

export interface ClientDemand {
  id: string;
  client_id: string;
  batch_id?: string | null;
  status: DemandStatus;
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
  clients: {
    clientName: string;
    phone: string;
    quantity: number;
    demandId: string;
  }[];
}
