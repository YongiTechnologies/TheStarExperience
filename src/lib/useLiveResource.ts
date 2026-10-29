'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeApiError } from '@/lib/api';
import { useLiveUpdates } from '@/lib/useLiveUpdates';
import { LiveEvent } from '@/types';

interface LiveResourceOptions<T> {
  /** Safety-net refresh interval while the live stream is down, and while it's up. */
  pollMs?: number;
  livePollMs?: number;
  /** Called with each fresh copy and the one it replaces (null on the first load), e.g. to chime. */
  onUpdate?: (next: T, previous: T | null) => void;
  /** Which live events should trigger a refresh (default: all of them). */
  filter?: (event: LiveEvent) => boolean;
}

/**
 * Data for a staff screen that stays current on its own: loads once, re-fetches
 * when a live event arrives (debounced), when the tab becomes visible again, and
 * on a timer in case the stream is down. Stale responses never overwrite newer ones.
 */
export function useLiveResource<T>(fetcher: () => Promise<T>, options: LiveResourceOptions<T> = {}) {
  const { pollMs = 15000, livePollMs = 60000 } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<T | null>(null);
  const sequence = useRef(0);
  const debounce = useRef<number | undefined>(undefined);
  const fetcherRef = useRef(fetcher);
  const optionsRef = useRef(options);

  useEffect(() => {
    fetcherRef.current = fetcher;
    optionsRef.current = options;
  });

  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    try {
      const next = await fetcherRef.current();
      if (id !== sequence.current) return;
      optionsRef.current.onUpdate?.(next, latest.current);
      latest.current = next;
      setData(next);
      setError(null);
    } catch (err) {
      if (id !== sequence.current) return;
      if (err instanceof ApiError && err.status === 401) return; // the guard sends them to sign in
      setError(describeApiError(err));
    }
  }, []);

  const refreshSoon = useCallback(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => void refresh(), 250);
  }, [refresh]);

  const connected = useLiveUpdates((event) => {
    const filter = optionsRef.current.filter;
    if (!filter || filter(event)) refreshSoon();
  });

  useEffect(() => {
    void Promise.resolve().then(refresh);
    return () => window.clearTimeout(debounce.current);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), connected ? livePollMs : pollMs);
    return () => window.clearInterval(timer);
  }, [connected, livePollMs, pollMs, refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshSoon();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshSoon]);

  /** Apply a change locally (e.g. an action's response) without waiting for the next refresh. */
  const update = useCallback((change: (current: T) => T) => {
    if (latest.current === null) return;
    sequence.current++; // a refresh already in flight may predate this change
    latest.current = change(latest.current);
    setData(latest.current);
  }, []);

  return { data, error, connected, refresh, refreshSoon, update };
}
