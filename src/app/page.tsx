'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight, RefreshCw, WifiOff, X } from 'lucide-react';
import { MenuHero } from '@/components/customer/MenuHero';
import { CategoryNav, NavSection } from '@/components/customer/CategoryNav';
import { MenuRow, MenuRowSkeleton } from '@/components/customer/MenuRow';
import { CartBar } from '@/components/customer/CartBar';
import { CheckoutSheet } from '@/components/customer/CheckoutSheet';
import { ClientOnly } from '@/components/ClientOnly';
import { useCart } from '@/context/CartContext';
import { MenuItem, TrackedOrder } from '@/types';
import { describeApiError, getMenu, getRecentOrders, getTable, trackingPath } from '@/lib/api';

/** Menu order for a night out: signature drinks first. Unknown categories go last. */
const SECTION_ORDER: { id: MenuItem['category']; label: string }[] = [
  { id: 'cocktails', label: 'Cocktails' },
  { id: 'food', label: 'Food' },
  { id: 'beer', label: 'Beer & Cider' },
  { id: 'spirits', label: 'Spirits' },
  { id: 'wine', label: 'Wine' },
  { id: 'mocktails', label: 'Mocktails' },
  { id: 'soft-drinks', label: 'Soft Drinks' },
];

const ACTIVE_ORDER_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Pick up sold-out changes and price edits from the bar without a reload. */
const MENU_REFRESH_MS = 60 * 1000;

interface MenuSection extends NavSection {
  items: MenuItem[];
}

