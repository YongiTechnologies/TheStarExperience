/**
 * API Abstraction Layer for The Star Experience
 *
 * This module provides a centralized API client for communicating with the FastAPI backend.
 * The backend URL is configured via NEXT_PUBLIC_API_URL environment variable.
 *
 * Connected endpoints:
 * - GET  /api/menu             -> Fetch active menu (from FastAPI)
 * - GET  /api/menu/categories  -> Fetch menu categories (from FastAPI)
 * - GET  /api/tables/{id}      -> Fetch table info (from FastAPI)
 *
 * Still using localStorage (to be connected later):
 * - POST   /api/orders                 -> Create new order (Customer)
 * - GET    /api/orders                 -> List orders (Admin)
 * - GET    /api/orders/{id}            -> Fetch specific order tracking details
 * - PATCH  /api/orders/{id}/status     -> Update order status (Admin)
 * - POST   /api/payments/initialize    -> Initialize Paystack / Hubtel transaction
 * - POST   /api/payments/webhook       -> Webhook for payment verification
 */

import {
  MenuItem,
  Order,
  OrderStatusType,
  ApiMenuItemResponse,
  ApiMenuCategoryResponse,
  ApiTableResponse,
  ApiAdminOrderResponse,
  ApiOrderResponse,
} from '@/types';
import { INITIAL_MENU } from '@/data/menu';
import { INITIAL_ORDERS } from '@/data/orders';

// ─── Centralized API Configuration ──────────────────────────────────
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://backend-thestarexperience-ip37.onrender.com' || 'http://localhost:8000'
).replace(/\/$/, '');
const ADMIN_TOKEN_STORAGE_KEY = 'star_experience_admin_token';

