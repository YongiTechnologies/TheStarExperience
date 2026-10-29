'use client';

import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, Share, X } from 'lucide-react';
import { ApiError, describeApiError } from '@/lib/api';
import { PushState, enablePush, pushState, refreshPush } from '@/lib/push';

const LATER_KEY = 'star_experience_push_later';

/** Invites a waiter to turn on alerts that reach their phone with the screen locked. */
export function PushPrompt({ onEnabled }: { onEnabled?: () => void }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [later, setLater] = useState(false);
  const [slow, setSlow] = useState(false);

  // The first subscription on a phone can take a while (the browser registers with its push service).
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setSlow(true), 5000);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [busy]);

  useEffect(() => {
    let cancelled = false;
    void pushState().then((current) => {
      if (cancelled) return;
      setState(current);
      // Already on: make sure the server sends this phone's alerts to whoever is signed in now.
      if (current === 'on') void refreshPush().catch(() => undefined);
      try {
        setLater(sessionStorage.getItem(LATER_KEY) === '1');
      } catch {
        // Storage unavailable: always show.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await enablePush();
      setState(next);
      if (next === 'on') onEnabled?.();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? describeApiError(err)
          : 'This browser couldn’t turn alerts on. Private or incognito windows can’t get them: open the page in a normal window and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const remindLater = () => {
    setLater(true);
    try {
      sessionStorage.setItem(LATER_KEY, '1');
    } catch {
      // Storage unavailable: hidden until the page reloads.
    }
  };

  if (!state || later || state === 'on' || state === 'off' || state === 'unsupported') return null;

  return (
    <div className="mt-4 relative rounded-2xl bg-ink-raised ring-1 ring-star-gold/40 px-4 py-3.5 animate-rise">
      <button
        type="button"
        onClick={remindLater}
        aria-label="Remind me later"
        className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full text-dust hover:text-cream cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <BellRing className="w-5 h-5 text-star-gold shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Alerts with your phone locked</p>
          {state === 'default' && (
            <>
              <p className="mt-0.5 text-[13px] text-dust">New orders and orders ready to serve will buzz your phone even when the screen is off.</p>
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-star-gold text-ink text-[14px] font-bold disabled:opacity-60 cursor-pointer"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} Turn on alerts
              </button>
              {slow && (
                <p className="mt-2 text-[12px] text-dust" role="status">
                  Still setting up. The first time can take up to a minute; you can keep working meanwhile.
                </p>
              )}
            </>
          )}
          {state === 'needs-install' && (
            <p className="mt-0.5 text-[13px] text-dust">
              On iPhone, tap <Share className="inline w-3.5 h-3.5 -mt-0.5" aria-label="Share" /> then <strong className="text-cream">Add to Home Screen</strong>.
              Open <strong className="text-cream">Star Staff</strong> from your home screen and turn alerts on there.
            </p>
          )}
          {state === 'denied' && (
            <p className="mt-0.5 text-[13px] text-dust">
              Notifications are blocked for this site. Allow them in your browser’s site settings, then reload this page.
            </p>
          )}
          {error && <p className="mt-2 text-[13px] text-flag-red" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
