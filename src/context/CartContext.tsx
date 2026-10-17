'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CartItem, CustomerInfo, MenuItem } from '@/types';

interface CartContextType {
  tableNumber: string;
  setTableNumber: (table: string) => void;
  customerInfo: CustomerInfo;
  setCustomerInfo: (info: CustomerInfo) => void;
  items: CartItem[];
  addItem: (item: MenuItem, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getItemQuantity: (itemId: string) => number;
  totalCount: number;
  subtotal: number;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  /**
   * Refresh cart lines from the latest menu (names, prices, photos) and drop
   * anything sold out or removed. Returns the names of dropped items.
   */
  syncWithMenu: (menu: MenuItem[]) => string[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_CART_KEY = 'star_experience_cart_items';
const STORAGE_CUSTOMER_KEY = 'star_experience_customer_info';
const STORAGE_TABLE_KEY = 'star_experience_table_number';
const STORAGE_NOTES_KEY = 'star_experience_order_notes';

function getInitialStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getInitialString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw || fallback;
  } catch {
    return fallback;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // No default table: an unknown table must be asked for, never guessed.
  const [tableNumber, setTableNumberState] = useState<string>(() =>
    getInitialString(STORAGE_TABLE_KEY, '')
  );

  const [customerInfo, setCustomerInfoState] = useState<CustomerInfo>(() =>
    getInitialStorage<CustomerInfo>(STORAGE_CUSTOMER_KEY, {
      name: '',
      phone: '',
      tableNumber: '',
    })
  );

  const [items, setItems] = useState<CartItem[]>(() =>
    getInitialStorage<CartItem[]>(STORAGE_CART_KEY, [])
  );

  const [orderNotes, setOrderNotesState] = useState<string>(() =>
    getInitialString(STORAGE_NOTES_KEY, '')
  );

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const setTableNumber = useCallback((table: string) => {
    setTableNumberState(table);
    setCustomerInfoState((prev) => ({ ...prev, tableNumber: table }));
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_TABLE_KEY, table);
    }
  }, []);

  const setCustomerInfo = useCallback((info: CustomerInfo) => {
    setCustomerInfoState(info);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CUSTOMER_KEY, JSON.stringify(info));
      if (info.tableNumber) {
        localStorage.setItem(STORAGE_TABLE_KEY, info.tableNumber.toString());
      }
    }
  }, []);

  const setOrderNotes = useCallback((notes: string) => {
    setOrderNotesState(notes);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_NOTES_KEY, notes);
    }
  }, []);

  const saveCartItems = (newItems: CartItem[]) => {
    setItems(newItems);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(newItems));
    }
  };

  const addItem = (item: MenuItem, quantity = 1) => {
    setItems((prev) => {
      const exists = prev.some((ci) => ci.item.id === item.id);
      const updated: CartItem[] = exists
        ? prev.map((ci) => (ci.item.id === item.id ? { ...ci, quantity: ci.quantity + quantity } : ci))
        : [...prev, { item, quantity }];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => {
      const updated = prev.filter((ci) => ci.item.id !== itemId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) => {
      const updated = prev.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity } : ci
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const clearCart = () => {
    saveCartItems([]);
    setOrderNotes('');
  };

  const syncWithMenu = useCallback(
    (menu: MenuItem[]): string[] => {
      const latest = new Map(menu.map((menuItem) => [menuItem.id, menuItem]));
      const dropped = items.filter((ci) => !latest.get(ci.item.id)?.available).map((ci) => ci.item.name);
      const synced = items
        .filter((ci) => latest.get(ci.item.id)?.available)
        .map((ci) => ({ ...ci, item: latest.get(ci.item.id) as MenuItem }));
      const changed =
        dropped.length > 0 || synced.some((ci, i) => JSON.stringify(ci.item) !== JSON.stringify(items[i].item));
      if (changed) {
        setItems(synced);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(synced));
        }
      }
      return dropped;
    },
    [items]
  );

  const getItemQuantity = (itemId: string): number => {
    const found = items.find((ci) => ci.item.id === itemId);
    return found ? found.quantity : 0;
  };

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        tableNumber,
        setTableNumber,
        customerInfo,
        setCustomerInfo,
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getItemQuantity,
        totalCount,
        subtotal,
        orderNotes,
        setOrderNotes,
        isDrawerOpen,
        setIsDrawerOpen,
        syncWithMenu,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
