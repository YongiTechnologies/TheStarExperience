'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRightLeft, Check, Inbox, LayoutGrid, Loader2, RefreshCw, UserPlus } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/staff/Toast';
import { assignOrder, assignTable, describeApiError, getFloor, handoverStaff } from '@/lib/api';
import { useLiveResource } from '@/lib/useLiveResource';
import { formatAge, minutesSince, useNow } from '@/lib/useNow';
import { FloorTable, FloorView, FloorWaiter, ShiftStatus, StaffOrder } from '@/types';

/** Minutes before the floor flags an order nobody accepted, or a ready order nobody served. */
const ACCEPT_ALERT_MIN = 3;
const SERVE_ALERT_MIN = 5;

const SHIFT_LABEL: Record<ShiftStatus, string> = { on_shift: 'On shift', on_break: 'On break', off: 'Off shift' };
const SHIFT_DOT: Record<ShiftStatus, string> = { on_shift: 'bg-star-green', on_break: 'bg-star-gold', off: 'bg-zinc-600' };
const SHIFT_ORDER: Record<ShiftStatus, number> = { on_shift: 0, on_break: 1, off: 2 };

const byShift = (a: FloorWaiter, b: FloorWaiter) =>
  SHIFT_ORDER[a.shift_status] - SHIFT_ORDER[b.shift_status] || a.display_name.localeCompare(b.display_name);

const itemSummary = (order: StaffOrder) => order.items.map((line) => `${line.quantity}× ${line.name}`).join(', ');

interface FloorAlert {
  key: string;
  tone: 'red' | 'gold';
  text: string;
  tableId?: number;
}

function stageOf(order: StaffOrder): { label: string; tone: string } {
  if (order.status === 'ready') return { label: 'Ready', tone: 'bg-star-green/15 text-star-green' };
  if (!order.waiter) return { label: 'Unassigned', tone: 'bg-star-red/15 text-star-red' };
  if (!order.accepted_at) return { label: 'Not accepted', tone: 'bg-star-gold/15 text-star-gold' };
  if (order.status === 'preparing') return { label: 'Preparing', tone: 'bg-white/10 text-zinc-200' };
  return { label: 'Accepted', tone: 'bg-white/5 text-zinc-400' };
}

function computeAlerts(floor: FloorView, now: number): FloorAlert[] {
  const alerts: FloorAlert[] = [];
  const unassigned = floor.unassigned_orders.length;
  if (unassigned) {
    alerts.push({
      key: 'unassigned',
      tone: 'red',
      text: `${unassigned} order${unassigned === 1 ? ' has' : 's have'} no waiter. Assign ${unassigned === 1 ? 'it' : 'them'} from the queue.`,
    });
  }
  for (const table of floor.tables) {
    for (const order of table.open_orders) {
      if (order.status === 'ready' && minutesSince(order.ready_at, now) >= SERVE_ALERT_MIN) {
        alerts.push({
          key: `serve-${order.id}`,
          tone: 'red',
          text: `Table ${table.table_number}: order #${order.id} has been ready for ${formatAge(order.ready_at, now)} and isn’t served.`,
          tableId: table.id,
        });
      } else if (order.waiter && !order.accepted_at && minutesSince(order.assigned_at ?? order.created_at, now) >= ACCEPT_ALERT_MIN) {
        // Counted from when this waiter got it, so a just-reassigned order isn't flagged straight away.
        alerts.push({
          key: `accept-${order.id}`,
          tone: 'gold',
          text: `Table ${table.table_number}: ${order.waiter.display_name} hasn’t accepted order #${order.id} (${formatAge(order.assigned_at ?? order.created_at, now)}).`,
          tableId: table.id,
        });
      }
    }
  }
  // Waiters with tables who aren't taking orders: those tables' new orders land in the queue.
  const away = new Map<number, string[]>();
  for (const table of floor.tables) {
    if (table.waiter && !table.waiter_available) {
      away.set(table.waiter.id, [...(away.get(table.waiter.id) ?? []), table.table_number]);
    }
  }
  for (const [waiterId, tables] of away) {
    const waiter = floor.waiters.find((w) => w.id === waiterId);
    const name = waiter?.display_name ?? floor.tables.find((t) => t.waiter?.id === waiterId)?.waiter?.display_name;
    const state = waiter ? SHIFT_LABEL[waiter.shift_status].toLowerCase() : 'inactive';
    alerts.push({
      key: `away-${waiterId}`,
      tone: 'gold',
      text: `${name} is ${state}. New orders from table${tables.length === 1 ? '' : 's'} ${tables.join(', ')} go to the unassigned queue.`,
    });
  }
  return alerts;
}

