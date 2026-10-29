'use client';

import React, { useCallback, useState } from 'react';
import { BellRing, CheckCheck, Coffee, Hand, Loader2, RefreshCw } from 'lucide-react';
import { acceptOrder, describeApiError, getWaiterBoard, serveOrder, setMyShift } from '@/lib/api';
import { buzz, playChime } from '@/lib/sound';
import { useLiveResource } from '@/lib/useLiveResource';
import { formatAge, useNow } from '@/lib/useNow';
import { formatCurrency } from '@/lib/utils';
import { StaffTopBar } from '@/components/staff/StaffTopBar';
import { AgeBadge, NoteCallout, OrderLines, StationChips } from '@/components/staff/OrderBits';
import { PushPrompt } from '@/components/staff/PushPrompt';
import { useToast } from '@/components/staff/Toast';
import { ShiftStatus, StaffOrder, WaiterBoard } from '@/types';

const isOpen = (order: StaffOrder) => order.status !== 'completed' && order.status !== 'cancelled';
const isReady = (order: StaffOrder) => order.status === 'ready';

/** Chime for orders that just arrived and orders that just became ready for pick-up. */
function alertOnChanges(next: WaiterBoard, previous: WaiterBoard | null) {
  if (!previous) return;
  const before = new Map(previous.orders.map((o) => [o.id, o]));
  const open = next.orders.filter(isOpen);
  if (open.some((o) => isReady(o) && !(before.get(o.id) && isReady(before.get(o.id)!)))) {
    playChime('urgent');
    buzz([200, 100, 200]);
  } else if (open.some((o) => !o.accepted_at && (!before.get(o.id) || before.get(o.id)!.accepted_at))) {
    playChime('new');
    buzz();
  }
}

