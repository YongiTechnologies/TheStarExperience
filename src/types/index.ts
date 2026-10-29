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
}

export type OrderStatusType = 'received' | 'preparing' | 'ready' | 'completed';
export type PaymentStatusType = 'pending' | 'paid' | 'failed';
/** What the backend's payments API accepts (PaymentMethod). */
export type PaymentMethodType = 'momo' | 'card';

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
  /** Waiter looking after the order (admin board); for guests, set once they've accepted. */
  waiterName?: string;
  acceptedAt?: string;
  kitchenStatus?: StationState;
  barStatus?: StationState;
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
// These mirror the FastAPI Pydantic schemas in the backend's app/schemas
// (MenuItemResponse, MenuCategoryResponse, TableResponse, AdminOrderResponse,
// OrderResponse, OrderPaymentSummary). Change both sides together.

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

/** Order on the admin board (GET /api/admin/orders): AdminOrderResponse. */
export interface ApiAdminOrderResponse {
  id: number;
  table_number: string;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  /** received | preparing | ready | completed | cancelled */
  status: string;
  /** pending (also covers unpaid) | paid | failed | refunded */
  payment_status: string;
  payment_method: string | null;
  momo_network: string | null;
  payment_provider: string | null;
  waiter_id: number | null;
  waiter_name: string | null;
  accepted_at: string | null;
  kitchen_status: StationState | null;
  bar_status: StationState | null;
  ready_at: string | null;
  served_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  notes: string | null;
}

/** Payment as returned by /api/payments routes and embedded in guest orders. */
export interface ApiPaymentResponse {
  status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  provider?: string | null;
  method?: string | null;
  network?: string | null;
}

/** A guest's order (POST /api/orders, GET /api/orders/{id}): OrderResponse. */
export interface ApiOrderResponse {
  id: number;
  customer_id: number;
  table_id: number;
  /** The number printed on the table; table_id is only the database id. */
  table_number: string | null;
  /** Set once the waiter has accepted the order. */
  waiter_name: string | null;
  /** The raw OrderStatus: pending | paid | preparing | ready | completed | cancelled */
  status: string;
  total_amount: number;
  notes: string | null;
  tracking_token: string | null;
  customer: { id: number; name: string; phone_number: string } | null;
  payment: ApiPaymentResponse | null;
  items: {
    id: number;
    order_id: number;
    menu_item_id: number;
    quantity: number;
    unit_price: number;
    menu_item: { id: number; name: string } | null;
  }[];
  created_at: string | null;
  updated_at: string | null;
}

/** Order as the guest sees it on the tracking page; includes cancellation. */
export type TrackedOrderStatus = OrderStatusType | 'cancelled';

export interface TrackedOrder extends Omit<Order, 'status'> {
  status: TrackedOrderStatus;
}

// ─── Staff (waiters, kitchen, bar, admin) ─────────────────────────

export type StaffRoleName = 'admin' | 'waiter' | 'kitchen' | 'bar';
export type ShiftStatus = 'on_shift' | 'on_break' | 'off';
export type StationName = 'kitchen' | 'bar';
export type StationState = 'queued' | 'preparing' | 'ready';

export interface StaffPickerEntry {
  id: number;
  display_name: string;
  role: Exclude<StaffRoleName, 'admin'>;
}

export interface StaffProfile {
  id: number;
  display_name: string;
  role: StaffRoleName;
  shift_status: ShiftStatus;
}

export interface StaffMember {
  id: number;
  display_name: string;
  role: Exclude<StaffRoleName, 'admin'>;
  is_active: boolean;
  shift_status: ShiftStatus;
  has_pin: boolean;
  /** Locked out after too many wrong PINs. */
  locked: boolean;
  tables: string[];
  open_orders: number;
}

export interface StaffRef {
  id: number;
  display_name: string;
}

/** An order as staff screens see it (station screens only get their own lines). */
export interface StaffOrder {
  id: number;
  table_number: string | null;
  customer_name: string;
  customer_phone: string;
  notes: string | null;
  status: OrderStatusType | 'cancelled';
  total: number;
  /** unpaid | pending | paid | failed | refunded */
  payment_status: string;
  payment_provider: string | null;
  payment_method: string | null;
  waiter: StaffRef | null;
  /** When the current waiter got it (routing or reassignment). */
  assigned_at: string | null;
  accepted_at: string | null;
  kitchen_status: StationState | null;
  bar_status: StationState | null;
  ready_at: string | null;
  served_at: string | null;
  created_at: string | null;
  items: { name: string; quantity: number; station: StationName }[];
}

export interface WaiterBoard {
  me: StaffProfile;
  tables: string[];
  orders: StaffOrder[];
}

export interface FloorTable {
  id: number;
  table_number: string;
  waiter: StaffRef | null;
  waiter_available: boolean;
  open_orders: StaffOrder[];
}

export interface FloorWaiter {
  id: number;
  display_name: string;
  shift_status: ShiftStatus;
  tables: string[];
  open_orders: number;
}

export interface FloorView {
  tables: FloorTable[];
  waiters: FloorWaiter[];
  unassigned_orders: StaffOrder[];
}

/** A phone or tablet approved for staff sign-in (or waiting for its setup code). */
export interface StaffDeviceInfo {
  id: number;
  name: string;
  paired: boolean;
  created_at: string | null;
  last_seen_at: string | null;
  pairing_expires_at: string | null;
}

export interface DevicePairing {
  id: number;
  name: string;
  /** One-time setup code, e.g. "K7P2-9XQM". */
  code: string;
  expires_at: string;
}

export interface ActivityEntry {
  action: string;
  actor: string | null;
  created_at: string;
  detail: Record<string, unknown> | null;
}

/** A hint from the live event stream; screens re-fetch what they show. */
export interface LiveEvent {
  type: string;
  order_id?: number;
  table_number?: string;
  station?: StationName;
  staff_id?: number;
  waiter_id?: number | null;
}

