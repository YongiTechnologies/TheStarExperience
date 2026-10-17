'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MessageSquare, Plus, RefreshCw } from 'lucide-react';
import { OrderProgress } from '@/components/customer/OrderProgress';
import { ClientOnly } from '@/components/ClientOnly';
import { ApiError, describeApiError, getCustomerOrder, getRecentOrder, readTrackingToken, saveRecentOrder } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { MOMO_NETWORKS } from '@/lib/momo';
import { TrackedOrder } from '@/types';

const POLL_MS = 5000;

/** Honest payment line: demo checkouts say so, and unpaid orders aren't called paid. */
function paymentLabel(order: TrackedOrder): string {
  const method =
    order.paymentMethod === 'card'
      ? 'card'
      : order.momoNetwork
        ? MOMO_NETWORKS[order.momoNetwork].label
        : order.paymentMethod === 'momo'
          ? 'Mobile Money'
          : null;
  if (order.paymentStatus !== 'paid') return 'Payment pending';
  if (order.paymentProvider === 'demo') return `Demo payment${method ? ` · ${method}` : ''} · not charged`;
  return method ? `Paid with ${method}` : 'Paid';
}
const FINAL_STATUSES = ['completed', 'cancelled'];

function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  // The tracking link carries the order's secret token in its #fragment (never sent to a server).
  // Rendered client-only (see ClientOnly below), so reading window.location here is safe.
  const [token] = useState(() => readTrackingToken(window.location.search, window.location.hash));
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Show this device's copy instantly, then keep it fresh from the backend.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const snapshot = getRecentOrder(id);
      if (snapshot) setOrder((current) => current ?? snapshot);
      try {
        const fresh = await getCustomerOrder(id, token);
        if (cancelled) return;
        setOrder(fresh);
        setError(null);
        saveRecentOrder(fresh);
        if (!FINAL_STATUSES.includes(fresh.status)) timer = setTimeout(load, POLL_MS);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(describeApiError(err));
        timer = setTimeout(load, POLL_MS * 2);
      }
    };

    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, token, attempt]);

  const tableNumber = order ? String(order.tableNumber) : '';
  const menuHref = tableNumber ? `/order?table=${encodeURIComponent(tableNumber)}` : '/order';

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="sticky top-0 z-30 bg-ink/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-md mx-auto h-14 px-3 flex items-center justify-between">
          <Link href={menuHref} className="h-10 px-2 inline-flex items-center gap-1.5 text-[14px] font-semibold">
            <ArrowLeft className="w-4 h-4" /> Menu
          </Link>
          {order && (
            <span className="text-[13px] text-dust">
              Order <span className="font-display text-lg font-extrabold text-cream tabular">#{order.id}</span>
            </span>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-8 pb-40">
        {notFound ? (
          <div className="pt-10 text-center">
            <p className="font-display text-3xl font-extrabold uppercase">Order not found</p>
            <p className="mt-2 text-sm text-dust">We couldn’t find order #{id}. Please ask a member of staff.</p>
          </div>
        ) : !order ? (
          error ? (
            <div className="pt-10 text-center">
              <p className="font-semibold">We couldn’t load your order</p>
              <p className="mt-1 text-sm text-dust">{error}</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cream text-ink text-sm font-bold cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : (
            <div className="space-y-4" aria-hidden>
              <div className="skeleton w-16 h-16 rounded-2xl" />
              <div className="skeleton h-10 w-3/4 rounded-lg" />
              <div className="skeleton h-4 w-2/3 rounded-md" />
            </div>
          )
        ) : (
          <>
            <OrderProgress status={order.status} tableNumber={tableNumber} />

            <p className="mt-5 flex items-center gap-2 text-[12px] text-dust">
              {error ? (
                <>Reconnecting… {error}</>
              ) : FINAL_STATUSES.includes(order.status) ? (
                <>Placed at {formatDateTime(order.createdAt)}</>
              ) : (
                <>
                  <span className="relative flex w-1.5 h-1.5" aria-hidden>
                    <span className="absolute inset-0 rounded-full bg-flag-green animate-live-ring" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-flag-green" />
                  </span>
                  Live · updates automatically
                </>
              )}
            </p>

            <section className="mt-8 rounded-3xl bg-ink-raised ring-1 ring-white/[0.06] overflow-hidden">
              <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dust">Your order</p>
                  <p className="mt-1 text-[15px] font-semibold">
                    {order.customerName}
                    {tableNumber && <span className="text-dust font-normal"> · Table {tableNumber}</span>}
                  </p>
                </div>
                <p className="font-stencil text-[40px] leading-none font-black text-star-gold tabular">#{order.id}</p>
              </div>
              <ul className="px-5 divide-y divide-white/[0.06] border-t border-white/[0.06]">
                {order.items.map((item, i) => (
                  <li key={`${item.id}-${i}`} className="py-3 flex items-baseline gap-3 text-[14px]">
                    <span className="font-display text-lg font-extrabold text-star-gold tabular w-7">{item.quantity}×</span>
                    <span className="flex-1">{item.name}</span>
                    <span className="tabular text-cream/80">{formatCurrency(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              {order.notes && (
                <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-2xl bg-star-gold/[0.07] ring-1 ring-star-gold/20 px-3.5 py-3 text-[14px]">
                  <MessageSquare className="w-4 h-4 text-star-gold shrink-0 mt-0.5" />
                  <p>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-star-gold">Your note</span>
                    {order.notes}
                  </p>
                </div>
              )}
              <div className="px-5 py-4 bg-ink-high/60 flex items-center justify-between">
                <span className="text-[13px] text-dust">{paymentLabel(order)}</span>
                <span className="font-display text-2xl font-extrabold tabular">{formatCurrency(order.total)}</span>
              </div>
            </section>
            <p className="mt-4 text-center text-[12px] text-dust/80">Show order #{order.id} to staff if they ask.</p>
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pt-6 pb-safe bg-gradient-to-t from-ink via-ink/90 to-transparent">
        <Link
          href={menuHref}
          className="max-w-md mx-auto h-14 flex items-center justify-center gap-2 rounded-[18px] bg-star-gold text-ink text-[16px] font-bold shadow-[0_14px_36px_-12px_rgba(248,213,14,0.55)] active:scale-[0.98] transition-transform"
        >
          <Plus className="w-5 h-5" strokeWidth={2.75} /> Order more
        </Link>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-ink" />}>
      <OrderTracking />
    </ClientOnly>
  );
}
