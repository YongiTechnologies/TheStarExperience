'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChefHat, ConciergeBell, Delete, GlassWater, Loader2, RefreshCw, Share, Smartphone } from 'lucide-react';
import {
  ApiError,
  StaffDeviceIdentity,
  describeApiError,
  forgetStaffDevice,
  getSession,
  getStaffDevice,
  getStaffPicker,
  hasValidSession,
  homeForRole,
  isUnapprovedDevice,
  loginWithPin,
  pairStaffDevice,
} from '@/lib/api';
import { isInstalledApp, isIOS } from '@/lib/push';
import { unlockSound } from '@/lib/sound';
import { StaffPickerEntry } from '@/types';

const ROLE_GROUPS: { role: StaffPickerEntry['role']; label: string; Icon: React.ElementType }[] = [
  { role: 'waiter', label: 'Waiters', Icon: ConciergeBell },
  { role: 'kitchen', label: 'Kitchen', Icon: ChefHat },
  { role: 'bar', label: 'Bar', Icon: GlassWater },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function StaffSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionEnded = searchParams.get('expired') === '1';
  // A setup link from the admin (QR code or WhatsApp) carries the device code.
  const setupCode = searchParams.get('code') ?? '';
  const [staff, setStaff] = useState<StaffPickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffPickerEntry | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  // undefined while checking; null when this browser isn't an approved staff device.
  const [device, setDevice] = useState<StaffDeviceIdentity | null | undefined>(undefined);
  const [deviceRemoved, setDeviceRemoved] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setDevice(getStaffDevice()));
  }, []);

  const deviceNoLongerApproved = useCallback(() => {
    forgetStaffDevice();
    setSelected(null);
    setDevice(null);
    setDeviceRemoved(true);
  }, []);

  // Already signed in on this device: go straight to work.
  useEffect(() => {
    const session = getSession();
    if (session && hasValidSession()) router.replace(homeForRole(session.role));
  }, [router]);

  const loadStaff = useCallback(async () => {
    setLoadError(null);
    try {
      setStaff(await getStaffPicker());
    } catch (err) {
      if (isUnapprovedDevice(err)) deviceNoLongerApproved();
      else setLoadError(describeApiError(err));
    }
  }, [deviceNoLongerApproved]);

  useEffect(() => {
    if (device) void Promise.resolve().then(loadStaff);
  }, [device, loadStaff]);

  const submit = useCallback(
    async (fullPin: string) => {
      if (!selected) return;
      setBusy(true);
      setError(null);
      void unlockSound(); // this tap counts as the gesture browsers need before playing alerts
      try {
        const session = await loginWithPin(selected.id, fullPin);
        router.replace(homeForRole(session.role));
      } catch (err) {
        if (isUnapprovedDevice(err)) {
          deviceNoLongerApproved();
          setBusy(false);
          return;
        }
        setPin('');
        setShake((n) => n + 1);
        setError(err instanceof ApiError && err.status === 401 ? 'Wrong PIN. Try again.' : describeApiError(err));
        setBusy(false);
      }
    },
    [deviceNoLongerApproved, router, selected]
  );

  const press = useCallback(
    (digit: string) => {
      if (busy || pin.length >= 4) return;
      const next = pin + digit;
      setError(null);
      setPin(next);
      if (next.length === 4) void submit(next);
    },
    [busy, pin, submit]
  );

  const erase = useCallback(() => !busy && setPin((current) => current.slice(0, -1)), [busy]);

  // Physical keyboards (tablets with keyboards, laptops at the bar).
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') erase();
      else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, press, erase]);

  return (
    <div className="min-h-screen bg-ink text-cream flex flex-col">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 flex items-center justify-between max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <img src="/assets/republic_logo.png" alt="" width={36} height={36} className="w-9 h-9 rounded-full" />
          <div className="leading-tight">
            <p className="font-stencil text-xl font-extrabold uppercase tracking-wide">The Star</p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dust">Staff sign-in</p>
          </div>
        </div>
        <Link href="/admin/login" className="text-[13px] font-semibold text-dust hover:text-cream">
          Admin
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 pb-10">
        {device === undefined ? null : device === null ? (
          <DeviceSetup
            initialCode={setupCode}
            removed={deviceRemoved}
            onReady={(approved) => {
              setDeviceRemoved(false);
              setDevice(approved);
              if (setupCode) router.replace('/staff'); // the code is spent; keep it out of the address bar
            }}
          />
        ) : (
          <>
            {sessionEnded && !selected && (
              <p className="mb-5 rounded-2xl bg-star-gold/10 ring-1 ring-star-gold/30 px-4 py-3 text-[14px] text-star-gold" role="status">
                Your session ended. Sign in again to keep receiving orders.
              </p>
            )}

            {!selected ? (
              <section aria-label="Who are you?">
                <h1 className="font-display text-[40px] leading-none font-extrabold uppercase">Who’s working?</h1>
                <p className="mt-2 text-[15px] text-dust">Tap your name, then enter your 4-digit PIN.</p>

                {loadError ? (
                  <div className="mt-10 text-center">
                    <p className="font-semibold">Couldn’t load the staff list</p>
                    <p className="mt-1 text-sm text-dust">{loadError}</p>
                    <button type="button" onClick={loadStaff} className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cream text-ink text-sm font-bold cursor-pointer">
                      <RefreshCw className="w-4 h-4" /> Try again
                    </button>
                  </div>
                ) : staff === null ? (
                  <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3" aria-hidden>
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="skeleton h-20 rounded-2xl" />
                    ))}
                  </div>
                ) : staff.length === 0 ? (
                  <p className="mt-10 text-dust">No staff accounts yet. An admin can add them under Staff.</p>
                ) : (
                  ROLE_GROUPS.map(({ role, label, Icon }) => {
                    const people = staff.filter((s) => s.role === role);
                    if (people.length === 0) return null;
                    return (
                      <div key={role} className="mt-8">
                        <h2 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-dust">
                          <Icon className="w-4 h-4 text-star-gold" /> {label}
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {people.map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => {
                                setSelected(person);
                                setPin('');
                                setError(null);
                              }}
                              className="h-20 flex items-center gap-3 rounded-2xl bg-ink-raised ring-1 ring-white/[0.07] px-4 text-left hover:ring-star-gold/50 active:scale-[0.98] transition cursor-pointer"
                            >
                              <span className="w-11 h-11 shrink-0 grid place-items-center rounded-full bg-star-gold text-ink font-display text-lg font-extrabold">
                                {initials(person.display_name)}
                              </span>
                              <span className="text-[16px] font-semibold leading-tight">{person.display_name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            ) : (
              <section aria-label={`PIN for ${selected.display_name}`} className="max-w-sm mx-auto pt-4 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="self-start inline-flex items-center gap-1.5 h-10 text-[14px] font-semibold text-dust hover:text-cream cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Not you?
                </button>
                <span className="mt-4 w-16 h-16 grid place-items-center rounded-full bg-star-gold text-ink font-display text-2xl font-extrabold">
                  {initials(selected.display_name)}
                </span>
                <p className="mt-3 text-[18px] font-semibold">{selected.display_name}</p>

                <div key={shake} className={`mt-6 flex gap-4 ${shake ? 'animate-shake' : ''}`} aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? 'bg-star-gold' : 'bg-white/15'}`}
                    />
                  ))}
                </div>
                <p className={`mt-4 min-h-5 text-[14px] ${error ? 'text-flag-red' : 'text-dust'}`} role={error ? 'alert' : undefined}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                    </span>
                  ) : (
                    error ?? 'Enter your PIN'
                  )}
                </p>

                <div className="mt-6 grid grid-cols-3 gap-3 w-full">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <KeyButton key={digit} label={digit} onPress={() => press(digit)} disabled={busy} />
                  ))}
                  <span />
                  <KeyButton label="0" onPress={() => press('0')} disabled={busy} />
                  <button
                    type="button"
                    onClick={erase}
                    disabled={busy || pin.length === 0}
                    aria-label="Delete last digit"
                    className="h-[72px] grid place-items-center rounded-2xl text-dust hover:text-cream disabled:opacity-30 cursor-pointer"
                  >
                    <Delete className="w-6 h-6" />
                  </button>
                </div>
              </section>
            )}
            {!selected && (
              <p className="mt-12 flex items-center gap-1.5 text-[12px] text-dust/70">
                <Smartphone className="w-3.5 h-3.5" /> This device: {device.name}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function formatCode(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

/** First run on a phone or tablet: enter the setup code a manager created for it. */
function DeviceSetup({
  initialCode,
  removed,
  onReady,
}: {
  initialCode: string;
  removed: boolean;
  onReady: (device: StaffDeviceIdentity) => void;
}) {
  const [code, setCode] = useState(() => formatCode(initialCode));
  // iPhone Safari keeps its storage apart from the home-screen app (and may clear it after a
  // week unused), and alerts only work in the app, so set the device up inside the app.
  const [iphoneBrowser, setIphoneBrowser] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => setIphoneBrowser(isIOS() && !isInstalledApp()));
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 9 || busy) return;
    setBusy(true);
    setError(null);
    try {
      onReady(await pairStaffDevice(code));
    } catch (err) {
      setError(describeApiError(err));
      setBusy(false);
    }
  };

  return (
    <section aria-label="Set up this device" className="max-w-md">
      <span className="w-14 h-14 grid place-items-center rounded-2xl bg-star-gold/10 ring-1 ring-star-gold/40">
        <Smartphone className="w-7 h-7 text-star-gold" />
      </span>
      <h1 className="mt-5 font-display text-[40px] leading-none font-extrabold uppercase">Set up this device</h1>
      <p className="mt-3 text-[15px] text-dust">
        {removed && <span className="text-star-gold">This device was removed from staff sign-in. </span>}
        Staff can only sign in on phones and tablets a manager has approved.
      </p>
      {iphoneBrowser && (
        <div className="mt-4 rounded-2xl bg-star-gold/10 ring-1 ring-star-gold/30 px-4 py-3 text-[14px] text-cream/90">
          <p className="font-semibold text-star-gold">On iPhone, set up in the app</p>
          <p className="mt-1">
            Tap <Share className="inline w-4 h-4 -mt-0.5" aria-label="Share" /> then <strong>Add to Home Screen</strong>, open{' '}
            <strong>Star Staff</strong> from your home screen and enter the code there
            {code.length === 9 ? (
              <>
                {' '}
                (<span className="font-mono font-bold text-star-gold">{code}</span>)
              </>
            ) : null}
            . Alerts only work in the app, and Safari can forget this setup after a week unused.
          </p>
        </div>
      )}
      {initialCode ? (
        <p className="mt-5 text-[14px] text-cream/90">Your setup code is filled in. Tap the button to finish.</p>
      ) : (
        <ol className="mt-5 space-y-2 text-[14px] text-cream/90 list-decimal pl-5">
          <li>
            A manager opens <strong>Admin → Staff → Devices</strong> and taps <strong>Add device</strong>.
          </li>
          <li>Scan its QR code, or type the code it shows here. It works once, within 15 minutes.</li>
        </ol>
      )}
      <form onSubmit={submit} className="mt-6">
        <label htmlFor="device-code" className="text-[12px] font-semibold uppercase tracking-[0.2em] text-dust">
          Setup code
        </label>
        <input
          id="device-code"
          value={code}
          onChange={(e) => {
            setError(null);
            setCode(formatCode(e.target.value));
          }}
          autoCapitalize="characters"
          autoComplete="one-time-code"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABCD-EF23"
          className="mt-2 w-full h-16 rounded-2xl bg-ink-raised ring-1 ring-white/10 focus:ring-star-gold/70 outline-none text-center font-mono text-[28px] tracking-[0.25em] uppercase placeholder:text-dust/30"
        />
        {error && (
          <p className="mt-3 text-[14px] text-flag-red" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || code.length !== 9}
          className="mt-4 w-full h-14 inline-flex items-center justify-center gap-2 rounded-2xl bg-star-gold text-ink text-[16px] font-bold disabled:opacity-40 cursor-pointer"
        >
          {busy && <Loader2 className="w-5 h-5 animate-spin" />} Set up this device
        </button>
      </form>
    </section>
  );
}

function KeyButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="h-[72px] rounded-2xl bg-ink-raised ring-1 ring-white/[0.07] font-display text-3xl font-extrabold tabular active:scale-95 active:bg-ink-high transition disabled:opacity-40 cursor-pointer"
    >
      {label}
    </button>
  );
}

export default function StaffSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <StaffSignIn />
    </Suspense>
  );
}
