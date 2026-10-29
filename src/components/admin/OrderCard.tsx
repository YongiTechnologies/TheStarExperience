'use client';

import React from 'react';
import Link from 'next/link';
import { Order, OrderStatusType } from '@/types';
import { formatCurrency, getTimeAgo } from '@/lib/utils';
import { TableBadge } from '@/components/customer/TableBadge';
import { Button } from '@/components/ui/Button';
import { PaymentBadge } from './PaymentBadge';
import { Clock, User, Phone, Eye, MessageSquare, ConciergeBell } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onStatusChange: (orderId: string, newStatus: OrderStatusType) => void;
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const getActionConfig = () => {
    switch (order.status) {
      case 'received':
        return {
          label: 'START PREPARING',
          nextStatus: 'preparing' as OrderStatusType,
          variant: 'gold' as const,
        };
      case 'preparing':
        return {
          label: 'MARK READY',
          nextStatus: 'ready' as OrderStatusType,
          variant: 'gold' as const,
        };
      case 'ready':
        return {
          label: 'COMPLETE ORDER',
          nextStatus: 'completed' as OrderStatusType,
          variant: 'outline' as const,
        };
      case 'completed':
        return null;
    }
  };

  const action = getActionConfig();

  return (
    <div className="bg-[#161616] border border-[#262626] hover:border-star-gold/40 rounded-2xl p-4 shadow-md transition-all duration-150 flex flex-col justify-between gap-3 group">
      {/* Top Meta */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-white text-sm">
              #{order.id}
            </span>
            <PaymentBadge order={order} />
          </div>

          <TableBadge tableNumber={order.tableNumber} size="sm" />
        </div>

        {/* Customer info & Time */}
        <div className="pt-2 pb-1 flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-1 font-semibold text-white">
            <User className="w-3.5 h-3.5 text-star-gold" />
            <span className="truncate max-w-[130px]">{order.customerName}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-star-muted font-mono">
            <Clock className="w-3 h-3" />
            <span>{getTimeAgo(order.createdAt)}</span>
          </div>
        </div>

        {order.phone && (
          <div className="flex items-center gap-1 text-[11px] text-star-muted font-mono pb-2">
            <Phone className="w-3 h-3 text-star-gold" />
            <span>{order.phone}</span>
          </div>
        )}

        {order.status !== 'completed' && <ServiceStrip order={order} />}

        {/* Item List */}
        <div className="my-2 py-2 px-3 bg-[#111111] rounded-xl border border-[#222222] text-xs space-y-1">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-zinc-200">
              <span className="truncate">
                <strong className="text-star-gold font-mono mr-1.5">{item.quantity}×</strong>
                {item.name}
              </span>
              <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="mb-2 flex items-start gap-1.5 rounded-lg bg-star-gold/10 border border-star-gold/30 px-2.5 py-1.5 text-xs font-semibold text-star-gold">
            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-3">{order.notes}</span>
          </div>
        )}
      </div>

      {/* Bottom Row: Total & Actions */}
      <div className="pt-2 border-t border-[#222222] flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-star-muted font-semibold">Total Amount</span>
          <span className="font-mono font-black text-sm text-star-gold">
            {formatCurrency(order.total)}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {action ? (
            <Button
              type="button"
              variant={action.variant}
              size="sm"
              onClick={() => onStatusChange(order.id, action.nextStatus)}
              className="flex-1 text-xs py-2 font-bold"
            >
              {action.label}
            </Button>
          ) : (
            <div className="flex-1 text-center py-2 text-xs font-semibold text-star-green bg-green-500/10 rounded-xl border border-green-500/20">
              ✓ Completed
            </div>
          )}

          <Link
            href={`/admin/orders/${order.id}`}
            className="p-2 rounded-xl bg-[#222222] hover:bg-[#2C2C2C] text-zinc-300 hover:text-white border border-[#333333] transition-colors"
            title="View full order details"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const STATION_TONE = {
  queued: 'bg-white/5 text-zinc-400',
  preparing: 'bg-star-gold/15 text-star-gold',
  ready: 'bg-star-green/15 text-star-green',
} as const;

/** Who's serving the order and how far the kitchen and bar have got. */
function ServiceStrip({ order }: { order: Order }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2 text-[11px] font-semibold">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
          !order.waiterName ? 'bg-star-red/15 text-star-red' : order.acceptedAt ? 'bg-white/5 text-zinc-200' : 'bg-star-gold/15 text-star-gold'
        }`}
      >
        <ConciergeBell className="w-3 h-3" />
        {!order.waiterName ? 'No waiter' : order.acceptedAt ? order.waiterName : `${order.waiterName} · not accepted`}
      </span>
      {order.kitchenStatus && <span className={`px-2 py-0.5 rounded-md ${STATION_TONE[order.kitchenStatus]}`}>Kitchen {order.kitchenStatus}</span>}
      {order.barStatus && <span className={`px-2 py-0.5 rounded-md ${STATION_TONE[order.barStatus]}`}>Bar {order.barStatus}</span>}
    </div>
  );
}
