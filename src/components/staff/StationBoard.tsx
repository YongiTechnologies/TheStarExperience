'use client';

import React, { useCallback, useState } from 'react';
import { ChefHat, Flame, GlassWater, Loader2, RefreshCw, Undo2 } from 'lucide-react';
import { describeApiError, getSession, getStationTickets, updateStation } from '@/lib/api';
import { buzz, playChime } from '@/lib/sound';
import { useLiveResource } from '@/lib/useLiveResource';
import { useNow } from '@/lib/useNow';
import { useWakeLock } from '@/lib/useWakeLock';
import { StaffTopBar } from '@/components/staff/StaffTopBar';
import { AgeBadge, NoteCallout, OrderLines } from '@/components/staff/OrderBits';
import { useToast } from '@/components/staff/Toast';
import { StaffOrder, StationName, StationState } from '@/types';

const COLUMNS: { state: StationState; title: string; empty: string; dot: string }[] = [
  { state: 'queued', title: 'New', empty: 'Nothing waiting.', dot: 'bg-star-gold animate-gold-pulse' },
  { state: 'preparing', title: 'Preparing', empty: 'Tap Start on a new ticket.', dot: 'bg-star-gold' },
  { state: 'ready', title: 'Ready for pick-up', empty: 'Ready orders wait here until the waiter collects them.', dot: 'bg-flag-green' },
];

const stateOf = (order: StaffOrder, station: StationName) => order[`${station}_status`] as StationState;

/** Kitchen or bar display: tickets move New → Preparing → Ready, and leave when the waiter serves them. */
export function StationBoard({ station }: { station: StationName }) {
  const now = useNow(15000);
  useWakeLock();
  const { show, toast } = useToast();
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  const alertOnNew = useCallback(
    (next: StaffOrder[], previous: StaffOrder[] | null) => {
      if (!previous) return;
      const known = new Set(previous.map((o) => o.id));
      if (next.some((o) => !known.has(o.id) && stateOf(o, station) === 'queued')) {
        playChime('new');
        buzz();
      }
    },
    [station]
  );

  const fetchTickets = useCallback(() => getStationTickets(station), [station]);
  const { data: tickets, error, connected, refresh, refreshSoon, update } = useLiveResource(fetchTickets, {
    pollMs: 15000,
    onUpdate: alertOnNew,
  });

  const move = useCallback(
    async (order: StaffOrder, status: 'preparing' | 'ready') => {
      setBusy((current) => ({ ...current, [order.id]: true }));
      try {
        const updated = await updateStation(station, order.id, status);
        update((current) => current.map((o) => (o.id === updated.id ? updated : o)));
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
    [refreshSoon, show, station, update]
  );

  const Icon = station === 'kitchen' ? ChefHat : GlassWater;
  const signedInAs = getSession()?.name;

  return (
    <div className="min-h-screen bg-ink text-cream">
      <StaffTopBar
        title={station === 'kitchen' ? 'Kitchen' : 'Bar'}
        subtitle={signedInAs ? `Signed in as ${signedInAs}` : undefined}
        connected={connected}
        wide
      />

      <main className="max-w-[1400px] mx-auto px-4 pt-4 pb-24">
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-flag-red/10 ring-1 ring-flag-red/30 px-4 py-2.5 text-[13px] text-flag-red" role="status">
            <span className="flex-1">{error} {tickets ? 'Showing the last update.' : ''}</span>
            <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {!tickets ? (
          <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-72 rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3 items-start">
            {COLUMNS.map((column) => {
              const items = tickets.filter((o) => stateOf(o, station) === column.state);
              return (
                <section key={column.state} aria-label={column.title} className="min-w-0">
                  <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.2em] text-dust">
                    <span className={`w-2.5 h-2.5 rounded-full ${column.dot}`} />
                    {column.title}
                    <span className="tabular text-cream/70">{items.length}</span>
                  </h2>
                  {items.length === 0 ? (
                    <p className="rounded-3xl border border-dashed border-white/10 px-4 py-8 text-center text-[14px] text-dust">
                      {column.state === 'queued' && <Icon className="mx-auto mb-2 w-6 h-6 text-dust/60" />}
                      {column.empty}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {items.map((order) => (
                        <Ticket
                          key={order.id}
                          order={order}
                          state={column.state}
                          now={now}
                          busy={!!busy[order.id]}
                          onMove={(status) => move(order, status)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
      {toast}
    </div>
  );
}

function Ticket({
  order,
  state,
  now,
  busy,
  onMove,
}: {
  order: StaffOrder;
  state: StationState;
  now: number;
  busy: boolean;
  onMove: (status: 'preparing' | 'ready') => void;
}) {
  return (
    <article
      className={`rounded-3xl bg-ink-raised p-4 ring-1 animate-rise ${
        state === 'queued' ? 'ring-star-gold/60' : state === 'ready' ? 'ring-flag-green/50' : 'ring-white/[0.08]'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dust">Table</p>
          <p className="font-display text-[44px] leading-[0.9] font-extrabold tabular">{order.table_number ?? '–'}</p>
        </div>
        <div className="text-right space-y-1">
          {state === 'ready' ? (
            <AgeBadge since={order.ready_at ?? order.created_at} now={now} warnAt={3} alarmAt={6} prefix="Ready " />
          ) : (
            <AgeBadge since={order.created_at} now={now} warnAt={10} alarmAt={20} />
          )}
          <p className="text-[12px] text-dust tabular">#{order.id}</p>
          <p className="text-[12px] text-dust truncate max-w-[10rem]">
            {order.waiter ? order.waiter.display_name : 'No waiter yet'}
          </p>
        </div>
      </header>

      <div className="mt-3 space-y-3">
        <OrderLines order={order} large />
        <NoteCallout notes={order.notes} />
        {order.payment_status === 'failed' && (
          <p className="rounded-xl bg-flag-red/10 ring-1 ring-flag-red/30 px-3 py-2 text-[13px] font-semibold text-flag-red">
            Payment failed. Check with {order.waiter ? order.waiter.display_name : 'the manager'} before starting.
          </p>
        )}
      </div>

      {state === 'queued' && (
        <TicketButton busy={busy} onClick={() => onMove('preparing')} className="bg-star-gold text-ink">
          <Flame className="w-5 h-5" /> Start
        </TicketButton>
      )}
      {state === 'preparing' && (
        <TicketButton busy={busy} onClick={() => onMove('ready')} className="bg-flag-green text-ink">
          Ready
        </TicketButton>
      )}
      {state === 'ready' && (
        <button
          type="button"
          onClick={() => onMove('preparing')}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 -ml-1 rounded-full text-[13px] font-semibold text-dust hover:text-cream disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Not ready yet
        </button>
      )}
    </article>
  );
}

function TicketButton({ busy, onClick, className, children }: { busy: boolean; onClick: () => void; className: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`mt-4 w-full h-14 rounded-2xl inline-flex items-center justify-center gap-2 text-[17px] font-bold uppercase tracking-wide active:scale-[0.98] transition disabled:opacity-60 cursor-pointer ${className}`}
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
}
