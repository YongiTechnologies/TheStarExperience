/**
 * API client for The Star Experience FastAPI backend (NEXT_PUBLIC_API_URL).
 *
 * Guests
 * - GET   /api/menu, /api/menu/categories       Menu and category names
 * - GET   /api/tables/number/{number}           Validate the table from the QR code
 * - POST  /api/orders                           Place an order (returns a tracking token)
 * - GET   /api/orders/{id}  (X-Order-Token)      Live order tracking
 * - POST  /api/payments/initialize, /verify     Record payment (demo provider for now)
 *
 * Staff (bearer token from /api/auth/token)
 * - GET   /api/admin/orders                     Live order board
 * - PATCH /api/admin/orders/{id}/status         Move an order along
 * - GET/POST/PATCH/DELETE /api/admin/menu/items Menu management
 */

import {
  MenuItem,
  Order,
  OrderStatusType,
  PaymentMethodType,
  ApiMenuItemResponse,
  ApiMenuCategoryResponse,
  ApiTableResponse,
  ApiAdminOrderResponse,
  ApiOrderResponse,
  ApiPaymentResponse,
  TrackedOrder,
  TrackedOrderStatus,
} from '@/types';
import { getMenuImage } from '@/data/menu';
import type { MomoNetwork } from '@/lib/momo';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://backend-thestarexperience-ip37.onrender.com'
).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 10000;

/** Custom error class for API failures, includes HTTP status code (0 = network). */
export class ApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ─── Staff session ───────────────────────────────────────────────

const ADMIN_TOKEN_STORAGE_KEY = 'star_experience_admin_token';
/** Fired on window when a staff request comes back 401 and the session is cleared. */
export const SESSION_EXPIRED_EVENT = 'star_experience_session_expired';

function readAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

function tokenIsUnexpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/** True when a staff token exists and has not passed its expiry time. */
export function hasValidAdminSession(): boolean {
  const token = readAdminToken();
  return Boolean(token && tokenIsUnexpired(token));
}

/** True when staff were signed in but the token has since expired (vs never signed in / signed out). */
export function hasExpiredAdminSession(): boolean {
  const token = readAdminToken();
  return Boolean(token && !tokenIsUnexpired(token));
}

/** Authenticate a staff member and keep the access token for staff API calls. */
export async function loginAdmin(username: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  }).catch(() => {
    throw new ApiError('Couldn’t reach the server. Check your connection and try again.', 0);
  });

  if (!response.ok) {
    throw new ApiError('Incorrect username or password.', response.status, await response.text());
  }

  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new ApiError('The backend did not return an access token.', 0);
  }
  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token.access_token);
}

// ─── Transport ───────────────────────────────────────────────────