export default function WaiterPage() {
  const now = useNow(15000);
  const { show, toast } = useToast();
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const { data: board, error, connected, refresh, refreshSoon, update } = useLiveResource(getWaiterBoard, {
    pollMs: 20000,
    onUpdate: alertOnChanges,
  });

  const act = useCallback(
    async (order: StaffOrder, action: 'accept' | 'serve') => {
      setBusy((current) => ({ ...current, [order.id]: true }));
      try {
        const updated = action === 'accept' ? await acceptOrder(order.id) : await serveOrder(order.id);
        update((current) => ({ ...current, orders: current.orders.map((o) => (o.id === updated.id ? updated : o)) }));
      } catch (err) {
        show(describeApiError(err));
      } finally {
        setBusy((current) => {
          const next = { ...current };
          delete next[order.id];
          return next;
        });
        refreshSoon();
      }
    },
    [refreshSoon, show, update]
  );

  const changeShift = useCallback(
    async (shift: ShiftStatus) => {
      try {
        const me = await setMyShift(shift);
        update((current) => ({ ...current, me }));
      } catch (err) {
        show(describeApiError(err));
      }
    },
    [show, update]
  );

  if (!board) {
    return (
      <div className="min-h-screen bg-ink text-cream">
        <StaffTopBar title="My tables" connected={connected} />
        <main className="max-w-5xl mx-auto px-4 pt-6">
          {error ? (
            <div className="mt-16 text-center">
              <p className="font-semibold">Couldn’t load your orders</p>
              <p className="mt-1 text-sm text-dust">{error}</p>
              <button type="button" onClick={() => void refresh()} className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cream text-ink text-sm font-bold cursor-pointer">
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-52 rounded-3xl" />
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  const { me, tables, orders } = board;
  const open = orders.filter(isOpen);
  const toServe = open.filter(isReady);
  const fresh = open.filter((o) => !o.accepted_at && !isReady(o));
  const cooking = open.filter((o) => o.accepted_at && !isReady(o));
  const served = orders.filter((o) => o.status === 'completed');

  return (
    <div className="min-h-screen bg-ink text-cream">
      <StaffTopBar
        title={me.display_name}
        subtitle={me.shift_status === 'on_shift' ? 'Waiter · on shift' : me.shift_status === 'on_break' ? 'Waiter · on break' : 'Waiter · off shift'}
        connected={connected}
        shift={me.shift_status === 'off' ? undefined : me.shift_status}
        onShiftChange={changeShift}
      />

      <main className="max-w-5xl mx-auto px-4 pt-4 pb-28">
        <section aria-label="Your tables" className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-dust">Your tables</span>
          {tables.length === 0 ? (
            <span className="text-[13px] text-dust">None yet. The manager assigns tables from the floor view.</span>
          ) : (
            tables.map((table) => (
              <span key={table} className="shrink-0 h-9 min-w-9 px-3 grid place-items-center rounded-full bg-ink-raised ring-1 ring-white/10 font-display text-lg font-extrabold tabular">
                {table}
              </span>
            ))
          )}
        </section>

        <PushPrompt onEnabled={() => show('Alerts are on. Your phone will buzz for new and ready orders, even when locked.')} />

        {me.shift_status !== 'on_shift' && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-star-gold/10 ring-1 ring-star-gold/30 px-4 py-3">
            <Coffee className="w-5 h-5 text-star-gold shrink-0" />
            <p className="flex-1 text-[14px] text-star-gold">
              {me.shift_status === 'on_break'
                ? 'You’re on break. New orders from your tables go to the manager until you’re back.'
                : 'You’re off shift, so new orders go to the manager.'}
            </p>
            <button
              type="button"
              onClick={() => void changeShift('on_shift')}
              className="shrink-0 h-10 px-4 rounded-full bg-star-gold text-ink text-[13px] font-bold cursor-pointer"
            >
              {me.shift_status === 'on_break' ? 'I’m back' : 'Start shift'}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-2xl bg-flag-red/10 ring-1 ring-flag-red/30 px-4 py-2.5 text-[13px] text-flag-red" role="status">
            {error} Showing the last update.
          </p>
        )}

        {open.length === 0 && (
          <div className="mt-16 text-center">
            <span className="mx-auto w-16 h-16 grid place-items-center rounded-full bg-ink-raised ring-1 ring-white/10">
              <BellRing className="w-7 h-7 text-star-gold" />
            </span>
            <p className="mt-4 font-display text-[28px] font-extrabold uppercase">All clear</p>
            <p className="mt-1 text-[15px] text-dust max-w-xs mx-auto">
              New orders from your tables show up here with a chime. Keep this screen open.
            </p>
          </div>
        )}

        {toServe.length > 0 && (
          <Section title="Ready to serve" count={toServe.length} dot="bg-flag-green">
            {toServe.map((order) => (
              <WaiterOrderCard key={order.id} order={order} now={now} busy={!!busy[order.id]} onAction={() => act(order, 'serve')} />
            ))}
          </Section>
        )}

        {fresh.length > 0 && (
          <Section title="New: accept to confirm" count={fresh.length} dot="bg-star-gold animate-gold-pulse">
            {fresh.map((order) => (
              <WaiterOrderCard key={order.id} order={order} now={now} busy={!!busy[order.id]} onAction={() => act(order, 'accept')} />
            ))}
          </Section>
        )}

        {cooking.length > 0 && (
          <Section title="Being prepared" count={cooking.length} dot="bg-dust">
            {cooking.map((order) => (
              <WaiterOrderCard key={order.id} order={order} now={now} busy={false} />
            ))}
          </Section>
        )}

        {served.length > 0 && (
          <section className="mt-9">
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-dust">Served recently</h2>
            <ul className="rounded-2xl bg-ink-raised/60 ring-1 ring-white/[0.05] divide-y divide-white/[0.05]">
              {served.map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-10 font-display text-xl font-extrabold tabular">{order.table_number ?? '–'}</span>
                  <span className="flex-1 min-w-0 truncate text-[14px] text-cream/80">
                    {order.items.map((line) => `${line.quantity}× ${line.name}`).join(', ')}
                  </span>
                  <span className="shrink-0 text-[12px] text-dust tabular">
                    {formatAge(order.served_at, now) === 'now' ? 'just now' : `${formatAge(order.served_at, now)} ago`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      {toast}
    </div>
  );
}

function Section({ title, count, dot, children }: { title: string; count: number; dot: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-dust">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {title}
        <span className="tabular text-cream/70">{count}</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function PaymentChip({ order }: { order: StaffOrder }) {
  const base = 'inline-flex items-center h-7 px-2.5 rounded-full text-[12px] font-semibold ring-1 tabular';
  if (order.payment_status === 'paid') {
    return <span className={`${base} bg-flag-green/15 text-flag-green ring-flag-green/40`}>Paid</span>;
  }
  if (order.payment_status === 'failed') {
    return <span className={`${base} bg-flag-red/15 text-flag-red ring-flag-red/40`}>Payment failed · {formatCurrency(order.total)}</span>;
  }
  return <span className={`${base} bg-white/5 text-dust ring-white/10`}>Unpaid · {formatCurrency(order.total)}</span>;
}

function WaiterOrderCard({ order, now, busy, onAction }: { order: StaffOrder; now: number; busy: boolean; onAction?: () => void }) {
  const ready = isReady(order);
  const fresh = !order.accepted_at && !ready;
  const pickup = [order.kitchen_status && 'kitchen', order.bar_status && 'bar'].filter(Boolean).join(' & ');

  return (
    <article
      className={`rounded-3xl bg-ink-raised p-4 ring-1 animate-rise ${
        ready ? 'ring-flag-green/60' : fresh ? 'ring-star-gold/60' : 'ring-white/[0.07]'
      }`}
    >
      <header className="flex items-start gap-3">
        <div
          className={`shrink-0 w-[68px] h-[68px] rounded-2xl flex flex-col items-center justify-center ${
            ready ? 'bg-flag-green text-ink' : 'bg-star-gold text-ink'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] leading-none">Table</span>
          <span className="font-display text-[36px] leading-[0.95] font-extrabold tabular">{order.table_number ?? '–'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold truncate">{order.customer_name}</p>
          <p className="text-[12px] text-dust tabular">Order #{order.id}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ready ? (
              <AgeBadge since={order.ready_at} now={now} warnAt={2} alarmAt={5} prefix="Ready " />
            ) : (
              <AgeBadge since={order.created_at} now={now} warnAt={fresh ? 2 : 15} alarmAt={fresh ? 4 : 25} />
            )}
            <PaymentChip order={order} />
          </div>
        </div>
      </header>

      <div className="mt-4 space-y-3">
        <OrderLines order={order} />
        <NoteCallout notes={order.notes} />
        {!ready && <StationChips order={order} />}
      </div>

      {ready && (
        <p className="mt-3 text-[13px] text-flag-green font-semibold">Pick up from the {pickup || 'pass'}.</p>
      )}

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className={`mt-4 w-full h-14 rounded-2xl inline-flex items-center justify-center gap-2 text-[16px] font-bold active:scale-[0.98] transition disabled:opacity-60 cursor-pointer ${
            ready ? 'bg-flag-green text-ink' : 'bg-star-gold text-ink'
          }`}
        >
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : ready ? (
            <>
              <CheckCheck className="w-5 h-5" /> Mark served
            </>
          ) : (
            <>
              <Hand className="w-5 h-5" /> Accept order
            </>
          )}
        </button>
      )}
    </article>
  );
}
