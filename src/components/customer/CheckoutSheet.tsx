'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Check, CreditCard, Lock, MessageSquare, Pencil, Plus, Smartphone, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { ApiError, createOrder, describeApiError, payForOrder, saveRecentOrder, trackingPath } from '@/lib/api';
import { getMenuImage } from '@/data/menu';
import { TrackedOrder } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  MOMO_NETWORKS,
  MomoNetwork,
  detectMomoNetwork,
  formatGhanaPhone,
  isValidGhanaPhone,
  normalizeGhanaPhone,
} from '@/lib/momo';
import { Stepper, haptic } from './Stepper';

interface CheckoutSheetProps {
  onClose: () => void;
  /** True when the table from the QR code could not be found, so the guest must confirm it. */
  tableNeedsConfirming: boolean;
}

type Stage = 'review' | 'processing' | 'success';
type FieldErrors = Partial<Record<'name' | 'phone' | 'table' | 'momo', string>>;

/** The backend stores up to 300 characters per note. */
const NOTE_LIMIT = 300;
/** Common requests guests can add with one tap instead of typing. */
const NOTE_PICKS = ['No ice', 'Less ice', 'Extra spicy', 'Not spicy', 'Extra glasses'];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Random id for this checkout. Unlike crypto.randomUUID it also works on plain-http hosts. */
function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Short stable hash (FNV-1a) so a changed order gets a different idempotency key. */
function contentHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * The whole checkout in one sheet: review items, confirm who/where, pick how to
 * pay, and pay. Returning guests see their saved details and only tap Pay.
 * Mount it only while open so it always starts from the latest saved details.
 */
