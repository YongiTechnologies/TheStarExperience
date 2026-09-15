'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Order, OrderStatusType } from '@/types';
import { getOrders, createOrder, updateOrderStatus } from '@/lib/api';

interface OrderContextType {
  orders: Order[];
  refreshOrders: () => Promise<void>;
  placeNewOrder: (orderData: Omit<Order, 'createdAt' | 'updatedAt'>) => Promise<Order>;
  changeOrderStatus: (id: string, status: OrderStatusType) => Promise<Order | null>;
  getOrderById: (id: string) => Order | undefined;
  hasNewOrderAlert: boolean;
  dismissNewOrderAlert: () => void;
  simulateIncomingOrder: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

function playChimeSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
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

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasNewOrderAlert, setHasNewOrderAlert] = useState<boolean>(false);

  const refreshOrders = useCallback(async () => {
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed fetching orders:', err);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refreshOrders);
    const refreshInterval = window.setInterval(() => {
      void refreshOrders();
    }, 10000);

    // Listen to custom cross-component storage events in same tab
    const handleStorageChange = () => {
      refreshOrders();
    };

    // Listen to browser storage events across different tabs
    const handleWindowStorage = (e: StorageEvent) => {
      if (e.key === 'star_experience_orders') {
        refreshOrders();
        setHasNewOrderAlert(true);
        playChimeSound();
      }
    };

    window.addEventListener('storage_star_experience_orders', handleStorageChange);
    window.addEventListener('storage', handleWindowStorage);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('storage_star_experience_orders', handleStorageChange);
      window.removeEventListener('storage', handleWindowStorage);
    };
  }, [refreshOrders]);

  const placeNewOrder = async (
    orderData: Omit<Order, 'createdAt' | 'updatedAt'>
  ): Promise<Order> => {
    const newOrder = await createOrder(orderData);
    await refreshOrders();
    setHasNewOrderAlert(true);
    playChimeSound();
    return newOrder;
  };

  const changeOrderStatus = async (
    id: string,
    status: OrderStatusType
  ): Promise<Order | null> => {
    const updated = await updateOrderStatus(id, status);
    await refreshOrders();
    return updated;
  };

  const getOrderById = (id: string): Order | undefined => {
    return orders.find((o) => o.id.toLowerCase() === id.toLowerCase());
  };

  const dismissNewOrderAlert = () => {
    setHasNewOrderAlert(false);
  };

  const simulateIncomingOrder = async () => {
    const randomTables = [3, 8, 12, 14, 21, 9];
    const randomNames = ['Kweku Baah', 'Efua Darko', 'Sena Mensah', 'Yaw Osei', 'Naa Koshie'];
    const randomTable = randomTables[Math.floor(Math.random() * randomTables.length)];
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
    const orderId = Math.floor(1050 + Math.random() * 8900).toString();

    await placeNewOrder({
      id: orderId,
      tableNumber: randomTable,
      customerName: randomName,
      phone: '024' + Math.floor(1000000 + Math.random() * 9000000),
      items: [
        { id: 'beer-001', name: 'Club Beer (Large)', price: 25, quantity: 2 },
        { id: 'food-007', name: 'Beef Suya Skewers', price: 55, quantity: 1 },
      ],
      subtotal: 105,
      total: 105,
      status: 'received',
      paymentStatus: 'paid',
      paymentMethod: 'momo',
      momoNetwork: 'mtn',
      notes: 'Please bring bottle opener',
    });
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        refreshOrders,
        placeNewOrder,
        changeOrderStatus,
        getOrderById,
        hasNewOrderAlert,
        dismissNewOrderAlert,
        simulateIncomingOrder,
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
