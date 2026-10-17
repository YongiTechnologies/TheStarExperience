'use client';

import React from 'react';
import { Beer, CupSoda, Flame, GlassWater, Plus, UtensilsCrossed, Wine } from 'lucide-react';
import { MenuItem } from '@/types';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/utils';
import { Stepper, haptic } from './Stepper';

const CATEGORY_GLYPH: Record<MenuItem['category'], React.ElementType> = {
  food: UtensilsCrossed,
  cocktails: GlassWater,
  mocktails: CupSoda,
  beer: Beer,
  wine: Wine,
  spirits: Flame,
  'soft-drinks': CupSoda,
};

/** One menu line: name, description, price, and a one-tap add on the photo. */
export function MenuRow({ item }: { item: MenuItem }) {
  const { addItem, updateQuantity, getItemQuantity } = useCart();
  const quantity = getItemQuantity(item.id);
  const soldOut = !item.available;
  const Glyph = CATEGORY_GLYPH[item.category] ?? UtensilsCrossed;

  const add = () => {
    addItem(item, 1);
    haptic();
  };

  return (
    <li className={`flex gap-4 py-4 ${soldOut ? 'opacity-45' : ''}`}>
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="text-[15px] font-semibold leading-snug text-cream">
          {quantity > 0 && <span className="font-display font-extrabold text-star-gold mr-1.5 tabular">{quantity}×</span>}
          {item.name}
        </h3>
        {item.description && (
          <p className="mt-1 text-[13px] leading-snug text-dust line-clamp-2">{item.description}</p>
        )}
        <div className="mt-auto pt-2 flex items-center gap-2.5">
          <span className="font-display text-[22px] leading-none font-extrabold text-star-gold tabular">
            {formatCurrency(item.price)}
          </span>
          {soldOut && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-flag-red">Sold out</span>
          )}
        </div>
      </div>

      <div className="relative shrink-0 w-[104px] h-[104px]">
        {/* Artwork is transparent cut-outs, shown whole on a spotlight tile. */}
        {/* Fixed-size box (pixel caps) sits a little high so the add button doesn't cover the artwork. */}
        <div className="w-full h-full rounded-2xl ring-1 ring-white/5 flex items-center justify-center pb-3 overflow-hidden bg-[radial-gradient(circle_at_50%_70%,#30291c_0%,#1b1813_58%,#151310_100%)]">
          {item.image ? (
            <img
              src={item.image}
              alt=""
              loading="lazy"
              decoding="async"
              className="max-h-[78px] max-w-[84px] object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.55)]"
            />
          ) : (
            <Glyph className="w-8 h-8 text-dust/70" strokeWidth={1.5} />
          )}
        </div>

        {!soldOut && (
          <div className="absolute -bottom-2.5 -right-1.5">
            {quantity === 0 ? (
              <button
                type="button"
                onClick={add}
                aria-label={`Add ${item.name}`}
                className="w-10 h-10 grid place-items-center rounded-full bg-cream text-ink shadow-[0_8px_20px_-6px_rgba(0,0,0,0.8)] ring-4 ring-ink transition-transform active:scale-90 cursor-pointer"
              >
                <Plus className="w-5 h-5" strokeWidth={3} />
              </button>
            ) : (
              <div className="rounded-full ring-4 ring-ink">
                <Stepper
                  quantity={quantity}
                  label={item.name}
                  onIncrease={add}
                  onDecrease={() => {
                    updateQuantity(item.id, quantity - 1);
                    haptic();
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function MenuRowSkeleton() {
  return (
    <li className="flex gap-4 py-4" aria-hidden>
      <div className="flex-1 space-y-2.5 pt-1">
        <div className="skeleton h-4 w-2/3 rounded-md" />
        <div className="skeleton h-3 w-full rounded-md" />
        <div className="skeleton h-3 w-4/5 rounded-md" />
        <div className="skeleton h-5 w-16 rounded-md mt-4" />
      </div>
      <div className="skeleton w-[104px] h-[104px] rounded-2xl shrink-0" />
    </li>
  );
}
