'use client';

import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface StepperProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  /** Item name, used for screen-reader labels. */
  label: string;
  size?: 'sm' | 'md';
  tone?: 'gold' | 'quiet';
}

/** Pill quantity control. At quantity 1 the minus becomes a remove action. */
export function Stepper({ quantity, onIncrease, onDecrease, label, size = 'sm', tone = 'gold' }: StepperProps) {
  const button = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  const surface =
    tone === 'gold'
      ? 'bg-star-gold text-ink shadow-[0_8px_24px_-8px_rgba(248,213,14,0.65)]'
      : 'bg-ink-high text-cream ring-1 ring-white/10';

  return (
    <div className={`inline-flex items-center rounded-full animate-pop ${surface}`} role="group" aria-label={`${label} quantity`}>
      <button
        type="button"
        onClick={onDecrease}
        aria-label={quantity === 1 ? `Remove ${label}` : `One less ${label}`}
        className={`${button} grid place-items-center rounded-full transition-transform active:scale-90 cursor-pointer`}
      >
        {quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" strokeWidth={2.75} />}
      </button>
      <span className="min-w-5 text-center font-display text-lg font-extrabold tabular leading-none" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={`One more ${label}`}
        className={`${button} grid place-items-center rounded-full transition-transform active:scale-90 cursor-pointer`}
      >
        <Plus className="w-4 h-4" strokeWidth={2.75} />
      </button>
    </div>
  );
}

/** Light haptic tick on supporting devices (Android); silently ignored elsewhere. */
export function haptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8);
    } catch {
      // Some browsers throw when vibration is blocked; feedback is optional.
    }
  }
}
