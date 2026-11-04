import { redirect } from 'next/navigation';

/**
 * The menu lives at "/". Keep old links and table QR codes ("/order?table=7") working,
 * table number included.
 */
export default async function OrderRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { table } = await searchParams;
  const tableNumber = Array.isArray(table) ? table[0] : table;
  redirect(tableNumber ? `/?table=${encodeURIComponent(tableNumber)}` : '/');
}