function getAdminAuthorizationHeader(): HeadersInit {
  if (typeof window === 'undefined') return {};

  const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Centralized fetch wrapper for all FastAPI calls.
 * Adds consistent error handling, timeouts, and JSON parsing.
 */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthorizationHeader(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new ApiError(
        `API error ${response.status}: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out. The server may be unavailable.', 0);
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Network error — could not reach the server.',
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Custom error class for API failures, includes HTTP status code.
 */
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

// ─── Badge & prep time defaults (not stored in backend yet) ──────
// Maps menu item names to their display badges and prep times from the original mock data.
const ITEM_METADATA: Record<string, { badge?: string; prepTimeMinutes?: number }> = {};
INITIAL_MENU.forEach((item) => {
  ITEM_METADATA[item.name] = {
    badge: item.badge,
    prepTimeMinutes: item.prepTimeMinutes,
  };
});

// ─── Category ID → name mapping cache ────────────────────────────
let categoryMapCache: Record<number, string> | null = null;

async function getCategoryMap(): Promise<Record<number, string>> {
  if (categoryMapCache) return categoryMapCache;

  const categories = await apiFetch<ApiMenuCategoryResponse[]>('/api/menu/categories');
  const map: Record<number, string> = {};
  for (const cat of categories) {
    map[cat.id] = cat.name;
  }
  categoryMapCache = map;
  return map;
}

/**
 * Convert backend MenuItemResponse → frontend MenuItem type
 */
function mapApiMenuItem(
  apiItem: ApiMenuItemResponse,
  categoryMap: Record<number, string>
): MenuItem {
  const categoryName = categoryMap[apiItem.category_id] || 'food';
  const meta = ITEM_METADATA[apiItem.name] || {};

  return {
    id: String(apiItem.id),
    name: apiItem.name,
    description: apiItem.description || '',
    price: apiItem.price,
    category: categoryName as MenuItem['category'],
    available: apiItem.is_available,
    badge: meta.badge,
    prepTimeMinutes: meta.prepTimeMinutes,
  };
}

// ─── Connected API Functions ─────────────────────────────────────

/**
 * Fetch all menu items from the FastAPI backend.
 * Maps backend schema to frontend MenuItem type.
 */
export async function getMenu(): Promise<MenuItem[]> {
  const [apiItems, categoryMap] = await Promise.all([
    apiFetch<ApiMenuItemResponse[]>('/api/menu'),
    getCategoryMap(),
  ]);

  return apiItems.map((item) => mapApiMenuItem(item, categoryMap));
}

/** Authenticate a bar-admin user and persist the access token for admin API calls. */
export async function loginAdmin(username: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username, password });
  const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new ApiError('Invalid staff email or password.', response.status, await response.text());
  }

  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new ApiError('The backend did not return an access token.', 0);
  }

  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token.access_token);
}

/**
 * Fetch menu inventory for the admin area.
 * The backend currently exposes its menu list as public GET routes; its admin
 * menu routes are POST-only creation endpoints.
 */
export async function getAdminMenu(): Promise<MenuItem[]> {
  return getMenu();
}

function asOrderStatus(status: string | undefined): OrderStatusType {
  return status === 'preparing' || status === 'ready' || status === 'completed' ? status : 'received';
}

function mapAdminOrder(order: ApiAdminOrderResponse): Order {
  const items = order.items || order.order_items || [];
  const total = order.total ?? order.total_amount ?? 0;

  return {
    id: String(order.id),
    tableNumber: order.table_number ?? order.tableNumber ?? '',
    customerName: order.customer_name ?? order.customerName ?? 'Guest',
    phone: order.customer_phone ?? order.phone ?? '',
    items,
    subtotal: order.subtotal ?? total,
    total,
    status: asOrderStatus(order.status),
    paymentStatus: order.payment_status === 'paid' || order.paymentStatus === 'paid' ? 'paid' : 'pending',
    paymentMethod: order.payment_method === 'card' || order.paymentMethod === 'card' || order.payment_method === 'cash' || order.paymentMethod === 'cash' ? (order.payment_method ?? order.paymentMethod) as 'card' | 'cash' : 'momo',
    createdAt: order.created_at ?? order.createdAt ?? new Date(0).toISOString(),
    updatedAt: order.updated_at ?? order.updatedAt ?? new Date(0).toISOString(),
    notes: order.notes,
  };
}

/**
 * Fetch table information from the FastAPI backend.
 * Returns null if the table is not found (404).
 */
export async function getTable(tableId: string | number): Promise<ApiTableResponse | null> {
  try {
    return await apiFetch<ApiTableResponse>(`/api/tables/${tableId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// ─── localStorage-based functions (to be connected to backend later) ─

const MENU_STORAGE_KEY = 'star_experience_menu';
const ORDERS_STORAGE_KEY = 'star_experience_orders';

// Helper to access localStorage safely in SSR
function getStoredData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setStoredData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    // Dispatch custom event for cross-component sync in same tab
    window.dispatchEvent(new Event(`storage_${key}`));
  } catch (err) {
    console.error(`Failed saving to localStorage ${key}:`, err);
  }
}

/**
 * Save or update a menu item
 * // TODO: Replace with POST/PUT `${API_BASE_URL}/api/menu`
 */
export async function saveMenuItem(item: MenuItem): Promise<MenuItem> {
  if (item.id.startsWith('custom-')) {
    const categoryMap = await getCategoryMap();
    const normalizedCategory = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const categoryId = Object.entries(categoryMap).find(
      ([, name]) => normalizedCategory(name) === normalizedCategory(item.category)
    )?.[0];

    if (!categoryId) {
      throw new ApiError(`No backend category matches “${item.category}”.`, 422);
    }

    const createdItem = await apiFetch<ApiMenuItemResponse>('/api/admin/menu/items', {
      method: 'POST',
      body: JSON.stringify({
        name: item.name,
        description: item.description || null,
        price: item.price,
        is_available: item.available,
        category_id: Number(categoryId),
      }),
    });

    return mapApiMenuItem(createdItem, categoryMap);
  }

  // The backend currently provides a create route only; do not present a local edit as persisted.
  throw new ApiError('Editing existing menu items is not available from the backend yet.', 405);

  /*
  const current = getStoredData<MenuItem[]>(MENU_STORAGE_KEY, INITIAL_MENU);
  const exists = current.some((i) => i.id === item.id);
  const updated = exists
    ? current.map((i) => (i.id === item.id ? item : i))
    : [item, ...current];
  setStoredData(MENU_STORAGE_KEY, updated);
  return item;
  */
}

/**
 * Toggle menu item availability
 * // TODO: Replace with PATCH `${API_BASE_URL}/api/menu/{id}/availability`
 */
export async function toggleItemAvailability(id: string, available: boolean): Promise<MenuItem | null> {
  throw new ApiError('Updating menu availability is not available from the backend yet.', 405);

  /*
  const current = getStoredData<MenuItem[]>(MENU_STORAGE_KEY, INITIAL_MENU);
  let updatedItem: MenuItem | null = null;
  const updated = current.map((item) => {
    if (item.id === id) {
      updatedItem = { ...item, available };
      return updatedItem;
    }
    return item;
  });
  setStoredData(MENU_STORAGE_KEY, updated);
  return updatedItem;
  */
}

/**
 * Delete a menu item
 * // TODO: Replace with DELETE `${API_BASE_URL}/api/menu/{id}`
 */
export async function deleteMenuItem(id: string): Promise<boolean> {
  throw new ApiError('Deleting menu items is not available from the backend yet.', 405);

  /*
  const current = getStoredData<MenuItem[]>(MENU_STORAGE_KEY, INITIAL_MENU);
  const updated = current.filter((item) => item.id !== id);
  setStoredData(MENU_STORAGE_KEY, updated);
  return true;
  */
}

/**
 * Fetch all orders for the bar-admin dashboard.
 */
export async function getOrders(): Promise<Order[]> {
  const orders = await apiFetch<ApiAdminOrderResponse[]>('/api/admin/orders');
  return orders.map(mapAdminOrder);
}

/**
 * Get single order by ID
 * // TODO: Replace with fetch(`${API_BASE_URL}/api/orders/{id}`)
 */
export async function getOrder(id: string): Promise<Order | null> {
  const orders = getStoredData<Order[]>(ORDERS_STORAGE_KEY, INITIAL_ORDERS);
  return orders.find((o) => o.id.toLowerCase() === id.toLowerCase()) || null;
}

/**
 * Create a new customer order
 * // TODO: Replace with POST `${API_BASE_URL}/api/orders`
 */
export async function createOrder(orderData: Omit<Order, 'createdAt' | 'updatedAt'>): Promise<Order> {
  const tableId = Number(orderData.tableNumber);
  if (!Number.isInteger(tableId)) {
    throw new ApiError('A valid table ID is required to place an order.', 422);
  }

  const items = orderData.items.map((item) => ({
    menu_item_id: Number(item.id),
    quantity: item.quantity,
  }));

  if (items.some((item) => !Number.isInteger(item.menu_item_id))) {
    throw new ApiError('Orders can only contain menu items loaded from the backend.', 422);
  }

  const createdOrder = await apiFetch<ApiOrderResponse>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      table_id: tableId,
      customer_name: orderData.customerName,
      customer_phone: orderData.phone,
      items,
    }),
  });

  return {
    ...orderData,
    id: String(createdOrder.id),
    total: createdOrder.total_amount,
    subtotal: createdOrder.total_amount,
    status: asOrderStatus(createdOrder.status),
    createdAt: createdOrder.created_at ?? new Date().toISOString(),
    updatedAt: createdOrder.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Update an order's status
 * // TODO: Replace with PATCH `${API_BASE_URL}/api/orders/{id}/status`
 */
export async function updateOrderStatus(id: string, status: OrderStatusType): Promise<Order | null> {
  const updatedOrder = await apiFetch<ApiAdminOrderResponse>(`/api/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  return mapAdminOrder(updatedOrder);
}
