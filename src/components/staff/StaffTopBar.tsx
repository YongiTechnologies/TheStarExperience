'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coffee, LogOut, VolumeX } from 'lucide-react';
import { getSession, signOutStaff } from '@/lib/api';
import { disablePush } from '@/lib/push';
import { soundUnlocked, unlockSound } from '@/lib/sound';
import { ShiftStatus } from '@/types';

interface StaffTopBarProps {
  title: string;
  subtitle?: string;
  connected: boolean;
  shift?: ShiftStatus;
  onShiftChange?: (shift: ShiftStatus) => void;
  /** Station boards use the full tablet width. */
  wide?: boolean;
}

/** Shared header for waiter, kitchen and bar screens. */
export function StaffTopBar({ title, subtitle, connected, shift, onShiftChange, wide = false }: StaffTopBarProps) {
  const router = useRouter();
  const [soundOn, setSoundOn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Any tap unlocks alert sounds (browsers require a gesture first). Phones suspend
  // audio when the screen locks, so every tap re-arms it and returning re-checks it.
  useEffect(() => {
    const sync = () => setSoundOn(soundUnlocked());
    void Promise.resolve().then(() => {
      sync();
      setIsAdmin(getSession()?.role === 'admin');
    });
    const unlock = () => {
      if (!soundUnlocked()) void unlockSound().then(setSoundOn);
    };
    window.addEventListener('pointerdown', unlock);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const signOut = async () => {
    await disablePush(); // before the session goes: the server needs it to drop this phone's alerts
    await signOutStaff();
    router.replace('/staff');
  };

  return (
    <header className="sticky top-0 z-30 bg-ink/90 backdrop-blur-xl border-b border-white/[0.06]">
      <div className={`${wide ? 'max-w-[1400px]' : 'max-w-5xl'} mx-auto px-4 h-16 flex items-center gap-3`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] leading-none font-extrabold uppercase truncate">{title}</h1>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-flag-green' : 'bg-dust/50'}`}
              title={connected ? 'Live: updates arrive instantly' : 'Reconnecting… (refreshing every few seconds)'}
              aria-label={connected ? 'Live' : 'Reconnecting'}
            />
          </div>
          {subtitle && <p className="text-[12px] text-dust truncate">{subtitle}</p>}
        </div>

        {!soundOn && (
          <button
            type="button"
            onClick={() => void unlockSound().then(setSoundOn)}
            aria-label="Turn on alert sounds"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-star-gold/10 text-star-gold ring-1 ring-star-gold/40 text-[12px] font-semibold cursor-pointer animate-gold-pulse"
          >
            <VolumeX className="w-4 h-4" /> <span className="hidden sm:inline">Turn on sound</span>
          </button>
        )}

        {shift && onShiftChange && (
          <button
            type="button"
            onClick={() => onShiftChange(shift === 'on_break' ? 'on_shift' : 'on_break')}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold ring-1 cursor-pointer ${
              shift === 'on_break'
                ? 'bg-star-gold text-ink ring-star-gold'
                : 'text-cream ring-white/15 hover:ring-white/30'
            }`}
          >
            <Coffee className="w-4 h-4" />
            {shift === 'on_break' ? 'End break' : 'Break'}
          </button>
        )}

        {isAdmin && (
          <Link
            href="/admin/floor"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold text-cream ring-1 ring-white/15 hover:ring-white/30"
          >
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
        )}

        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out (ends your shift)"
          className="w-9 h-9 grid place-items-center rounded-full text-dust hover:text-cream hover:bg-white/5 cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