function groupMenu(items: MenuItem[]): MenuSection[] {
  const known = new Set<string>(SECTION_ORDER.map((s) => s.id));
  const extra = [...new Set(items.map((i) => i.category).filter((c) => !known.has(c)))].map((id) => ({
    id,
    label: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  return [...SECTION_ORDER, ...extra]
    .map(({ id, label }) => {
      // Sold-out items sink to the bottom of their section.
      const sectionItems = items
        .filter((i) => i.category === id)
        .sort((a, b) => Number(b.available) - Number(a.available));
      return { id, label, count: sectionItems.length, items: sectionItems };
    })
    .filter((s) => s.items.length > 0);
}

function OrderPageContent() {
  const searchParams = useSearchParams();
  const { tableNumber, setTableNumber, syncWithMenu } = useCart();
  const tableParam = searchParams.get('table');
  const activeTable = tableParam || tableNumber;

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tableNotFound, setTableNotFound] = useState(false);
  const [activeOrder, setActiveOrder] = useState<TrackedOrder | null>(null);
  const [soldOutNotice, setSoldOutNotice] = useState<string[]>([]);

  const [activeSection, setActiveSection] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const scrollLockUntil = useRef(0);

  // A newly scanned QR code wins over a table remembered from a past visit. Only
  // react when the URL's table changes, so a table the guest corrects at checkout sticks.
  const appliedTableParam = useRef<string | null>(null);
  useEffect(() => {
    if (tableParam && tableParam !== appliedTableParam.current) {
      appliedTableParam.current = tableParam;
      setTableNumber(tableParam);
    }
  }, [tableParam, setTableNumber]);

  useEffect(() => {
    if (!activeTable) return;
    let cancelled = false;
    getTable(activeTable)
      .then((table) => !cancelled && setTableNotFound(table === null))
      .catch(() => {
        // Network trouble shouldn't block ordering; the backend validates on submit.
      });
    return () => {
      cancelled = true;
    };
  }, [activeTable]);

  const loadMenu = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setMenu(await getMenu());
    } catch (error) {
      setLoadError(describeApiError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadMenu);
  }, [loadMenu]);

  // Quietly refresh the menu in the background and when the guest comes back to the tab.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      getMenu()
        .then((fresh) => {
          setMenu(fresh);
          setLoadError(null);
        })
        .catch(() => {
          // Keep showing the menu we have; the next refresh will try again.
        });
    };
    const timer = window.setInterval(refresh, MENU_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // Keep the cart in line with the menu: fresh prices, and nothing that has sold out.
  useEffect(() => {
    if (menu.length === 0) return;
    const dropped = syncWithMenu(menu);
    if (dropped.length > 0) void Promise.resolve().then(() => setSoldOutNotice(dropped));
  }, [menu, syncWithMenu]);

  // Link back to an order this guest placed earlier tonight at this table.
  useEffect(() => {
    void Promise.resolve().then(() => {
      const recent = getRecentOrders().find(
        (o) =>
          String(o.tableNumber) === String(activeTable) &&
          o.status !== 'completed' &&
          o.status !== 'cancelled' &&
          Date.now() - new Date(o.createdAt).getTime() < ACTIVE_ORDER_WINDOW_MS
      );
      setActiveOrder(recent ?? null);
    });
  }, [activeTable]);

  const sections = useMemo(() => groupMenu(menu), [menu]);
  const currentSection = activeSection || sections[0]?.id || '';

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return menu.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }, [menu, query]);

  // Highlight the category whose heading has scrolled under the sticky nav.
  useEffect(() => {
    if (sections.length === 0 || searchResults) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (Date.now() < scrollLockUntil.current) return;
        const navBottom = navRef.current?.getBoundingClientRect().bottom ?? 56;
        let current = sections[0].id;
        for (const section of sections) {
          const el = document.getElementById(`section-${section.id}`);
          if (el && el.getBoundingClientRect().top - navBottom <= 24) current = section.id;
        }
        setActiveSection(current);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [sections, searchResults]);

  const jumpToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    scrollLockUntil.current = Date.now() + 800;
    setActiveSection(id);
    const navHeight = navRef.current?.offsetHeight ?? 56;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - navHeight + 1, behavior: 'smooth' });
  };

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <div className="min-h-screen bg-ink text-cream">
      <MenuHero tableNumber={activeTable} />

      {activeOrder && (
        <Link href={trackingPath(activeOrder)} className="block bg-flag-green/10 border-y border-flag-green/20">
          <span className="flex items-center gap-3 max-w-2xl mx-auto px-5 py-3 text-[14px]">
          <span className="relative flex w-2 h-2" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-flag-green animate-live-ring" />
            <span className="relative w-2 h-2 rounded-full bg-flag-green" />
          </span>
          <span className="font-semibold">Order #{activeOrder.id} is in progress</span>
          <span className="ml-auto flex items-center text-flag-green font-semibold">
            Track <ChevronRight className="w-4 h-4" />
          </span>
          </span>
        </Link>
      )}

      {tableNotFound && (
        <div className="bg-flag-red/10 border-y border-flag-red/20">
          <p className="max-w-2xl mx-auto px-5 py-3 text-[13px] text-cream/90">
            We couldn’t find table {activeTable}. You can still order; we’ll ask for your table at checkout.
          </p>
        </div>
      )}

      <CategoryNav
        ref={navRef}
        sections={sections}
        activeId={currentSection}
        onSelect={jumpToSection}
        query={query}
        onQueryChange={setQuery}
        isSearching={isSearching}
        onSearchingChange={setIsSearching}
      />

      <main className="max-w-2xl mx-auto px-5 pb-36">
        {soldOutNotice.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-flag-red/10 ring-1 ring-flag-red/25 px-4 py-3 text-[13px]" role="status">
            <p className="flex-1">
              <span className="font-semibold">{soldOutNotice.join(', ')}</span>{' '}
              {soldOutNotice.length === 1 ? 'just sold out and was' : 'just sold out and were'} removed from your order.
            </p>
            <button type="button" onClick={() => setSoldOutNotice([])} aria-label="Dismiss" className="text-dust cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {isLoading ? (
          <ul className="divide-y divide-white/[0.06] pt-2">
            {Array.from({ length: 6 }, (_, i) => (
              <MenuRowSkeleton key={i} />
            ))}
          </ul>
        ) : loadError ? (
          <div className="py-16 text-center">
            <WifiOff className="mx-auto w-8 h-8 text-dust" />
            <p className="mt-3 font-semibold">The menu didn’t load</p>
            <p className="mt-1 text-sm text-dust max-w-xs mx-auto">{loadError}</p>
            <button
              type="button"
              onClick={loadMenu}
              className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cream text-ink text-sm font-bold cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        ) : searchResults ? (
          <section className="pt-4">
            <p className="text-[13px] text-dust">
              {searchResults.length === 0
                ? `Nothing matches “${query.trim()}”.`
                : `${searchResults.length} ${searchResults.length === 1 ? 'result' : 'results'}`}
            </p>
            <ul className="divide-y divide-white/[0.06]">
              {searchResults.map((item) => (
                <MenuRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        ) : sections.length === 0 ? (
          <p className="py-16 text-center text-sm text-dust">The menu is empty right now. Please ask a member of staff.</p>
        ) : (
          sections.map((section) => (
            <section key={section.id} id={`section-${section.id}`} aria-labelledby={`heading-${section.id}`} className="pt-7">
              <div className="flex items-baseline justify-between">
                <h2
                  id={`heading-${section.id}`}
                  className="font-display text-[34px] leading-none font-extrabold uppercase tracking-wide"
                >
                  {section.label}
                </h2>
                <span className="text-[12px] text-dust tabular">{section.count}</span>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {section.items.map((item) => (
                  <MenuRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))
        )}

        <footer className="mt-14 pt-6 border-t border-white/[0.06] text-center text-[12px] text-dust/70 space-y-2">
          <p>The Republic Bar &amp; Grill · Osu, Accra</p>
          <Link href="/admin/login" className="inline-block underline-offset-4 hover:underline">
            Staff login
          </Link>
        </footer>
      </main>

      <CartBar onOpen={() => setSheetOpen(true)} />
      {sheetOpen && <CheckoutSheet onClose={closeSheet} tableNeedsConfirming={tableNotFound} />}
    </div>
  );
}

function MenuShell() {
  return (
    <div className="min-h-screen bg-ink" aria-busy="true">
      <div className="h-[268px] bg-ink-raised" />
      <div className="h-14 border-b border-white/[0.06]" />
      <ul className="max-w-2xl mx-auto px-5 divide-y divide-white/[0.06] pt-2">
        {Array.from({ length: 5 }, (_, i) => (
          <MenuRowSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

export default function OrderPage() {
  // The table comes from the URL and the cart from localStorage, so render in the browser only.
  return (
    <ClientOnly fallback={<MenuShell />}>
      <Suspense fallback={<MenuShell />}>
        <OrderPageContent />
      </Suspense>
    </ClientOnly>
  );
}
