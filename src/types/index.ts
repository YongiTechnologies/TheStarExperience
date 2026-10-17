export type ItemCategory =
  | 'all'
  | 'food'
  | 'drinks'
  | 'cocktails'
  | 'beer'
  | 'wine'
  | 'spirits'
  | 'mocktails'
  | 'soft-drinks';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number; // In Ghanaian Cedis (GH₵)
  category: Exclude<ItemCategory, 'all' | 'drinks'>;
  available: boolean;
  image?: string;
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
  /** Unknown until the guest has started paying. */
  paymentMethod?: PaymentMethodType;
  momoNetwork?: 'mtn' | 'telecel' | 'at';
  /** "demo" while checkout is simulated: no money was actually collected. */
  paymentProvider?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  notes?: string;
  /** Secret from the backend that lets the guest view this order. */
  trackingToken?: string;
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
  payment_method?: string | null;
  paymentMethod?: string;
  momo_network?: string | null;
  payment_provider?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  notes?: string | null;
}

/** Payment as returned by /api/payments routes and embedded in guest orders. */
export interface ApiPaymentResponse {
  status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  provider?: string | null;
  method?: string | null;
  network?: string | null;
}

export interface ApiOrderResponse {
  id: number;
  table_id?: number;
  /** The number printed on the table; table_id is only the database id. */
  table_number?: string | null;
  status: string;
  total_amount: number;
  notes?: string | null;
  tracking_token?: string | null;
  customer?: { id: number; name: string; phone_number: string } | null;
  payment?: ApiPaymentResponse | null;
  items?: {
    id: number;
    menu_item_id: number;
    quantity: number;
    unit_price: number;
    menu_item?: { id: number; name: string } | null;
  }[];
  created_at: string | null;
  updated_at: string | null;
}

/** Order as the guest sees it on the tracking page; includes cancellation. */
export type TrackedOrderStatus = OrderStatusType | 'cancelled';

export interface TrackedOrder extends Omit<Order, 'status'> {
  status: TrackedOrderStatus;
}
