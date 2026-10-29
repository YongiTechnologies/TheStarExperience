'use client';

import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { describeApiError, getOrderActivity } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { ActivityEntry, Order } from '@/types';

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);

/** One sentence per audit entry ("Ama accepted the order"). */
function describe(entry: ActivityEntry): string {
  const who = entry.actor ?? 'Someone';
  const detail = entry.detail ?? {};
  switch (entry.action) {
    case 'order.placed': {
      const table = text(detail.table_number);
      const routed = text(detail.routed_to);
      return `Placed${table ? ` at table ${table}` : ''}. ${routed ? `Sent to ${routed}.` : 'No waiter on shift for the table, so it went to the unassigned queue.'}`;
    }
    case 'order.accepted':
      return `${who} accepted the order`;
    case 'order.assigned': {
      const from = text(detail.from_staff);
      const to = text(detail.to_staff);
      const target = to ?? 'the unassigned queue';
      if (detail.reason === 'handover') return `Handed over from ${from ?? 'nobody'} to ${target}`;
      if (detail.reason === 'table') return `Table reassigned: moved to ${target}`;
      if (detail.reason === 'returned') return `${to ?? 'The waiter'} came back on shift and picked it up`;
      if (detail.reason === 'released') return `${from ?? 'The waiter'} is no longer serving; moved to ${target}`;
      return `${who} assigned it to ${target}`;
    }
    case 'kitchen.preparing':
      return `Kitchen started preparing${entry.actor ? ` (${entry.actor})` : ''}`;
    case 'kitchen.ready':
      return `Kitchen marked its items ready${entry.actor ? ` (${entry.actor})` : ''}`;
    case 'bar.preparing':
      return `Bar started preparing${entry.actor ? ` (${entry.actor})` : ''}`;
    case 'bar.ready':
      return `Bar marked its items ready${entry.actor ? ` (${entry.actor})` : ''}`;
    case 'order.served':
      return `${who} served it`;
    case 'order.status_override':
      return `${who} set the status to ${text(detail.status) ?? 'a new stage'}`;
    default:
      return entry.action;
  }
}

export function OrderTimeline({ order }: { order: Order }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reload whenever the order visibly moves on.
  const version = [order.status, order.waiterName, order.acceptedAt, order.kitchenStatus, order.barStatus].join('|');

  useEffect(() => {
    let cancelled = false;
    getOrderActivity(order.id)
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setError(null);
      })
      .catch((err) => !cancelled && setError(describeApiError(err)));
    return () => {
      cancelled = true;
    };
  }, [order.id, version]);

  return (
    <section className="bg-[#141414] border border-[#262626] rounded-3xl p-6 sm:p-8 print:hidden" aria-label="Order timeline">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-star-muted">
        <History className="w-4 h-4 text-star-gold" /> Timeline
      </h2>
      {error ? (
        <p className="mt-3 text-sm text-star-red">{error}</p>
      ) : !entries ? (
        <div className="mt-4 h-16 rounded-xl bg-[#1A1A1A] animate-pulse" />
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-star-muted">No activity recorded for this order yet.</p>
      ) : (
        <ol className="mt-4 relative border-l border-[#2A2A2A] ml-1.5 space-y-4">
          {entries.map((entry, i) => (
            <li key={i} className="pl-5 relative">
              <span
                className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${
                  i === entries.length - 1 ? 'bg-star-gold' : 'bg-[#3A3A3A]'
                }`}
              />
              <p className="text-sm text-zinc-200">{describe(entry)}</p>
              <p className="text-[11px] text-star-muted font-mono">{formatDateTime(entry.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
