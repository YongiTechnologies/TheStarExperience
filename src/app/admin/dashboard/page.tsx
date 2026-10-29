'use client';

import React from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { StatCard } from '@/components/admin/StatCard';
import { OrderBoard } from '@/components/admin/OrderBoard';
import { useOrders } from '@/context/OrderContext';
import { formatCurrency } from '@/lib/utils';
import { Bell, Flame, PartyPopper, CheckCircle2, DollarSign } from 'lucide-react';
import { OrderStatusType } from '@/types';

export default function AdminDashboardPage() {
  // Orders arrive via OrderContext polling (every 10s), which also plays the new-order chime.
  const { orders, changeOrderStatus, hasNewOrderAlert } = useOrders();

  const newOrdersCount = orders.filter((o) => o.status === 'received').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;
  // Value of everything ordered, not money collected (orders can be unpaid or demo payments).
  const orderValue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatusType) => {
    await changeOrderStatus(orderId, newStatus);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Top Header */}
      <AdminHeader />

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar */}
        <AdminSidebar />

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden">
          {/* Active Notice Banner if new orders exist */}
          {hasNewOrderAlert && (
            <div className="bg-star-gold/15 border border-star-gold/60 rounded-2xl p-4 gold-glow flex items-center justify-between gap-4 animate-rise">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-star-gold text-star-black font-black flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-star-gold uppercase tracking-wide">
                    🔔 NEW ORDER WAITING AT BAR
                  </h4>
                  <p className="text-xs text-white">
                    A customer just placed a new order from their table. Check the &ldquo;NEW ORDERS&rdquo; column below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Metric Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <StatCard
              label="NEW ORDERS"
              value={newOrdersCount}
              icon={<Bell className="w-4 h-4" />}
              variant="gold"
              highlight={newOrdersCount > 0}
            />
            <StatCard
              label="PREPARING"
              value={preparingCount}
              icon={<Flame className="w-4 h-4" />}
              variant="blue"
            />
            <StatCard
              label="READY"
              value={readyCount}
              icon={<PartyPopper className="w-4 h-4" />}
              variant="green"
              highlight={readyCount > 0}
            />
            <StatCard
              label="COMPLETED"
              value={completedCount}
              icon={<CheckCircle2 className="w-4 h-4" />}
              variant="neutral"
            />
            <StatCard
              label="ORDER VALUE"
              value={formatCurrency(orderValue)}
              icon={<DollarSign className="w-4 h-4" />}
              variant="gold"
            />
          </div>

          {/* Kanban Board */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                  ACTIVE ORDER BOARD
                </h2>
                <p className="text-xs text-star-muted">
                  Tap buttons to progress drink & food tickets from New to Completed
                </p>
              </div>

              <span className="text-xs font-mono text-zinc-400 bg-[#161616] px-3 py-1.5 rounded-xl border border-[#262626]">
                Total {orders.length} orders
              </span>
            </div>

            <OrderBoard
              orders={orders}
              onStatusChange={handleStatusChange}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
