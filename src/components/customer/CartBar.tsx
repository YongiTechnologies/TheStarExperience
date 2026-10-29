'use client';

import React from 'react';
import { ChevronUp } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/utils';

/** Floating bar that appears once something is in the order; one tap opens checkout. */
export function CartBar({ onOpen }: { onOpen: () => void }) {
  const { totalCount, subtotal } = useCart();

  if (totalCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pt-6 pb-safe bg-gradient-to-t from-ink via-ink/90 to-transparent pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto animate-rise">
        <button
          key={totalCount}
          type="button"
          onClick={onOpen}
          className="animate-bump w-full h-[60px] flex items-center gap-3 pl-2.5 pr-5 rounded-[20px] bg-star-gold text-ink shadow-[0_18px_40px_-12px_rgba(248,213,14,0.55)] active:scale-[0.98] transition-transform cursor-pointer"
        >
          <span className="w-10 h-10 grid place-items-center rounded-[14px] bg-ink text-star-gold font-display text-xl font-extrabold tabular">
            {totalCount}
          </span>
          <span className="text-[15px] font-bold">View order</span>
          <ChevronUp className="w-4 h-4 -ml-1.5 opacity-60" strokeWidth={3} />
          <span className="ml-auto font-display text-2xl font-extrabold tabular">{formatCurrency(subtotal)}</span>
        </button>
      </div>
    </div>
  );
}
