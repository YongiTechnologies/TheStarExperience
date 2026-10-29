import type { Metadata, Viewport } from 'next';
import { Big_Shoulders, Big_Shoulders_Stencil, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { GlobalBackground } from '@/components/GlobalBackground';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
});

// next/font has no fallback metrics for the Big Shoulders family, so skip the
// automatic fallback adjustment rather than log a failure on every build.
const shoulders = Big_Shoulders({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-shoulders',
  adjustFontFallback: false,
});

const stencil = Big_Shoulders_Stencil({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-stencil-face',
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'The Star Experience | Kwesi Dain Live at The Republic Bar & Grill',
  description:
    'Mobile-first food and drink ordering for The Star Experience by Kwesi Dain at The Republic Bar and Grill, Osu, Accra, Ghana (3rd December).',
  keywords: ['The Star Experience', 'Kwesi Dain', 'The Republic Bar', 'Osu Accra', 'Food and Drink Order'],
  appleWebApp: {
    capable: true,
    title: 'The Star Experience',
    statusBarStyle: 'black-translucent',
  },
};

// Pinch-zoom stays enabled for accessibility; inputs use 16px text so iOS
// does not auto-zoom on focus.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0C0B09',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark bg-[#0A0A0A] ${bricolage.variable} ${shoulders.variable} ${stencil.variable}`}
    >
      <body className="min-h-screen bg-[#0A0A0A] text-white antialiased selection:bg-star-gold selection:text-black">
        <GlobalBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
