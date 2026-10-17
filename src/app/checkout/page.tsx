import { redirect } from 'next/navigation';

/** Checkout now happens in a sheet on the menu; keep old links working. */
export default function CheckoutPage() {
  redirect('/order');
}
