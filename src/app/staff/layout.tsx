import type { Metadata, Viewport } from 'next';
import { StaffGuard } from '@/components/staff/StaffGuard';

export const metadata: Metadata = {
  title: 'Staff | The Star Experience',
  robots: { index: false, follow: false },
  // Installable as its own app: iPhones only deliver web push to apps added to the home screen.
  manifest: '/staff.webmanifest',
  appleWebApp: { capable: true, title: 'Star Staff', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/staff-apple-180.png' },
};

export const viewport: Viewport = {
  themeColor: '#0C0B09',
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffGuard>{children}</StaffGuard>;
}
