'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Smartphone, CreditCard, Shield, Lock , Sparkles} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrderContext';
import { formatCurrency, generateOrderId } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { TableBadge } from '@/components/customer/TableBadge';
import { Input } from '@/components/ui/Input';

export default function PaymentPage() {
  const router = useRouter();
  const {
    items,
    tableNumber,
    customerInfo,
    subtotal,
    orderNotes,
    clearCart,
  } = useCart();
  const { placeNewOrder } = useOrders();

  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card'>('momo');
  const [momoNetwork, setMomoNetwork] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [momoNumber, setMomoNumber] = useState(customerInfo.phone || '0244123456');
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');

  // Fallback if accessed with empty cart
  const orderTotal = subtotal > 0 ? subtotal : 140;
  const currentOrderId = React.useMemo(() => generateOrderId(), []);

  const handlePayment = async () => {
    setIsProcessing(true);
    setProcessingStep('Connecting to payment gateway...');

    // TODO: Replace mock payment with Paystack/Hubtel integration when backend is implemented.
    // In production, this step will call:
    // const res = await fetch('/api/payments/initialize', {
    //   method: 'POST',
    //   body: JSON.stringify({ orderId: currentOrderId, amount: orderTotal, currency: 'GHS', method: paymentMethod })
    // });
    // const { authorizationUrl } = await res.json();
    // window.location.href = authorizationUrl;

    // Simulate payment authorization delay
    setTimeout(() => {
      setProcessingStep('Verifying authorization with provider...');
    }, 900);

    setTimeout(async () => {
      setProcessingStep('Payment confirmed! Finalizing your order...');

      // Build order item list
      const orderItems =
        items.length > 0
          ? items.map((ci) => ({
              id: ci.item.id,
              name: ci.item.name,
              price: ci.item.price,
              quantity: ci.quantity,
              notes: ci.notes,
            }))
          : [
              { id: 'beer-001', name: 'Club Beer (Large)', price: 25, quantity: 2 },
              { id: 'food-001', name: 'Ghanaian Jollof Rice', price: 50, quantity: 1 },
              { id: 'food-003', name: 'Charcoal Grilled Chicken', price: 40, quantity: 1 },
            ];

      // Place order in shared state
      const createdOrder = await placeNewOrder({
        id: currentOrderId,
        tableNumber: tableNumber || 12,
        customerName: customerInfo.name || 'Kofi Appiah',
        phone: customerInfo.phone || momoNumber || '0244123456',
        items: orderItems,
        subtotal: orderTotal,
        total: orderTotal,
        status: 'received',
        paymentStatus: 'paid',
        paymentMethod: paymentMethod,
        momoNetwork: paymentMethod === 'momo' ? momoNetwork : undefined,
        notes: orderNotes,
      });

      // Clear local cart
      clearCart();

      // Redirect to order tracking page
      router.push(`/order/${createdOrder.id}`);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-between">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0E0E0E]/95 backdrop-blur-md border-b border-[#222222] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href="/checkout"
            className="flex items-center gap-1.5 text-xs text-star-muted hover:text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>

          <span className="text-xs font-black tracking-widest uppercase text-star-gold">
            SECURE PAYMENT
          </span>

          <TableBadge tableNumber={tableNumber || '12'} size="sm" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto w-full p-4 sm:p-6 flex-1 space-y-5">
        {/* Payment Header Summary Card */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-star-gold/15 text-star-gold border border-star-gold/30 text-[10px] font-bold uppercase tracking-widest mb-2">
            <Sparkles className="w-3 h-3" /> Kwesi Dain • The Star Experience
          </div>

          <h2 className="text-xl font-black uppercase text-white tracking-wide">
            PAY FOR YOUR ORDER
          </h2>

          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-zinc-400">
            <span>
              Order <strong className="font-mono text-white">#{currentOrderId}</strong>
            </span>
            <span>•</span>
            <span>
              Table <strong className="font-mono text-star-gold">#{tableNumber || '12'}</strong>
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-[#222222]">
            <span className="text-xs text-star-muted uppercase tracking-wider block font-semibold">
              Total Due
            </span>
            <span className="text-3xl font-black font-mono text-star-gold tracking-tight">
              {formatCurrency(orderTotal)}
            </span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-star-muted block">
            Select Payment Method
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* Mobile Money */}
            <button
              type="button"
              onClick={() => setPaymentMethod('momo')}
              className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
                paymentMethod === 'momo'
                  ? 'bg-star-gold/10 border-star-gold text-white gold-glow-sm'
                  : 'bg-[#141414] border-[#262626] text-zinc-400 hover:text-white hover:border-[#383838]'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  paymentMethod === 'momo'
                    ? 'bg-star-gold text-star-black'
                    : 'bg-[#202020] text-zinc-400'
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold block">Mobile Money</span>
                <span className="text-[10px] text-zinc-400">MTN • Telecel • AT</span>
              </div>
            </button>

            {/* Debit / Credit Card */}
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
                paymentMethod === 'card'
                  ? 'bg-star-gold/10 border-star-gold text-white gold-glow-sm'
                  : 'bg-[#141414] border-[#262626] text-zinc-400 hover:text-white hover:border-[#383838]'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  paymentMethod === 'card'
                    ? 'bg-star-gold text-star-black'
                    : 'bg-[#202020] text-zinc-400'
                }`}
              >
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold block">Bank Card</span>
                <span className="text-[10px] text-zinc-400">Visa • Mastercard</span>
              </div>
            </button>
          </div>
        </div>

        {/* Method Detail Inputs */}
        {paymentMethod === 'momo' ? (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-star-muted block">
              Network Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['mtn', 'telecel', 'at'] as const).map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setMomoNetwork(net)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                    momoNetwork === net
                      ? 'bg-star-gold text-star-black gold-glow-sm'
                      : 'bg-[#1E1E1E] text-zinc-400 hover:text-white border border-[#2D2D2D]'
                  }`}
                >
                  {net === 'mtn' ? 'MTN MoMo' : net === 'telecel' ? 'Telecel' : 'AT Money'}
                </button>
              ))}
            </div>

            <Input
              label="Mobile Money Number"
              type="tel"
              placeholder="024 XXX XXXX"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              helperText="You will receive a prompt on your phone to authorize"
            />
          </div>
        ) : (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 space-y-3">
            <Input
              label="Card Number"
              type="text"
              placeholder="4111 2222 3333 4444"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Expiry Date"
                placeholder="MM/YY"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(e.target.value)}
              />
              <Input
                label="CVV"
                placeholder="123"
                type="password"
                maxLength={4}
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Prototype simulation disclaimer */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
          <Shield className="w-4 h-4 text-star-gold shrink-0 mt-0.5" />
          <span>
            <strong>Prototype Demonstration:</strong> Clicking pay simulates a successful transaction without charging real money. Paystack / Hubtel live checkout will be connected on backend deployment.
          </span>
        </div>

        {/* Pay CTA */}
        <Button
          type="button"
          variant="gold"
          size="lg"
          onClick={handlePayment}
          isLoading={isProcessing}
          className="w-full text-base font-black tracking-wider uppercase shadow-2xl"
          leftIcon={<Lock className="w-4 h-4" />}
        >
          {isProcessing ? processingStep || 'Processing payment...' : `PAY ${formatCurrency(orderTotal)}`}
        </Button>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-[11px] text-zinc-500 border-t border-[#1C1C1C]">
        256-bit encrypted simulated checkout • The Republic Bar & Grill
      </footer>
    </div>
  );
}
