'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { MenuTable } from '@/components/admin/MenuTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MenuItem } from '@/types';
import {
  ApiError,
  deleteMenuItem,
  describeApiError,
  getAdminMenu,
  saveMenuItem,
  toggleItemAvailability,
} from '@/lib/api';

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setItems(await getAdminMenu());
    } catch (error) {
      setLoadError(describeApiError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadMenu);
  }, [loadMenu]);

  // Flip immediately so staff get instant feedback mid-service; undo if the save fails.
  const handleToggleAvailability = async (id: string, available: boolean) => {
    setActionError(null);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, available } : item)));
    try {
      const saved = await toggleItemAvailability(id, available);
      setItems((prev) => prev.map((item) => (item.id === id ? saved : item)));
    } catch (error) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, available: !available } : item)));
      setActionError(`Couldn’t update availability: ${describeApiError(error)}`);
    }
  };

  // Errors propagate to the edit form, which shows them next to the fields.
  const handleSaveItem = async (item: MenuItem, isNew: boolean) => {
    const saved = await saveMenuItem(item, isNew);
    setItems((prev) =>
      isNew ? [saved, ...prev] : prev.map((existing) => (existing.id === saved.id ? saved : existing))
    );
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item from the menu? To hide it for tonight, mark it Sold Out instead.')) return;
    setActionError(null);
    try {
      await deleteMenuItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setActionError(
        error instanceof ApiError && error.status === 409
          ? 'This item is part of past orders, so it can’t be deleted. Mark it Sold Out to hide it from guests.'
          : `Couldn’t delete the item: ${describeApiError(error)}`
      );
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
              Mark drinks or dishes Sold Out when they run out, or add new specials for Kwesi Dain&apos;s event.
            </p>
          </div>

          {actionError && (
            <div className="flex items-start gap-2 rounded-xl border border-star-red/40 bg-star-red/10 px-3 py-2.5 text-xs text-red-200" role="alert">
              <AlertTriangle className="w-4 h-4 text-star-red shrink-0" />
              <span className="flex-1">{actionError}</span>
              <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss" className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="py-24 flex justify-center">
              <LoadingSpinner size="lg" text="Loading menu…" />
            </div>
          ) : loadError ? (
            <div className="py-16 text-center">
              <p className="font-bold">The menu didn’t load</p>
              <p className="text-xs text-star-muted mt-1">{loadError}</p>
              <button
                type="button"
                onClick={loadMenu}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E1E1E] border border-[#333] text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : (
            <MenuTable
              items={items}
              onToggleAvailability={handleToggleAvailability}
              onSaveItem={handleSaveItem}
              onDeleteItem={handleDeleteItem}
            />
          )}
        </main>
      </div>
    </div>
  );
}
