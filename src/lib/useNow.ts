'use client';

import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` so "waiting 4 min" labels stay current. */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Minutes since `iso` (0 if missing or in the future). */
export function minutesSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** "now", "4 min", "1 h 05". */
export function formatAge(iso: string | null | undefined, now: number): string {
  const minutes = minutesSince(iso, now);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}
