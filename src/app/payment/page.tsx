import { redirect } from 'next/navigation';

/** Payment now happens in the checkout sheet on the menu; keep old links working. */
export default function PaymentPage() {
  redirect('/order');
}
