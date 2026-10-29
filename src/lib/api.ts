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
 * Staff (bearer token: admins via /api/auth/token, others via PIN at /api/auth/pin;
 * the PIN screen only works on a device approved through /api/auth/devices/pair)
 * - GET   /api/admin/orders, /api/admin/floor   Live order board, floor overview
 * - PATCH /api/admin/orders/{id}/status         Admin override of an order's stage
 * - PUT   /api/admin/tables/{id}/waiter         Table assignment (orders route to the table's waiter)
 * - GET/POST/PATCH /api/admin/staff             Staff accounts
 * - GET/POST/DELETE /api/admin/devices          Phones and tablets approved for staff sign-in
 * - GET/POST/PATCH/DELETE /api/admin/menu/items Menu management
 * - GET   /api/staff/waiter/board               Waiter's tables and orders (accept, served)
 * - GET   /api/staff/station/{kitchen|bar}/...  Kitchen and bar tickets
 * - POST  /api/staff/push                       Alerts on a locked phone (Web Push)
 * - GET   /api/staff/events                     Live updates (Server-Sent Events)
 *
 * Response types mirror the backend's schemas; see the API types in src/types.
 */

import {
  ActivityEntry,
  DevicePairing,
  FloorView,
  StaffDeviceInfo,
  LiveEvent,
  MenuItem,
  Order,
  StaffMember,
  StaffOrder,
  StaffPickerEntry,
  StaffProfile,
  StaffRoleName,
  StationName,
  WaiterBoard,
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

// Unset, requests go to the hosted backend on Render, so set NEXT_PUBLIC_API_URL
// (e.g. http://localhost:8000) in .env.local when running the backend locally.
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
// One signed-in staff member per device: admin (password) or waiter/kitchen/bar (PIN).

export interface StaffSession {
  token: string;
  role: StaffRoleName;
  name: string;
  id?: number;
}

const SESSION_STORAGE_KEY = 'star_experience_staff_session';
// Older builds kept a bare admin token here; those tokens were signed with a since-rotated key.
const LEGACY_ADMIN_TOKEN_KEY = 'star_experience_admin_token';
/** Fired on window when a staff request comes back 401 and the session is cleared. */
export const SESSION_EXPIRED_EVENT = 'star_experience_session_expired';

const STAFF_ROLES: StaffRoleName[] = ['admin', 'waiter', 'kitchen', 'bar'];

export function getSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  try {
    localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
    const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    if (stored && typeof stored.token === 'string' && STAFF_ROLES.includes(stored.role)) return stored;
  } catch {
    // Unreadable session: treat as signed out.
  }
  return null;
}

function saveSession(session: StaffSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export const clearAdminSession = clearSession;

function readSessionToken(): string | null {
  return getSession()?.token ?? null;
}

function tokenIsUnexpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/** True when someone is signed in (optionally with one of these roles) and their token hasn't expired. */
export function hasValidSession(roles?: StaffRoleName[]): boolean {
  const session = getSession();
  return Boolean(session && tokenIsUnexpired(session.token) && (!roles || roles.includes(session.role)));
}

export function hasValidAdminSession(): boolean {
  return hasValidSession(['admin']);
}

/** True when someone was signed in but their token has since expired (vs never signed in / signed out). */
export function hasExpiredSession(): boolean {
  const session = getSession();
  return Boolean(session && !tokenIsUnexpired(session.token));
}

export const hasExpiredAdminSession = hasExpiredSession;

/** Where each role works. */
export function homeForRole(role: StaffRoleName): string {
  return role === 'admin' ? '/admin/dashboard' : `/staff/${role}`;
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
  saveSession({ token: token.access_token, role: 'admin', name: username });
}

// ─── Approved staff device ───────────────────────────────────────
// Staff sign-in only works on phones and tablets an admin has set up with a
// one-time code. The device token lives here, apart from (and outliving) sign-ins.

export interface StaffDeviceIdentity {
  token: string;
  name: string;
  id?: number;
}

const DEVICE_STORAGE_KEY = 'star_experience_staff_device';

export function getStaffDevice(): StaffDeviceIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(localStorage.getItem(DEVICE_STORAGE_KEY) || 'null');
    return stored && typeof stored.token === 'string' ? stored : null;
  } catch {
    return null;
  }
}

function saveStaffDevice(device: StaffDeviceIdentity): void {
  localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(device));
}

