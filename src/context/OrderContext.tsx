'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Order, OrderStatusType } from '@/types';
import { playChime, unlockSound } from '@/lib/sound';
import { useLiveUpdates } from '@/lib/useLiveUpdates';
import {
  ApiError,
  SESSION_EXPIRED_EVENT,
  describeApiError,
  getOrders,
  hasExpiredAdminSession,
  hasValidAdminSession,
  updateOrderStatus,
} from '@/lib/api';

// Live updates push changes instantly; polling is the safety net (faster while disconnected).
const POLL_INTERVAL_MS = 10000;
const POLL_INTERVAL_LIVE_MS = 30000;

interface OrderContextType {
  orders: Order[];
  /** True once the staff order list has been fetched at least once. */
  ordersLoaded: boolean;
  refreshOrders: () => Promise<void>;
  /** Move an order to a new status; returns false (and sets actionError) on failure. */
  changeOrderStatus: (id: string, status: OrderStatusType) => Promise<boolean>;
  hasNewOrderAlert: boolean;
  dismissNewOrderAlert: () => void;
  /** Last failed staff action or refresh, shown to staff until dismissed. */
  actionError: string | null;
  dismissActionError: () => void;
  /** Browsers keep audio muted until someone interacts with the page. */
  soundEnabled: boolean;
  enableSound: () => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

function isStaffPage(pathname: string) {
  return pathname.startsWith('/admin') && pathname !== '/admin/login';
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState<boolean>(false);
  const [hasNewOrderAlert, setHasNewOrderAlert] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  // Order IDs from the previous refresh; null until the first load so the
  // initial board doesn't chime for orders that were already there.
  const knownOrderIds = useRef<Set<string> | null>(null);

  // Depends on pathname: the provider lives in the root layout and survives the
  // client-side jump from /admin/login to the dashboard, so a stale path here
  // would stop orders loading after sign-in.
  const refreshOrders = useCallback(async () => {
    if (!isStaffPage(pathname)) return;
    if (!hasValidAdminSession()) {
      // The token ran out while the board was open: hand over to AdminGuard,
      // which sends staff to sign in again instead of leaving a frozen board.
      if (hasExpiredAdminSession()) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      return;
    }

    try {
      const data = await getOrders();
      const previous = knownOrderIds.current;
      if (previous && data.some((order) => !previous.has(order.id))) {
        setHasNewOrderAlert(true);
        playChime();
      }
      knownOrderIds.current = new Set(data.map((order) => order.id));
      setOrders(data);
      setOrdersLoaded(true);
    } catch (err) {
      // An expired session is handled by AdminGuard, which sends staff to sign in.
      if (err instanceof ApiError && err.status === 401) return;
      setActionError(`Couldn’t refresh orders: ${describeApiError(err)}`);
    }
  }, [pathname]);

  // Coalesce bursts of live events (e.g. kitchen and bar finishing together) into one refresh.
  const refreshTimer = useRef<number | undefined>(undefined);
  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => void refreshOrders(), 250);
  }, [refreshOrders]);

  const live = useLiveUpdates(scheduleRefresh, isStaffPage(pathname) && hasValidAdminSession());

  useEffect(() => {
    if (!isStaffPage(pathname)) return;
    void Promise.resolve().then(refreshOrders);
    const refreshInterval = window.setInterval(() => void refreshOrders(), live ? POLL_INTERVAL_LIVE_MS : POLL_INTERVAL_MS);
    return () => window.clearInterval(refreshInterval);
  }, [pathname, refreshOrders, live]);

  const enableSound = useCallback(() => {
    void unlockSound().then(setSoundEnabled);
  }, []);

  // Any tap or key press on a staff page unlocks the chime.
  useEffect(() => {
    if (!isStaffPage(pathname) || soundEnabled) return;
    window.addEventListener('pointerdown', enableSound);
    window.addEventListener('keydown', enableSound);
    return () => {
      window.removeEventListener('pointerdown', enableSound);
      window.removeEventListener('keydown', enableSound);
    };
  }, [pathname, soundEnabled, enableSound]);

  const changeOrderStatus = useCallback(
    async (id: string, status: OrderStatusType): Promise<boolean> => {
      try {
        const updated = await updateOrderStatus(id, status);
        setOrders((current) => current.map((order) => (order.id === id ? updated : order)));
        return true;
      } catch (err) {
        setActionError(`Couldn’t update order #${id}: ${describeApiError(err)}`);
        return false;
      }
    },
    []
  );

  return (
    <OrderContext.Provider
      value={{
        orders,
        ordersLoaded,
        refreshOrders,
        changeOrderStatus,
        hasNewOrderAlert,
        dismissNewOrderAlert: () => setHasNewOrderAlert(false),
        actionError,
        dismissActionError: () => setActionError(null),
        soundEnabled,
        enableSound,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
}
