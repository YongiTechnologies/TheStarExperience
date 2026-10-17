import React from 'react';
import { Order } from '@/types';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { MOMO_NETWORKS } from '@/lib/momo';

interface PaymentSummary {
  label: string;
  variant: BadgeVariant;
  /** Plain-language line for staff, e.g. "Demo checkout · no money collected". */
  detail: string;
}

/** What staff need to know before serving: was money actually collected, and how. */
export function describePayment(order: Order): PaymentSummary {
  const method =
    order.paymentMethod === 'card'
      ? 'Card'
      : order.paymentMethod === 'momo'
        ? order.momoNetwork
          ? MOMO_NETWORKS[order.momoNetwork].label
          : 'Mobile Money'
        : order.paymentMethod === 'cash'
          ? 'Cash'
          : null;

  if (order.paymentStatus === 'paid' && order.paymentProvider === 'demo') {
    return { label: 'Demo', variant: 'blue', detail: `Demo checkout${method ? ` via ${method}` : ''} · no money collected` };
  }
  if (order.paymentStatus === 'paid') {
    return { label: 'Paid', variant: 'green', detail: method ? `Paid via ${method}` : 'Paid' };
  }
  if (order.paymentStatus === 'failed') {
    return { label: 'Failed', variant: 'red', detail: 'Payment failed · collect payment before serving' };
  }
  return { label: 'Unpaid', variant: 'gold', detail: 'Not paid yet · collect payment before serving' };
}

export function PaymentBadge({ order, size = 'sm' }: { order: Order; size?: 'sm' | 'md' }) {
  const { label, variant, detail } = describePayment(order);
  return (
    <span title={detail}>
      <Badge variant={variant} size={size}>
        {label}
      </Badge>
    </span>
  );
}
