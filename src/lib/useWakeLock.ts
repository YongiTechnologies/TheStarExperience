'use client';

import { useEffect } from 'react';

/**
 * Keep the screen on while a station board is open (where the browser allows it),
 * so a kitchen or bar tablet doesn't go to sleep and miss new tickets. The lock is
 * dropped whenever the tab is hidden, so it's requested again on return.
 */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const request = async () => {
      if (stopped || sentinel || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (stopped) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        // Refused (e.g. battery saver) or unsupported: the board still works, the screen may sleep.
      }
    };

    void request();
    const onVisible = () => void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
}