export function forgetStaffDevice(): void {
  try {
    localStorage.removeItem(DEVICE_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing to forget.
  }
}

function deviceHeaders(): Record<string, string> {
  const device = getStaffDevice();
  return device ? { 'X-Staff-Device': device.token } : {};
}

/** True for the 403 the server sends to devices that aren't (or are no longer) approved. */
export function isUnapprovedDevice(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** Set up this browser for staff sign-in with the code an admin created. */
export async function pairStaffDevice(code: string): Promise<StaffDeviceIdentity> {
  const result = await apiFetch<{ device_token: string; name: string; id: number }>('/api/auth/devices/pair', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  const device = { token: result.device_token, name: result.name, id: result.id };
  saveStaffDevice(device);
  return device;
}

/** Names on the staff sign-in screen (staff tap theirs, then enter their PIN). */
export async function getStaffPicker(): Promise<StaffPickerEntry[]> {
  try {
    return await apiFetch<StaffPickerEntry[]>('/api/auth/staff', { headers: deviceHeaders() });
  } catch (error) {
    if (isUnapprovedDevice(error)) forgetStaffDevice(); // revoked: set it up again
    throw error;
  }
}

/** Sign in with a 4-digit PIN. Signing in also starts the person's shift. */
export async function loginWithPin(staffId: number, pin: string): Promise<StaffSession> {
  const result = await apiFetch<{ access_token: string; user: StaffProfile }>('/api/auth/pin', {
    method: 'POST',
    body: JSON.stringify({ staff_id: staffId, pin }),
    headers: deviceHeaders(),
  });
  const session: StaffSession = {
    token: result.access_token,
    role: result.user.role,
    name: result.user.display_name,
    id: result.user.id,
  };
  saveSession(session);
  return session;
}

// ─── Transport ───────────────────────────────────────────────────

function isStaffEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/api/admin') || endpoint.startsWith('/api/staff') || endpoint === '/api/auth/me';
}

/** Fetch JSON from the backend with a timeout and consistent errors. 204 resolves to undefined. */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const isStaffRequest = isStaffEndpoint(endpoint);
  const adminToken = isStaffRequest ? readSessionToken() : null;
  // Signed out (e.g. a refresh that lands just after "Sign out"): don't ask the server,
  // and don't report it as an expired session.
  if (isStaffRequest && !adminToken) throw new ApiError('Not signed in', 401);
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
        clearSession();
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
  return method === 'momo' || method === 'card' ? method : undefined;
}

function asMomoNetwork(network: string | null | undefined): MomoNetwork | undefined {
  return network === 'mtn' || network === 'telecel' || network === 'at' ? network : undefined;
}

function mapAdminOrder(order: ApiAdminOrderResponse): Order {
  return {
    id: String(order.id),
    tableNumber: order.table_number,
    waiterName: order.waiter_name ?? undefined,
    acceptedAt: order.accepted_at ?? undefined,
    kitchenStatus: order.kitchen_status ?? undefined,
    barStatus: order.bar_status ?? undefined,
    customerName: order.customer_name,
    phone: order.customer_phone,
    items: order.items,
    subtotal: order.subtotal,
    total: order.total,
    status: asOrderStatus(order.status),
    paymentStatus: order.payment_status === 'paid' || order.payment_status === 'failed' ? order.payment_status : 'pending',
    paymentMethod: asPaymentMethod(order.payment_method),
    momoNetwork: asMomoNetwork(order.momo_network),
    paymentProvider: order.payment_provider ?? undefined,
    createdAt: order.created_at ?? new Date(0).toISOString(),
    updatedAt: order.updated_at ?? new Date(0).toISOString(),
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
  method: PaymentMethodType,
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
    waiterName: order.waiter_name ?? undefined,
    customerName: order.customer?.name ?? snapshot?.customerName ?? 'Guest',
    phone: order.customer?.phone_number ?? snapshot?.phone ?? '',
    items: order.items.map((item) => ({
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

// ─── Staff: profile, waiter, kitchen & bar ───────────────────────

export function getMe(): Promise<StaffProfile> {
  return apiFetch<StaffProfile>('/api/staff/me');
}

export function setMyShift(shift_status: StaffProfile['shift_status']): Promise<StaffProfile> {
  return apiFetch<StaffProfile>('/api/staff/me/shift', { method: 'PUT', body: JSON.stringify({ shift_status }) });
}

/** End the shift and sign out (best effort: the session is cleared even if the server can't be reached). */
export async function signOutStaff(): Promise<void> {
  if (getSession()?.role !== 'admin') {
    await setMyShift('off').catch(() => undefined);
  }
  clearSession();
}

export function getWaiterBoard(): Promise<WaiterBoard> {
  return apiFetch<WaiterBoard>('/api/staff/waiter/board');
}

export function acceptOrder(orderId: number): Promise<StaffOrder> {
  return apiFetch<StaffOrder>(`/api/staff/orders/${orderId}/accept`, { method: 'POST' });
}

export function serveOrder(orderId: number): Promise<StaffOrder> {
  return apiFetch<StaffOrder>(`/api/staff/orders/${orderId}/served`, { method: 'POST' });
}

export function getStationTickets(station: StationName): Promise<StaffOrder[]> {
  return apiFetch<StaffOrder[]>(`/api/staff/station/${station}/tickets`);
}

export function updateStation(station: StationName, orderId: number, status: 'preparing' | 'ready'): Promise<StaffOrder> {
  return apiFetch<StaffOrder>(`/api/staff/station/${station}/orders/${orderId}`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

// ─── Admin: staff accounts & floor ───────────────────────────────

export function getStaffList(): Promise<StaffMember[]> {
  return apiFetch<StaffMember[]>('/api/admin/staff');
}

export function createStaff(body: { display_name: string; role: 'waiter' | 'kitchen' | 'bar'; pin: string }): Promise<StaffMember> {
  return apiFetch<StaffMember>('/api/admin/staff', { method: 'POST', body: JSON.stringify(body) });
}

export function updateStaff(
  staffId: number,
  changes: Partial<{
    display_name: string;
    role: 'waiter' | 'kitchen' | 'bar';
    pin: string;
    is_active: boolean;
    shift_status: StaffProfile['shift_status'];
    unlock: boolean;
  }>
): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/admin/staff/${staffId}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

/** Shift change: move a waiter's tables and open orders to another waiter (or unassign with null). */
export function handoverStaff(staffId: number, toStaffId: number | null): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/admin/staff/${staffId}/handover`, {
    method: 'POST',
    body: JSON.stringify({ to_staff_id: toStaffId }),
  });
}

export function getFloor(): Promise<FloorView> {
  return apiFetch<FloorView>('/api/admin/floor');
}

export function assignTable(tableId: number, waiterId: number | null, moveOpenOrders = true) {
  return apiFetch<{ moved_orders: number[] }>(`/api/admin/tables/${tableId}/waiter`, {
    method: 'PUT',
    body: JSON.stringify({ waiter_id: waiterId, move_open_orders: moveOpenOrders }),
  });
}

export function assignOrder(orderId: number, waiterId: number | null): Promise<StaffOrder> {
  return apiFetch<StaffOrder>(`/api/admin/orders/${orderId}/waiter`, {
    method: 'PUT',
    body: JSON.stringify({ waiter_id: waiterId }),
  });
}

export function getDevices(): Promise<StaffDeviceInfo[]> {
  return apiFetch<StaffDeviceInfo[]>('/api/admin/devices');
}

/** Approve a new phone or tablet; returns the one-time code to enter on it. */
export function addDevice(name: string): Promise<DevicePairing> {
  return apiFetch<DevicePairing>('/api/admin/devices', { method: 'POST', body: JSON.stringify({ name }) });
}

export function newDeviceCode(deviceId: number): Promise<DevicePairing> {
  return apiFetch<DevicePairing>(`/api/admin/devices/${deviceId}/code`, { method: 'POST' });
}

/** Revoke a device: anyone signed in on it is signed out and it stops getting alerts. */
export function removeDevice(deviceId: number): Promise<void> {
  return apiFetch<void>(`/api/admin/devices/${deviceId}`, { method: 'DELETE' });
}

/** Admin shortcut: approve the browser they're using right now (e.g. the bar tablet). */
export async function approveThisDevice(name: string): Promise<StaffDeviceIdentity> {
  const pairing = await addDevice(name);
  return pairStaffDevice(pairing.code);
}

// ─── Push alerts ─────────────────────────────────────────────────

export async function getPushKey(): Promise<string | null> {
  return (await apiFetch<{ public_key: string | null }>('/api/staff/push/key')).public_key;
}

export function savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  return apiFetch<void>('/api/staff/push', { method: 'POST', body: JSON.stringify(subscription) });
}

export function deletePushSubscription(endpoint: string): Promise<void> {
  return apiFetch<void>('/api/staff/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
}

export function getOrderActivity(orderId: string): Promise<ActivityEntry[]> {
  return apiFetch<ActivityEntry[]>(`/api/admin/orders/${encodeURIComponent(orderId)}/activity`);
}

// ─── Live updates ────────────────────────────────────────────────

/**
 * Read the staff event stream until the server closes it (about once a minute)
 * or `signal` aborts. Uses fetch rather than EventSource so the token travels in
 * a header, not the URL. Rejects on network/auth errors so callers can back off.
 */
export async function streamStaffEvents(signal: AbortSignal, onEvent: (event: LiveEvent) => void): Promise<void> {
  const token = readSessionToken();
  if (!token) throw new ApiError('Not signed in', 401);
  const response = await fetch(`${API_BASE_URL}/api/staff/events`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    signal,
    cache: 'no-store',
  });
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  if (!response.ok || !response.body) throw new ApiError(`Event stream failed (${response.status})`, response.status);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (data) {
        try {
          onEvent(JSON.parse(data) as LiveEvent);
        } catch {
          // Ignore malformed events; screens also refresh on a timer.
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}