export function CheckoutSheet({ onClose, tableNeedsConfirming }: CheckoutSheetProps) {
  const router = useRouter();
  const {
    items,
    subtotal,
    updateQuantity,
    clearCart,
    tableNumber,
    setTableNumber,
    customerInfo,
    setCustomerInfo,
    orderNotes,
    setOrderNotes,
  } = useCart();

  const hasSavedDetails = Boolean(customerInfo.name.trim() && isValidGhanaPhone(customerInfo.phone));

  const [stage, setStage] = useState<Stage>('review');
  const [processingStep, setProcessingStep] = useState(0);
  const [editingDetails, setEditingDetails] = useState(!hasSavedDetails);
  const [name, setName] = useState(customerInfo.name);
  const [phone, setPhone] = useState(customerInfo.phone ? formatGhanaPhone(customerInfo.phone) : '');
  const [table, setTable] = useState(tableNumber);
  const [method, setMethod] = useState<'momo' | 'card'>('momo');
  const [networkOverride, setNetworkOverride] = useState<MomoNetwork | null>(null);
  // Identifies this checkout so retrying after a dropped connection can't create a second order.
  const [checkoutId] = useState(randomId);
  const [demoPayment, setDemoPayment] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(Boolean(orderNotes));
  // Set once the order exists on the backend. If payment then fails, the sheet
  // locks the order and Pay only retries the payment (never a duplicate order).
  const [placedOrder, setPlacedOrder] = useState<TrackedOrder | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const noteParts = orderNotes.split(',').map((part) => part.trim()).filter(Boolean);
  const hasPick = (pick: string) => noteParts.some((part) => part.toLowerCase() === pick.toLowerCase());
  const togglePick = (pick: string) => {
    const next = hasPick(pick)
      ? noteParts.filter((part) => part.toLowerCase() !== pick.toLowerCase())
      : [...noteParts, pick];
    setOrderNotes(next.join(', ').slice(0, NOTE_LIMIT));
    haptic();
  };
  const askForTable = !tableNumber || tableNeedsConfirming;
  const detectedNetwork = detectMomoNetwork(phone);
  const network = networkOverride ?? detectedNetwork;

  // Once the order exists, show exactly what was placed: the live cart can still
  // change underneath (menu refresh, sold-out items, price edits).
  const lines = placedOrder
    ? placedOrder.items.map((line) => ({ ...line, image: getMenuImage(line.name) }))
    : items.map(({ item, quantity }) => ({ id: item.id, name: item.name, price: item.price, quantity, image: item.image }));
  const lineCount = lines.reduce((count, line) => count + line.quantity, 0);
  const orderTotal = placedOrder ? placedOrder.total : subtotal;

  const close = () => {
    if (stage !== 'review') return;
    if (placedOrder) {
      // The order already reached the bar; carry on from its tracking page.
      router.push(trackingPath(placedOrder));
      clearCart();
      return;
    }
    onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  // Lock page scroll and support Escape while the sheet is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!placedOrder) {
      if (name.trim().length < 2) next.name = 'Enter your name so staff can find you';
      if (!isValidGhanaPhone(phone)) next.phone = 'Enter a 10-digit number, e.g. 024 412 3456';
      if (askForTable && !table.trim()) next.table = 'Enter the number on your table';
    }
    if (method === 'momo' && !network) next.momo = 'Choose your MoMo network';
    return next;
  };

  // After the first Pay attempt, errors track the fields live and clear as they're fixed.
  const errors: FieldErrors = showErrors ? validate() : {};

  const handlePay = async () => {
    setSubmitError(null);
    const found = validate();
    setShowErrors(true);
    if (Object.keys(found).length > 0) {
      if (found.name || found.phone) setEditingDetails(true);
      // Bring the first problem into view once the fields have rendered.
      requestAnimationFrame(() => {
        sheetRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    haptic();
    setStage('processing');
    setProcessingStep(0);

    let order = placedOrder;
    try {
      if (!order) {
        const resolvedTable = askForTable ? table.trim() : tableNumber;
        const contactPhone = normalizeGhanaPhone(phone);
        setTableNumber(resolvedTable);
        setCustomerInfo({ name: name.trim(), phone: contactPhone, tableNumber: resolvedTable });
        if (resolvedTable !== tableNumber) {
          // Keep the URL in step with the corrected table so the QR code's number can't override it.
          router.replace(`/order?table=${encodeURIComponent(resolvedTable)}`, { scroll: false });
        }
        const orderLines = items.map((ci) => ({
          id: ci.item.id,
          name: ci.item.name,
          price: ci.item.price,
          quantity: ci.quantity,
          category: ci.item.category,
        }));
        const notes = orderNotes.trim() || undefined;
        order = await createOrder({
          tableNumber: resolvedTable,
          customerName: name.trim(),
          phone: contactPhone,
          items: orderLines,
          notes,
          // Same checkout + same contents = same key, so a retry returns the original order.
          idempotencyKey: `${checkoutId}-${contentHash(
            JSON.stringify([resolvedTable, name.trim(), contactPhone, notes, orderLines.map((l) => [l.id, l.quantity])])
          )}`,
        });
        setPlacedOrder(order);
        saveRecentOrder(order);
      }

      // Brief pause so each step is readable; a real provider's prompt takes longer.
      await wait(700);
      setProcessingStep(1);
      const momoNetwork = method === 'momo' ? network ?? undefined : undefined;
      const payment = await payForOrder(order, method, momoNetwork);
      const paidOrder: TrackedOrder = {
        ...order,
        paymentStatus: payment.status === 'paid' ? 'paid' : 'pending',
        paymentMethod: method,
        momoNetwork,
        paymentProvider: payment.provider ?? undefined,
      };
      saveRecentOrder(paidOrder);
      setDemoPayment(payment.provider === 'demo');

      setStage('success');
      haptic();
      await wait(1000);
      router.push(trackingPath(paidOrder));
      clearCart();
    } catch (error) {
      setStage('review');
      setSubmitError(
        order
          ? `Order #${order.id} reached the bar, but the payment didn’t go through (${describeApiError(error)}). Tap Pay to try again.`
          : error instanceof ApiError && error.status === 0
            ? 'The connection dropped while sending your order, so we can’t tell if it reached the bar. Tap Pay to try again: it won’t be sent twice.'
            : `${describeApiError(error)} Your order hasn’t been placed.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Your order">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] animate-fade-in" onClick={close} />

      <div
        ref={sheetRef}
        className="relative w-full sm:max-w-md max-h-[92dvh] flex flex-col bg-ink-raised text-cream rounded-t-[28px] sm:rounded-[28px] ring-1 ring-white/[0.07] shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.8)] animate-sheet-in overflow-hidden"
      >
        {stage === 'review' ? (
          <>
            {/* Header */}
            <div className="shrink-0 px-5 pt-3 pb-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-[28px] leading-none font-extrabold uppercase tracking-wide">Your order</h2>
                  <p className="mt-1 text-[13px] text-dust">
                    {tableNumber && !tableNeedsConfirming ? `Delivered to Table ${tableNumber}` : 'Delivered to your table'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="w-10 h-10 grid place-items-center rounded-full bg-white/5 hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="px-5 pb-10 pt-6 text-center">
                <p className="font-semibold">Nothing here yet</p>
                <p className="mt-1 text-sm text-dust">Tap + on anything on the menu to add it.</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cream text-ink text-sm font-bold cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to menu
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4 space-y-6">
                  {placedOrder && (
                    <p className="rounded-2xl bg-flag-green/10 ring-1 ring-flag-green/25 px-4 py-3 text-[13px]">
                      <span className="font-semibold">Order #{placedOrder.id} is with the bar.</span> Finish paying below.
                    </p>
                  )}

                  {/* Items */}
                  <section>
                    <ul className="divide-y divide-white/[0.06]">
                      {lines.map((line) => (
                        <li key={line.id} className="flex items-center gap-3 py-3">
                          <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_70%,#30291c_0%,#1b1813_70%)]">
                            {line.image && <img src={line.image} alt="" className="max-h-9 max-w-10 object-contain" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold leading-tight truncate">{line.name}</p>
                            <p className="mt-0.5 font-display text-base font-bold text-star-gold tabular">
                              {formatCurrency(line.price * line.quantity)}
                            </p>
                          </div>
                          {placedOrder ? (
                            <span className="font-display text-lg font-extrabold tabular text-cream">{line.quantity}×</span>
                          ) : (
                            <Stepper
                              tone="quiet"
                              quantity={line.quantity}
                              label={line.name}
                              onIncrease={() => updateQuantity(line.id, line.quantity + 1)}
                              onDecrease={() => updateQuantity(line.id, line.quantity - 1)}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                    {!placedOrder && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-star-gold cursor-pointer"
                      >
                        <Plus className="w-4 h-4" strokeWidth={2.75} /> Add more
                      </button>
                    )}
                  </section>

                  {/* The order's contents, note and details are fixed once it reaches the bar. */}
                  {!placedOrder && (
                    <>
                      {/* Note for the bar */}
                      <section>
                        {notesOpen ? (
                          <div className="animate-fade-in">
                            <label htmlFor="order-note" className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-dust">
                              Note for the bar
                            </label>
                            <div className="mb-2.5 flex flex-wrap gap-2" aria-label="Quick notes">
                              {NOTE_PICKS.map((pick) => {
                                const selected = hasPick(pick);
                                return (
                                  <button
                                    key={pick}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => togglePick(pick)}
                                    className={`h-9 px-3.5 rounded-full text-[13px] font-semibold ring-1 transition-colors cursor-pointer ${
                                      selected ? 'bg-star-gold/15 text-star-gold ring-star-gold/60' : 'text-dust ring-white/10'
                                    }`}
                                  >
                                    {selected && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" strokeWidth={3} />}
                                    {pick}
                                  </button>
                                );
                              })}
                            </div>
                            <textarea
                              id="order-note"
                              rows={2}
                              maxLength={NOTE_LIMIT}
                              value={orderNotes}
                              onChange={(e) => setOrderNotes(e.target.value)}
                              placeholder="Anything else? e.g. shito on the side"
                              className="w-full resize-none rounded-xl bg-ink-high px-4 py-3 text-base text-cream placeholder:text-dust/50 outline-none ring-1 ring-white/[0.08] focus:ring-star-gold/70"
                            />
                            <p className="mt-1 flex justify-between text-[12px] text-dust">
                              <span>Sent straight to the bar with your order</span>
                              {orderNotes.length > NOTE_LIMIT - 60 && (
                                <span className="tabular">{NOTE_LIMIT - orderNotes.length} left</span>
                              )}
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setNotesOpen(true)}
                            className="w-full h-12 flex items-center gap-3 rounded-2xl bg-ink-high ring-1 ring-white/[0.06] px-4 text-left cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4 text-star-gold shrink-0" />
                            <span className="text-[14px] font-semibold">Add a note for the bar</span>
                            <span className="ml-auto text-[12px] text-dust truncate">No ice, spicy…</span>
                          </button>
                        )}
                      </section>

                      {/* Who & where */}
                      <section>
                        <SectionLabel>Your details</SectionLabel>
                        {editingDetails ? (
                          <div className="space-y-3">
                            <Field
                              label="Name"
                              error={errors.name}
                              input={{
                                value: name,
                                onChange: (e) => setName(e.target.value),
                                autoComplete: 'name',
                                autoCapitalize: 'words',
                                placeholder: 'e.g. Ama Mensah',
                                enterKeyHint: 'next',
                              }}
                            />
                            <Field
                              label="Phone"
                              hint="Staff use this if they can’t find you"
                              error={errors.phone}
                              input={{
                                value: phone,
                                onChange: (e) => setPhone(e.target.value),
                                type: 'tel',
                                inputMode: 'tel',
                                autoComplete: 'tel-national',
                                placeholder: '024 412 3456',
                                onBlur: () => isValidGhanaPhone(phone) && setPhone(formatGhanaPhone(phone)),
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-high ring-1 ring-white/[0.06] px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold truncate">{name}</p>
                              <p className="text-[13px] text-dust tabular">{formatGhanaPhone(phone)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingDetails(true)}
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/5 text-[13px] font-semibold cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Change
                            </button>
                          </div>
                        )}

                        {askForTable && (
                          <div className="mt-3">
                            <Field
                              label="Table number"
                              hint={tableNeedsConfirming ? `We couldn’t find table ${tableNumber}. Check the card on your table.` : 'It’s on the card on your table'}
                              error={errors.table}
                              input={{
                                value: table,
                                onChange: (e) => setTable(e.target.value.replace(/\D/g, '')),
                                inputMode: 'numeric',
                                placeholder: 'e.g. 7',
                              }}
                            />
                          </div>
                        )}
                      </section>

                    </>
                  )}

                  {/* Payment */}
                  <section>
                    <SectionLabel>Pay with</SectionLabel>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-ink-high ring-1 ring-white/[0.06]" role="radiogroup" aria-label="Payment method">
                      {(
                        [
                          { id: 'momo', label: 'Mobile Money', Icon: Smartphone },
                          { id: 'card', label: 'Card', Icon: CreditCard },
                        ] as const
                      ).map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={method === id}
                          onClick={() => setMethod(id)}
                          className={`h-11 flex items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-colors cursor-pointer ${
                            method === id ? 'bg-cream text-ink' : 'text-dust'
                          }`}
                        >
                          <Icon className="w-4 h-4" /> {label}
                        </button>
                      ))}
                    </div>

                    {method === 'momo' ? (
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="MoMo network">
                          {(Object.keys(MOMO_NETWORKS) as MomoNetwork[]).map((id) => {
                            const selected = network === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => setNetworkOverride(id)}
                                className={`h-9 px-3.5 rounded-full text-[13px] font-semibold ring-1 transition-colors cursor-pointer ${
                                  selected ? 'bg-star-gold/15 text-star-gold ring-star-gold/60' : 'text-dust ring-white/10'
                                }`}
                              >
                                {selected && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" strokeWidth={3} />}
                                {MOMO_NETWORKS[id].label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[13px] text-dust">
                          {isValidGhanaPhone(phone) ? (
                            <>
                              MoMo number <span className="text-cream font-semibold tabular">{formatGhanaPhone(phone)}</span>
                              {detectedNetwork && !networkOverride && ' · network detected from it'}
                            </>
                          ) : (
                            'Uses the phone number in your details'
                          )}
                        </p>
                        {errors.momo && <p className="text-[13px] text-flag-red">{errors.momo}</p>}
                      </div>
                    ) : (
                      <p className="mt-3 text-[13px] text-dust">Visa and Mastercard. You’ll confirm the payment securely.</p>
                    )}
                  </section>

                  {/* Totals */}
                  <section className="rounded-2xl bg-ink-high/60 ring-1 ring-white/[0.05] px-4 py-3 space-y-1.5 text-[14px]">
                    <div className="flex justify-between text-dust">
                      <span>{lineCount} {lineCount === 1 ? 'item' : 'items'}</span>
                      <span className="tabular">{formatCurrency(orderTotal)}</span>
                    </div>
                    <div className="flex justify-between text-dust">
                      <span>Table service</span>
                      <span className="text-flag-green font-semibold">Free</span>
                    </div>
                  </section>
                </div>

                {/* Pay */}
                <div className="shrink-0 px-5 pt-3 pb-safe border-t border-white/[0.06] bg-ink-raised">
                  {submitError && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl bg-flag-red/10 ring-1 ring-flag-red/30 px-3 py-2.5 text-[13px] text-cream" role="alert">
                      <AlertCircle className="w-4 h-4 text-flag-red shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handlePay}
                    className="w-full h-14 flex items-center justify-center gap-2.5 rounded-[18px] bg-star-gold text-ink text-[16px] font-bold shadow-[0_14px_36px_-12px_rgba(248,213,14,0.6)] active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <Lock className="w-4 h-4" strokeWidth={2.75} />
                    Pay <span className="font-display text-2xl font-extrabold tabular">{formatCurrency(orderTotal)}</span>
                  </button>
                  <p className="mt-2 text-center text-[11px] text-dust/80">Demo checkout · no money is charged</p>
                </div>
              </>
            )}
          </>
        ) : (
          <PaymentProgress stage={stage} step={processingStep} amount={orderTotal} demo={demoPayment} />
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-dust">{children}</h3>;
}

function Field({
  label,
  hint,
  error,
  input,
}: {
  label: string;
  hint?: string;
  error?: string;
  input: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-cream/90 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={`${id}-msg`}
        {...input}
        className={`w-full h-12 rounded-xl bg-ink-high px-4 text-base text-cream placeholder:text-dust/50 outline-none ring-1 transition-shadow ${
          error ? 'ring-flag-red/70' : 'ring-white/[0.08] focus:ring-star-gold/70'
        }`}
      />
      {(error || hint) && (
        <p id={`${id}-msg`} className={`mt-1.5 text-[12px] ${error ? 'text-flag-red' : 'text-dust'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

function PaymentProgress({ stage, step, amount, demo }: { stage: Stage; step: number; amount: number; demo: boolean }) {
  const done = stage === 'success';
  const title = done ? (demo ? 'Sent to the bar' : 'Paid. Sent to the bar.') : step === 0 ? 'Sending your order…' : 'Confirming payment…';

  return (
    <div className="px-6 pt-12 pb-safe flex flex-col items-center text-center" aria-live="polite">
      <div className="relative w-24 h-24 grid place-items-center">
        {!done && <span className="absolute inset-0 rounded-full ring-2 ring-star-gold/40 animate-halo" />}
        <div
          className={`relative w-24 h-24 grid place-items-center rounded-full transition-colors duration-300 ${
            done ? 'bg-flag-green text-ink' : 'bg-star-gold/15 text-star-gold ring-1 ring-star-gold/40'
          }`}
        >
          {done ? (
            <svg viewBox="0 0 24 24" className="w-11 h-11" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" className="animate-draw" />
            </svg>
          ) : (
            <Smartphone className="w-10 h-10" />
          )}
        </div>
      </div>

      <h2 className="mt-6 font-display text-[30px] leading-none font-extrabold uppercase">{title}</h2>
      <p className="mt-2 text-sm text-dust">
        <span className="font-display text-lg font-bold text-cream tabular">{formatCurrency(amount)}</span>
        {done ? (demo ? ' · demo payment recorded, nothing was charged' : ' · opening your live order') : ' · keep this screen open'}
      </p>

      <div className="mt-8 mb-10 h-1 w-48 rounded-full bg-white/10 overflow-hidden">
        {done ? (
          <div className="h-full w-full bg-flag-green" />
        ) : (
          <div className="h-full w-1/2 rounded-full bg-star-gold animate-progress-sweep" />
        )}
      </div>
    </div>
  );
}
