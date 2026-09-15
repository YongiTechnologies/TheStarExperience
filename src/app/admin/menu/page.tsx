'use client';

import React, { useState, useEffect } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { MenuTable } from '@/components/admin/MenuTable';
import { MenuItem } from '@/types';
import { getAdminMenu, saveMenuItem, deleteMenuItem, toggleItemAvailability } from '@/lib/api';

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    const loadMenu = () => {
      getAdminMenu().then(setItems).catch((error) => {
        console.error('Failed fetching admin menu:', error);
      });
    };

    loadMenu();

    window.addEventListener('storage_star_experience_menu', loadMenu);
    window.addEventListener('storage', loadMenu);

    return () => {
      window.removeEventListener('storage_star_experience_menu', loadMenu);
      window.removeEventListener('storage', loadMenu);
    };
  }, []);

  const handleToggleAvailability = async (id: string, available: boolean) => {
    await toggleItemAvailability(id, available);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, available } : item))
    );
  };

  const handleSaveItem = async (item: MenuItem) => {
    const savedItem = await saveMenuItem(item);
    setItems((previous) => [savedItem, ...previous.filter((existing) => existing.id !== savedItem.id)]);
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to remove this item from tonight’s menu?')) {
      await deleteMenuItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <AdminHeader />

      <div className="flex-1 flex flex-col md:flex-row">
        <AdminSidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-star-gold">
              INVENTORY & BAR MANAGEMENT
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              EVENT MENU MANAGEMENT
            </h1>
            <p className="text-xs text-star-muted mt-1">
              Toggle availability when drinks or dishes run out, or add new specials for Kwesi Dain&apos;s event.
            </p>
          </div>

          <MenuTable
            items={items}
            onToggleAvailability={handleToggleAvailability}
            onSaveItem={handleSaveItem}
            onDeleteItem={handleDeleteItem}
          />
        </main>
      </div>
    </div>
  );
}
