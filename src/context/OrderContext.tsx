'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Order, OrderStatusType } from '@/types';
import {
  ApiError,
  SESSION_EXPIRED_EVENT,
  describeApiError,
  getOrders,
  hasExpiredAdminSession,
  hasValidAdminSession,
  updateOrderStatus,
} from '@/lib/api';

const POLL_INTERVAL_MS = 10000;

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

// One shared AudioContext for the new-order chime. Browsers start it suspended
// until the user interacts with the page, so it is resumed on the first tap.
let chimeContext: AudioContext | null = null;

function getChimeContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!chimeContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    chimeContext = new AudioContextClass();
  }
  return chimeContext;
}

function playChimeSound() {
  try {
    const ctx = getChimeContext();
    if (!ctx || ctx.state !== 'running') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (err) {
    console.debug('Web Audio chime could not play automatically:', err);
  }
}

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
        playChimeSound();
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

  useEffect(() => {
    if (!isStaffPage(pathname)) return;
    void Promise.resolve().then(refreshOrders);
    const refreshInterval = window.setInterval(() => void refreshOrders(), POLL_INTERVAL_MS);
    return () => window.clearInterval(refreshInterval);
  }, [pathname, refreshOrders]);

  const enableSound = useCallback(() => {
    const ctx = getChimeContext();
    if (!ctx) return;
    ctx
      .resume()
      .then(() => setSoundEnabled(ctx.state === 'running'))
      .catch(() => setSoundEnabled(false));
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