/** Fetch JSON from the backend with a timeout and consistent errors. 204 resolves to undefined. */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const isStaffRequest = endpoint.startsWith('/api/admin');
  const adminToken = isStaffRequest ? readAdminToken() : null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (isStaffRequest && response.status === 401) {
        clearAdminSession();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw new ApiError(`API error ${response.status}: ${response.statusText}`, response.status, errorBody);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out. The server may be unavailable.', 0);
    }
    throw new ApiError(error instanceof Error ? error.message : 'Network error — could not reach the server.', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Turn an API failure into a sentence a person can act on. */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'We couldn’t reach the bar’s system. Check your connection and try again.';
    if (error.status === 401) return 'Your staff session has ended. Please sign in again.';
    try {
      const detail = JSON.parse(error.body)?.detail;
      if (typeof detail === 'string') return detail;
      // FastAPI validation errors: [{ msg: "..." }, ...]
      if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
    } catch {
      // Body was not JSON; fall through to the generic message.
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

// ─── Menu ────────────────────────────────────────────────────────

let categoryMapCache: Record<number, string> | null = null;

async function getCategoryMap(): Promise<Record<number, string>> {
  if (categoryMapCache) return categoryMapCache;
  const categories = await apiFetch<ApiMenuCategoryResponse[]>('/api/menu/categories');
  categoryMapCache = Object.fromEntries(categories.map((cat) => [cat.id, cat.name]));
  return categoryMapCache;
}

async function getCategoryId(category: MenuItem['category']): Promise<number> {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = Object.entries(await getCategoryMap()).find(([, name]) => normalize(name) === normalize(category));
  if (!match) throw new ApiError(`No backend category matches “${category}”.`, 422);
  return Number(match[0]);
}

function mapApiMenuItem(apiItem: ApiMenuItemResponse, categoryMap: Record<number, string>): MenuItem {
  return {
    id: String(apiItem.id),
    name: apiItem.name,
    description: apiItem.description || '',
    price: apiItem.price,
    category: (categoryMap[apiItem.category_id] || 'food') as MenuItem['category'],
    available: apiItem.is_available,
    image: getMenuImage(apiItem.name),
  };
}

/** Guest menu, including sold-out items so guests can see what's off tonight. */
export async function getMenu(): Promise<MenuItem[]> {
  const [apiItems, categoryMap] = await Promise.all([
    apiFetch<ApiMenuItemResponse[]>('/api/menu'),
    getCategoryMap(),
  ]);
  return apiItems.map((item) => mapApiMenuItem(item, categoryMap));
}

/** Staff menu list; going through the staff route also confirms the session is valid. */
export async function getAdminMenu(): Promise<MenuItem[]> {
  const [apiItems, categoryMap] = await Promise.all([
    apiFetch<ApiMenuItemResponse[]>('/api/admin/menu/items'),
    getCategoryMap(),
  ]);
  return apiItems.map((item) => mapApiMenuItem(item, categoryMap));
}

/** Create a menu item (isNew) or save edits to an existing one. */
export async function saveMenuItem(item: MenuItem, isNew: boolean): Promise<MenuItem> {
  const body = JSON.stringify({
    name: item.name,
    description: item.description || null,
    price: item.price,
    is_available: item.available,
    category_id: await getCategoryId(item.category),
  });
  const saved = await apiFetch<ApiMenuItemResponse>(
    isNew ? '/api/admin/menu/items' : `/api/admin/menu/items/${encodeURIComponent(item.id)}`,
    { method: isNew ? 'POST' : 'PATCH', body }
  );
  return mapApiMenuItem(saved, await getCategoryMap());
}

/** Mark an item available or sold out. */
export async function toggleItemAvailability(id: string, available: boolean): Promise<MenuItem> {
  const saved = await apiFetch<ApiMenuItemResponse>(`/api/admin/menu/items/${encodeURIComponent(id)}/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ is_available: available }),
  });
  return mapApiMenuItem(saved, await getCategoryMap());
}

/** Delete an item. The backend refuses (409) once an item appears in an order. */
export async function deleteMenuItem(id: string): Promise<void> {
  await apiFetch<void>(`/api/admin/menu/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Tables ──────────────────────────────────────────────────────

/** Look up a table by the number printed on it. Returns null if it doesn't exist. */
export async function getTable(tableNumber: string): Promise<ApiTableResponse | null> {
  try {
    return await apiFetch<ApiTableResponse>(`/api/tables/number/${encodeURIComponent(tableNumber)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

// ─── Orders (staff) ──────────────────────────────────────────────

function asOrderStatus(status: string | undefined): OrderStatusType {
  return status === 'preparing' || status === 'ready' || status === 'completed' ? status : 'received';
}

function asPaymentMethod(method: string | null | undefined): PaymentMethodType | undefined {
  return method === 'momo' || method === 'card' || method === 'cash' ? method : undefined;
}

function asMomoNetwork(network: string | null | undefined): MomoNetwork | undefined {
  return network === 'mtn' || network === 'telecel' || network === 'at' ? network : undefined;
}

function mapAdminOrder(order: ApiAdminOrderResponse): Order {
  const items = order.items || order.order_items || [];
  const total = order.total ?? order.total_amount ?? 0;
  const paymentStatus = order.payment_status ?? order.paymentStatus;

  return {
    id: String(order.id),
    tableNumber: order.table_number ?? order.tableNumber ?? '',
    customerName: order.customer_name ?? order.customerName ?? 'Guest',
    phone: order.customer_phone ?? order.phone ?? '',
    items,
    subtotal: order.subtotal ?? total,
    total,
    status: asOrderStatus(order.status),
    paymentStatus: paymentStatus === 'paid' || paymentStatus === 'failed' ? paymentStatus : 'pending',
    paymentMethod: asPaymentMethod(order.payment_method ?? order.paymentMethod),
    momoNetwork: asMomoNetwork(order.momo_network),
    paymentProvider: order.payment_provider ?? undefined,
    createdAt: order.created_at ?? order.createdAt ?? new Date(0).toISOString(),
    updatedAt: order.updated_at ?? order.updatedAt ?? new Date(0).toISOString(),
    notes: order.notes ?? undefined,
  };
}

/** Every order, newest first, for the bar's live board. */
export async function getOrders(): Promise<Order[]> {
  const orders = await apiFetch<ApiAdminOrderResponse[]>('/api/admin/orders');
  return orders.map(mapAdminOrder);
}

export async function updateOrderStatus(id: string, status: OrderStatusType): Promise<Order> {
  const updatedOrder = await apiFetch<ApiAdminOrderResponse>(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return mapAdminOrder(updatedOrder);
}

// ─── Orders (guests) ─────────────────────────────────────────────

export interface NewOrder {
  tableNumber: string;
  customerName: string;
  phone: string;
  items: { id: string; name: string; price: number; quantity: number; category?: string }[];
  notes?: string;
  /** Same key for retries of the same order, so a lost response can't create a duplicate. */
  idempotencyKey?: string;
}

/** Place an order. The backend prices it from the menu and returns a tracking token. */
export async function createOrder(newOrder: NewOrder): Promise<TrackedOrder> {
  const items = newOrder.items.map((item) => ({ menu_item_id: Number(item.id), quantity: item.quantity }));
  if (items.some((item) => !Number.isInteger(item.menu_item_id))) {
    throw new ApiError('Orders can only contain menu items loaded from the backend.', 422);
  }

  const created = await apiFetch<ApiOrderResponse>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      table_number: newOrder.tableNumber.trim(),
      customer_name: newOrder.customerName,
      customer_phone: newOrder.phone,
      items,
      notes: newOrder.notes?.trim() || undefined,
      idempotency_key: newOrder.idempotencyKey,
    }),
  });

  return {
    id: String(created.id),
    tableNumber: created.table_number ?? newOrder.tableNumber,
    customerName: newOrder.customerName,
    phone: newOrder.phone,
    items: newOrder.items,
    subtotal: created.total_amount,
    total: created.total_amount,
    status: asTrackedStatus(created.status),
    paymentStatus: 'pending',
    notes: created.notes ?? undefined,
    trackingToken: created.tracking_token ?? undefined,
    createdAt: created.created_at ?? new Date().toISOString(),
    updatedAt: created.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Pay for an order: start a payment and confirm it. Only the demo provider
 * exists today, so no money moves and staff see the payment labelled "demo".
 * A real provider would return a checkout/MoMo prompt between the two calls.
 * Safe to retry: an order that is already paid is reported as paid, not charged again.
 */
export async function payForOrder(
  order: { id: string; trackingToken?: string },
  method: 'momo' | 'card',
  network?: MomoNetwork
): Promise<ApiPaymentResponse> {
  const access = { order_id: Number(order.id), tracking_token: order.trackingToken ?? '' };
  const started = await apiFetch<ApiPaymentResponse & { reference: string }>('/api/payments/initialize', {
    method: 'POST',
    body: JSON.stringify({ ...access, method, network: method === 'momo' ? network : undefined }),
  });
  if (started.status === 'paid') return started;
  return apiFetch<ApiPaymentResponse>('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify({ ...access, reference: started.reference }),
  });
}

/** Map the backend's order lifecycle onto the steps a guest sees. */
function asTrackedStatus(status: string | undefined): TrackedOrderStatus {
  return status === 'cancelled' ? 'cancelled' : asOrderStatus(status);
}

/** Fetch an order for the guest's live tracking page (requires its tracking token). */
export async function getCustomerOrder(id: string, token?: string): Promise<TrackedOrder> {
  const snapshot = getRecentOrder(id);
  const trackingToken = token || snapshot?.trackingToken;
  // Sent as a header so the token stays out of URLs and server logs.
  const order = await apiFetch<ApiOrderResponse>(`/api/orders/${encodeURIComponent(id)}`, {
    headers: trackingToken ? { 'X-Order-Token': trackingToken } : {},
  });
  const payment = order.payment;

  return {
    id: String(order.id),
    tableNumber: order.table_number ?? snapshot?.tableNumber ?? '',
    customerName: order.customer?.name ?? snapshot?.customerName ?? 'Guest',
    phone: order.customer?.phone_number ?? snapshot?.phone ?? '',
    items: (order.items ?? []).map((item) => ({
      id: String(item.menu_item_id),
      name: item.menu_item?.name ?? `Item #${item.menu_item_id}`,
      price: item.unit_price,
      quantity: item.quantity,
    })),
    subtotal: order.total_amount,
    total: order.total_amount,
    status: asTrackedStatus(order.status),
    paymentStatus: payment?.status === 'paid' || payment?.status === 'failed' ? payment.status : 'pending',
    paymentMethod: asPaymentMethod(payment?.method) ?? snapshot?.paymentMethod,
    momoNetwork: asMomoNetwork(payment?.network) ?? snapshot?.momoNetwork,
    paymentProvider: payment?.provider ?? snapshot?.paymentProvider,
    createdAt: order.created_at ?? snapshot?.createdAt ?? new Date().toISOString(),
    updatedAt: order.updated_at ?? snapshot?.updatedAt ?? new Date().toISOString(),
    notes: order.notes ?? snapshot?.notes,
    trackingToken,
  };
}

/**
 * Link to an order's live tracking page. The token rides in the #fragment so
 * the link survives reloads and can be shared, but browsers never send it to
 * any server (no access logs, no Referer).
 */
export function trackingPath(order: { id: string; trackingToken?: string }): string {
  return `/order/${order.id}${order.trackingToken ? `#t=${encodeURIComponent(order.trackingToken)}` : ''}`;
}

/** Read the tracking token from a tracking URL: "#t=…" (current) or "?t=…" (older links). */
export function readTrackingToken(search: string, hash: string): string | undefined {
  return new URLSearchParams(hash.replace(/^#/, '')).get('t') || new URLSearchParams(search).get('t') || undefined;
}

// ─── Guest's recent orders (this device only) ────────────────────
// Lets the tracking page render instantly and the menu link back to it.

const RECENT_ORDERS_STORAGE_KEY = 'star_experience_recent_orders';

export function getRecentOrders(): TrackedOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_ORDERS_STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function getRecentOrder(id: string): TrackedOrder | undefined {
  return getRecentOrders().find((o) => o.id === id);
}

export function saveRecentOrder(order: TrackedOrder): void {
  const others = getRecentOrders().filter((o) => o.id !== order.id);
  try {
    localStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify([order, ...others].slice(0, 5)));
  } catch {
    // Storage full or blocked: tracking still works from the link.
  }
}