export default function FloorPage() {
  const now = useNow(15000);
  const { show, toast } = useToast();
  const { data: floor, error, connected, refresh, refreshSoon } = useLiveResource(getFloor, { pollMs: 15000 });
  const [assigningTable, setAssigningTable] = useState<FloorTable | null>(null);
  const [editingWaiter, setEditingWaiter] = useState<FloorWaiter | null>(null);
  const [handingOver, setHandingOver] = useState<FloorWaiter | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<number | null>(null);

  const alerts = useMemo(() => (floor ? computeAlerts(floor, now) : []), [floor, now]);
  const alertTables = useMemo(() => new Set(alerts.map((a) => a.tableId).filter(Boolean)), [alerts]);
  const waiters = useMemo(() => (floor ? [...floor.waiters].sort(byShift) : []), [floor]);

  const done = useCallback(
    (message?: string) => {
      setAssigningTable(null);
      setEditingWaiter(null);
      setHandingOver(null);
      if (message) show(message);
      refreshSoon();
    },
    [refreshSoon, show]
  );

  const assignQueued = async (order: StaffOrder, waiterId: number) => {
    setAssigningOrder(order.id);
    try {
      await assignOrder(order.id, waiterId);
      const name = floor?.waiters.find((w) => w.id === waiterId)?.display_name;
      show(`Order #${order.id} sent to ${name ?? 'the waiter'}.`);
    } catch (err) {
      show(describeApiError(err));
    } finally {
      setAssigningOrder(null);
      refreshSoon();
    }
  };

  const openOrders = floor ? floor.tables.reduce((sum, t) => sum + t.open_orders.length, 0) : 0;
  const onShift = floor ? floor.waiters.filter((w) => w.shift_status === 'on_shift').length : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <AdminHeader />
      <div className="flex-1 flex flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight uppercase">
                Floor &amp; tables
                <span
                  className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-star-green' : 'bg-zinc-600'}`}
                  title={connected ? 'Live' : 'Reconnecting… (refreshing every 15 s)'}
                />
              </h1>
              <p className="text-xs text-star-muted mt-1">
                Tap a table to give it a waiter. New orders go straight to that table’s waiter while they’re on shift.
              </p>
            </div>
            {floor && (
              <p className="text-xs text-star-muted tabular">
                <strong className="text-white">{floor.tables.length}</strong> tables ·{' '}
                <strong className="text-white">{onShift}</strong> waiter{onShift === 1 ? '' : 's'} on shift ·{' '}
                <strong className="text-white">{openOrders}</strong> open order{openOrders === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl bg-star-red/10 border border-star-red/30 px-4 py-3 text-sm text-star-red" role="status">
              <span className="flex-1">{error}{floor ? ' Showing the last update.' : ''}</span>
              <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {alerts.length > 0 && (
            <ul className="space-y-2" aria-label="Needs attention">
              {alerts.map((alert) => (
                <li
                  key={alert.key}
                  className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${
                    alert.tone === 'red'
                      ? 'bg-star-red/10 border-star-red/30 text-red-200'
                      : 'bg-star-gold/10 border-star-gold/30 text-star-gold'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{alert.text}</span>
                </li>
              ))}
            </ul>
          )}

          {!floor ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-[#141414] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] items-start">
              <section aria-label="Tables">
                {floor.tables.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#2A2A2A] p-8 text-center text-sm text-star-muted">
                    No tables yet. Tables appear here once they’re set up with their QR codes.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {floor.tables.map((table) => (
                      <TableTile
                        key={table.id}
                        table={table}
                        now={now}
                        flagged={alertTables.has(table.id)}
                        onClick={() => setAssigningTable(table)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <section aria-label="Unassigned orders" className="rounded-2xl bg-[#121212] border border-[#232323] p-4">
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-star-muted">
                    <Inbox className="w-4 h-4 text-star-gold" /> Unassigned queue
                    <span className="ml-auto tabular text-white">{floor.unassigned_orders.length}</span>
                  </h2>
                  {floor.unassigned_orders.length === 0 ? (
                    <p className="mt-3 text-sm text-star-muted">Every open order has a waiter.</p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {floor.unassigned_orders.map((order) => (
                        <li key={order.id} className="rounded-xl bg-[#181818] border border-star-red/30 p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-2xl font-extrabold leading-none tabular">{order.table_number ?? '–'}</span>
                            <span className="text-xs text-star-muted tabular">#{order.id} · {formatAge(order.created_at, now)}</span>
                            <Link href={`/admin/orders/${order.id}`} className="ml-auto text-xs font-semibold text-star-gold hover:underline">
                              Details
                            </Link>
                          </div>
                          <p className="mt-1.5 text-xs text-zinc-300 line-clamp-2">{itemSummary(order)}</p>
                          <label className="mt-2.5 flex items-center gap-2">
                            <span className="sr-only">Assign order #{order.id} to</span>
                            <select
                              value=""
                              disabled={assigningOrder === order.id || waiters.length === 0}
                              onChange={(e) => e.target.value && void assignQueued(order, Number(e.target.value))}
                              className="flex-1 h-10 rounded-lg bg-[#0F0F0F] border border-[#2D2D2D] px-2.5 text-sm text-white cursor-pointer disabled:opacity-50"
                            >
                              <option value="">{waiters.length ? 'Assign to…' : 'No waiters yet'}</option>
                              {waiters.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.display_name} · {SHIFT_LABEL[w.shift_status].toLowerCase()}
                                </option>
                              ))}
                            </select>
                            {assigningOrder === order.id && <Loader2 className="w-4 h-4 animate-spin text-star-gold" />}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-label="Waiters" className="rounded-2xl bg-[#121212] border border-[#232323] p-4">
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-star-muted">
                    Waiters
                    <Link href="/admin/staff" className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal font-semibold text-star-gold hover:underline">
                      <UserPlus className="w-3.5 h-3.5" /> Manage staff
                    </Link>
                  </h2>
                  {waiters.length === 0 ? (
                    <p className="mt-3 text-sm text-star-muted">
                      No waiters yet. <Link href="/admin/staff" className="text-star-gold font-semibold">Add your team</Link> and give each a 4-digit PIN.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-[#222222]">
                      {waiters.map((waiter) => (
                        <li key={waiter.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${SHIFT_DOT[waiter.shift_status]}`} />
                            <span className="font-semibold text-sm">{waiter.display_name}</span>
                            <span className="text-[11px] text-star-muted">{SHIFT_LABEL[waiter.shift_status]}</span>
                            <span className="ml-auto text-[11px] text-star-muted tabular">
                              {waiter.open_orders} open
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {waiter.tables.length === 0 ? (
                              <span className="text-xs text-star-muted">No tables</span>
                            ) : (
                              waiter.tables.map((t) => (
                                <span key={t} className="min-w-7 h-7 px-2 grid place-items-center rounded-lg bg-[#1E1E1E] border border-[#2D2D2D] font-display text-sm font-extrabold tabular">
                                  {t}
                                </span>
                              ))
                            )}
                          </div>
                          <div className="mt-2.5 flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setEditingWaiter(waiter)} leftIcon={<LayoutGrid className="w-3.5 h-3.5" />}>
                              Tables
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setHandingOver(waiter)}
                              disabled={waiter.tables.length === 0 && waiter.open_orders === 0}
                              leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                            >
                              Hand over
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </aside>
            </div>
          )}
        </main>
      </div>

      {floor && assigningTable && (
        <AssignTableModal table={assigningTable} waiters={waiters} onClose={() => setAssigningTable(null)} onDone={done} />
      )}
      {floor && editingWaiter && (
        <WaiterTablesModal waiter={editingWaiter} tables={floor.tables} onClose={() => setEditingWaiter(null)} onDone={done} />
      )}
      {floor && handingOver && (
        <HandoverModal waiter={handingOver} waiters={waiters} onClose={() => setHandingOver(null)} onDone={done} />
      )}
      {toast}
    </div>
  );
}

function TableTile({ table, now, flagged, onClick }: { table: FloorTable; now: number; flagged: boolean; onClick: () => void }) {
  const orders = table.open_orders;
  const hasReady = orders.some((o) => o.status === 'ready');
  const ring = flagged
    ? 'border-star-red/60'
    : hasReady
      ? 'border-star-green/50'
      : orders.length
        ? 'border-star-gold/40'
        : 'border-[#242424]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl bg-[#141414] border ${ring} p-3.5 min-h-36 flex flex-col hover:bg-[#191919] transition-colors cursor-pointer`}
      aria-label={`Table ${table.table_number}${table.waiter ? `, ${table.waiter.display_name}` : ', no waiter'}, ${orders.length} open orders`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-[40px] leading-[0.85] font-extrabold tabular">{table.table_number}</span>
        {orders.length > 0 && (
          <span className="h-6 min-w-6 px-1.5 grid place-items-center rounded-full bg-star-gold text-star-black text-xs font-black tabular">
            {orders.length}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[13px] min-w-0">
        {table.waiter ? (
          <>
            <span className={`w-2 h-2 shrink-0 rounded-full ${table.waiter_available ? 'bg-star-green' : 'bg-star-gold'}`} />
            <span className="truncate font-semibold">{table.waiter.display_name}</span>
          </>
        ) : (
          <span className="text-star-muted">No waiter</span>
        )}
      </div>

      {orders.length > 0 && (
        <ul className="mt-auto pt-2.5 space-y-1">
          {orders.slice(0, 3).map((order) => {
            const stage = stageOf(order);
            return (
              <li key={order.id} className="flex items-center gap-1.5 text-[11px]">
                <span className={`px-1.5 py-0.5 rounded-md font-semibold ${stage.tone}`}>{stage.label}</span>
                <span className="text-star-muted tabular">#{order.id} · {formatAge(order.created_at, now)}</span>
              </li>
            );
          })}
          {orders.length > 3 && <li className="text-[11px] text-star-muted">+{orders.length - 3} more</li>}
        </ul>
      )}
    </button>
  );
}

function WaiterOption({
  label,
  detail,
  dot,
  selected,
  onSelect,
}: {
  label: string;
  detail: string;
  dot?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
        selected ? 'border-star-gold bg-star-gold/10' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
      }`}
    >
      {dot ? <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} /> : <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-500" />}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-[11px] text-star-muted truncate">{detail}</span>
      </span>
      {selected && <Check className="w-4 h-4 text-star-gold" />}
    </button>
  );
}

function AssignTableModal({
  table,
  waiters,
  onClose,
  onDone,
}: {
  table: FloorTable;
  waiters: FloorWaiter[];
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const [choice, setChoice] = useState<number | null>(table.waiter?.id ?? null);
  const [moveOrders, setMoveOrders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unchanged = choice === (table.waiter?.id ?? null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await assignTable(table.id, choice, moveOrders);
      const name = waiters.find((w) => w.id === choice)?.display_name;
      onDone(name ? `Table ${table.table_number} is now ${name}’s.` : `Table ${table.table_number} has no waiter now.`);
    } catch (err) {
      setError(describeApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Table ${table.table_number}`} subtitle="Who looks after this table?">
      <div className="space-y-2" role="radiogroup" aria-label="Waiter">
        {waiters.map((w) => (
          <WaiterOption
            key={w.id}
            label={w.display_name}
            detail={`${SHIFT_LABEL[w.shift_status]} · ${w.tables.length ? `tables ${w.tables.join(', ')}` : 'no tables yet'} · ${w.open_orders} open`}
            dot={SHIFT_DOT[w.shift_status]}
            selected={choice === w.id}
            onSelect={() => setChoice(w.id)}
          />
        ))}
        <WaiterOption label="No waiter" detail="New orders from this table go to the unassigned queue" selected={choice === null} onSelect={() => setChoice(null)} />
        {waiters.length === 0 && (
          <p className="text-sm text-star-muted">
            No waiters yet. <Link href="/admin/staff" className="text-star-gold font-semibold">Add staff</Link> first.
          </p>
        )}
      </div>

      {table.open_orders.length > 0 && (
        <label className="mt-4 flex items-start gap-2.5 text-sm text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={moveOrders} onChange={(e) => setMoveOrders(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#F8D50E]" />
          <span>
            Also move its {table.open_orders.length} open order{table.open_orders.length === 1 ? '' : 's'}
            <span className="block text-[11px] text-star-muted">The new waiter accepts them again.</span>
          </span>
        </label>
      )}

      {error && <p className="mt-3 text-sm text-star-red" role="alert">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={save} isLoading={saving} disabled={unchanged} className="flex-1">
          Save
        </Button>
      </div>
    </Modal>
  );
}

function WaiterTablesModal({
  waiter,
  tables,
  onClose,
  onDone,
}: {
  waiter: FloorWaiter;
  tables: FloorTable[];
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const initial = useMemo(() => new Set(tables.filter((t) => t.waiter?.id === waiter.id).map((t) => t.id)), [tables, waiter.id]);
  const [selected, setSelected] = useState<Set<number>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const added = [...selected].filter((id) => !initial.has(id));
  const removed = [...initial].filter((id) => !selected.has(id));

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const id of added) await assignTable(id, waiter.id, true);
      // Orders already underway stay with this waiter; only new orders stop coming to them.
      for (const id of removed) await assignTable(id, null, false);
      const numbers = tables.filter((t) => selected.has(t.id)).map((t) => t.table_number);
      onDone(numbers.length ? `${waiter.display_name} has tables ${numbers.join(', ')}.` : `${waiter.display_name} has no tables now.`);
    } catch (err) {
      setError(describeApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${waiter.display_name}’s tables`} subtitle="Tap tables to give them to or take them from this waiter." maxWidth="lg">
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {tables.map((table) => {
          const mine = selected.has(table.id);
          const other = !mine && table.waiter && table.waiter.id !== waiter.id ? table.waiter.display_name : null;
          return (
            <button
              key={table.id}
              type="button"
              aria-pressed={mine}
              onClick={() => toggle(table.id)}
              className={`h-16 rounded-xl border flex flex-col items-center justify-center transition-colors cursor-pointer ${
                mine ? 'bg-star-gold text-star-black border-star-gold' : 'bg-[#181818] border-[#2A2A2A] hover:border-[#3A3A3A]'
              }`}
            >
              <span className="font-display text-2xl font-extrabold leading-none tabular">{table.table_number}</span>
              {other && <span className="mt-1 text-[10px] text-star-muted truncate max-w-full px-1">{other}</span>}
            </button>
          );
        })}
      </div>
      {added.some((id) => tables.find((t) => t.id === id)?.waiter) && (
        <p className="mt-3 text-[12px] text-star-muted">Tables taken from another waiter move with their open orders.</p>
      )}
      {error && <p className="mt-3 text-sm text-star-red" role="alert">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={save} isLoading={saving} disabled={added.length === 0 && removed.length === 0} className="flex-1">
          Save
        </Button>
      </div>
    </Modal>
  );
}

function HandoverModal({
  waiter,
  waiters,
  onClose,
  onDone,
}: {
  waiter: FloorWaiter;
  waiters: FloorWaiter[];
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const others = waiters.filter((w) => w.id !== waiter.id);
  const [choice, setChoice] = useState<number | null>(others.find((w) => w.shift_status === 'on_shift')?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await handoverStaff(waiter.id, choice);
      const name = others.find((w) => w.id === choice)?.display_name;
      onDone(name ? `${waiter.display_name}’s tables and orders moved to ${name}.` : `${waiter.display_name}’s tables are unassigned.`);
    } catch (err) {
      setError(describeApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Hand over from ${waiter.display_name}`}
      subtitle={`Moves tables ${waiter.tables.join(', ') || '(none)'} and ${waiter.open_orders} open order${waiter.open_orders === 1 ? '' : 's'}.`}
    >
      <div className="space-y-2" role="radiogroup" aria-label="Hand over to">
        {others.map((w) => (
          <WaiterOption
            key={w.id}
            label={w.display_name}
            detail={`${SHIFT_LABEL[w.shift_status]} · ${w.tables.length ? `tables ${w.tables.join(', ')}` : 'no tables yet'}`}
            dot={SHIFT_DOT[w.shift_status]}
            selected={choice === w.id}
            onSelect={() => setChoice(w.id)}
          />
        ))}
        <WaiterOption label="Nobody for now" detail="Tables lose their waiter; open orders go to the unassigned queue" selected={choice === null} onSelect={() => setChoice(null)} />
      </div>
      {error && <p className="mt-3 text-sm text-star-red" role="alert">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={save} isLoading={saving} className="flex-1">
          Hand over
        </Button>
      </div>
    </Modal>
  );
}
