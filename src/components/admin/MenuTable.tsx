'use client';

import React, { useState } from 'react';
import { ItemCategory, MenuItem } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { describeApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Search } from 'lucide-react';

interface MenuTableProps {
  items: MenuItem[];
  onToggleAvailability: (id: string, available: boolean) => void;
  onSaveItem: (item: MenuItem, isNew: boolean) => Promise<void>;
  onDeleteItem: (id: string) => void;
}

export function MenuTable({
  items,
  onToggleAvailability,
  onSaveItem,
  onDeleteItem,
}: MenuTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState<Exclude<ItemCategory, 'all' | 'drinks'>>('food');
  const [formAvailable, setFormAvailable] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormDesc('');
    setFormPrice('');
    setFormCategory('food');
    setFormAvailable(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDesc(item.description);
    setFormPrice(item.price.toString());
    setFormCategory(item.category);
    setFormAvailable(item.available);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const parsedPrice = parseFloat(formPrice);
    if (!formName.trim()) {
      setFormError('Enter a name for the item.');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError('Enter a price above zero.');
      return;
    }

    const itemToSave: MenuItem = {
      id: editingItem ? editingItem.id : '',
      name: formName.trim(),
      description: formDesc.trim(),
      price: parsedPrice,
      category: formCategory,
      available: formAvailable,
    };

    setIsSaving(true);
    setFormError(null);
    try {
      await onSaveItem(itemToSave, !editingItem);
      setIsModalOpen(false);
    } catch (error) {
      setFormError(describeApiError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCat =
      selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Top Bar: Search, Category Filter, and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-star-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161616] border border-[#2B2B2B] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-star-muted/60 focus:outline-none focus:border-star-gold"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#161616] border border-[#2B2B2B] text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-star-gold cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="food">Food</option>
            <option value="beer">Beer</option>
            <option value="cocktails">Cocktails</option>
            <option value="wine">Wine</option>
            <option value="spirits">Spirits</option>
            <option value="mocktails">Mocktails</option>
            <option value="soft-drinks">Soft Drinks</option>
          </select>

          <Button
            variant="gold"
            size="sm"
            onClick={openAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Menu Item
          </Button>
        </div>
      </div>

      {/* Items Table Container */}
      <div className="bg-[#141414] border border-[#242424] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1A1A1A] border-b border-[#262626] text-star-muted uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-4">Item</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4">Availability</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-star-muted">
                    No menu items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#181818] transition-colors">
                    {/* Item */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-bold text-sm text-white">{item.name}</span>
                        <p className="text-[11px] text-star-muted line-clamp-1 max-w-sm mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="capitalize px-2.5 py-1 rounded-lg bg-[#202020] text-zinc-300 font-medium">
                        {item.category}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-black text-star-gold text-sm">
                        {formatCurrency(item.price)}
                      </span>
                    </td>

                    {/* Availability Toggle */}
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => onToggleAvailability(item.id, !item.available)}
                        aria-pressed={!item.available}
                        title={item.available ? 'Tap to mark Sold Out' : 'Tap to make available again'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                          item.available
                            ? 'bg-green-500/15 text-star-green border border-green-500/30'
                            : 'bg-red-500/15 text-star-red border border-red-500/30'
                        }`}
                      >
                        {item.available ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Available</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Sold Out</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-2 text-zinc-300 hover:text-white rounded-lg hover:bg-[#252525] transition-colors"
                          title="Edit item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          className="p-2 text-star-red hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
        subtitle="Guests see changes the next time their menu refreshes (within a minute)"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 pt-1">
          <Input
            label="Item Name"
            placeholder="e.g. Suya Beef Skewers"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-star-muted">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Flavor notes, ingredients, sides..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full bg-[#151515] border border-[#262626] text-white text-sm rounded-xl p-3 focus:outline-none focus:border-star-gold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price in GH₵"
              type="number"
              step="any"
              placeholder="e.g. 50"
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-star-muted">
                Category
              </label>
              <select
                value={formCategory}
                onChange={(e) =>
                  setFormCategory(
                    e.target.value as Exclude<ItemCategory, 'all' | 'drinks'>
                  )
                }
                className="w-full bg-[#151515] border border-[#262626] text-white text-sm rounded-xl px-3 py-3 min-h-[46px] focus:outline-none focus:border-star-gold cursor-pointer"
              >
                <option value="food">Food</option>
                <option value="beer">Beer</option>
                <option value="cocktails">Cocktails</option>
                <option value="wine">Wine</option>
                <option value="spirits">Spirits</option>
                <option value="mocktails">Mocktails</option>
                <option value="soft-drinks">Soft Drinks</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="available-checkbox"
              checked={formAvailable}
              onChange={(e) => setFormAvailable(e.target.checked)}
              className="w-4 h-4 rounded text-star-gold focus:ring-star-gold accent-star-gold cursor-pointer"
            />
            <label htmlFor="available-checkbox" className="text-sm text-white font-medium cursor-pointer">
              Available immediately on menu
            </label>
          </div>

          {formError && (
            <p className="text-xs text-star-red font-medium">{formError}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#262626]">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold" size="md" isLoading={isSaving}>
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
