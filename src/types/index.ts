export type ItemCategory = 'all' | 'food' | 'drinks' | 'cocktails' | 'beer' | 'soft-drinks';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number; // In Ghanaian Cedis (GH₵)
  category: 'food' | 'drinks' | 'cocktails' | 'beer' | 'soft-drinks';
  available: boolean;
  image?: string;
  badge?: string; // e.g. "Signature", "Spicy", "Popular"
  prepTimeMinutes?: number;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  notes?: string;
}

export type OrderStatusType = 'received' | 'preparing' | 'ready' | 'completed';
export type PaymentStatusType = 'pending' | 'paid' | 'failed';
export type PaymentMethodType = 'momo' | 'card' | 'cash';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  notes?: string;
}

export interface Order {
  id: string;
  tableNumber: number | string;
  customerName: string;
  phone: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  status: OrderStatusType;
  paymentStatus: PaymentStatusType;
  paymentMethod: PaymentMethodType;
  momoNetwork?: 'mtn' | 'telecel' | 'at';
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  notes?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  tableNumber: string | number;
}

// ─── Backend API Response Types ───────────────────────────────────
// These mirror the FastAPI Pydantic schemas (MenuItemResponse, MenuCategoryResponse, TableResponse)

export interface ApiMenuItemResponse {
  id: number;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  category_id: number;
}

export interface ApiMenuCategoryResponse {
  id: number;
  name: string;
  description: string | null;
  items: ApiMenuItemResponse[];
}

export interface ApiTableResponse {
  id: number;
  table_number: string;
  capacity: number | null;
}

/** Admin order payload as returned by the FastAPI dashboard endpoint. */
export interface ApiAdminOrderResponse {
  id: number | string;
  table_number?: number | string;
  tableNumber?: number | string;
  customer_name?: string;
  customerName?: string;
  phone?: string;
  customer_phone?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
  subtotal?: number;
  total?: number;
  total_amount?: number;
  status?: string;
  payment_status?: string;
  paymentStatus?: string;
  payment_method?: string;
  paymentMethod?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  notes?: string;
}

export interface ApiOrderResponse {
  id: number;
  status: string;
  total_amount: number;
  created_at: string | null;
  updated_at: string | null;
}
