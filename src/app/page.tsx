import { redirect } from 'next/navigation';

/**
 * Table QR codes may point at "/?table=7". Guests go straight to the menu so
 * ordering starts on the first screen, with no welcome page or form in the way.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { table } = await searchParams;
  const tableNumber = Array.isArray(table) ? table[0] : table;
  redirect(tableNumber ? `/order?table=${encodeURIComponent(tableNumber)}` : '/order');
}
