'use client';

import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ChefHat, CircleCheck, ConciergeBell, PartyPopper, XCircle } from 'lucide-react';
import { TrackedOrderStatus } from '@/types';

const STEPS = [
  { status: 'received', label: 'Received' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
  { status: 'completed', label: 'Served' },
] as const;

const COPY: Record<TrackedOrderStatus, { title: string; body: (table: string) => string; Icon: React.ElementType }> = {
  received: {
    title: 'Order received',
    body: () => 'The bar has your order and will start on it shortly.',
    Icon: ConciergeBell,
  },
  preparing: {
    title: 'Being prepared',
    body: () => 'Your food and drinks are being made right now.',
    Icon: ChefHat,
  },
  ready: {
    title: 'Ready!',
    body: (table) => `It’s on its way to ${table ? `Table ${table}` : 'your table'}.`,
    Icon: PartyPopper,
  },
  completed: {
    title: 'Served. Enjoy!',
    body: () => 'Thanks for ordering. Want another round?',
    Icon: CircleCheck,
  },
  cancelled: {
    title: 'Order cancelled',
    body: () => 'Please speak to a member of staff about this order.',
    Icon: XCircle,
  },
};

/** Big status headline plus a four-stop progress bar. Celebrates once when ready. */
export function OrderProgress({ status, tableNumber }: { status: TrackedOrderStatus; tableNumber: string }) {
  const celebrated = useRef(false);

  useEffect(() => {
    if (status !== 'ready' || celebrated.current) return;
    celebrated.current = true;
    try {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.35 }, colors: ['#F8D50E', '#E0322B', '#23A55F', '#F4EFE6'] });
    } catch {
      // Confetti is decorative only.
    }
  }, [status]);

  const { title, body, Icon } = COPY[status];
  const currentIndex = STEPS.findIndex((s) => s.status === status);
  const cancelled = status === 'cancelled';
  const highlight = cancelled ? 'text-flag-red' : status === 'completed' ? 'text-flag-green' : 'text-star-gold';

  return (
    <section aria-live="polite">
      <div
        className={`w-16 h-16 grid place-items-center rounded-2xl ring-1 ${
          cancelled
            ? 'bg-flag-red/10 ring-flag-red/30'
            : status === 'completed'
              ? 'bg-flag-green/10 ring-flag-green/30'
              : 'bg-star-gold/10 ring-star-gold/30'
        } ${highlight} animate-pop`}
        key={status}
      >
        <Icon className="w-8 h-8" strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 font-display text-[44px] leading-[0.9] font-extrabold uppercase">{title}</h1>
      <p className="mt-2 text-[15px] text-cream/75">{body(tableNumber)}</p>

      {!cancelled && (
        <ol className="mt-7 grid grid-cols-4 gap-1.5" aria-label="Order progress">
          {STEPS.map((step, i) => {
            const done = i < currentIndex || status === 'completed';
            const current = i === currentIndex && status !== 'completed';
            return (
              <li key={step.status} aria-current={current ? 'step' : undefined}>
                <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
                  {done && <div className={`absolute inset-0 ${status === 'completed' ? 'bg-flag-green' : 'bg-star-gold'}`} />}
                  {current && (
                    <>
                      <div className="absolute inset-0 bg-star-gold/35" />
                      <div className="absolute inset-y-0 w-1/2 rounded-full bg-star-gold animate-progress-sweep" />
                    </>
                  )}
                </div>
                <p className={`mt-2 text-[12px] font-semibold ${done || current ? 'text-cream' : 'text-dust/60'}`}>{step.label}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
