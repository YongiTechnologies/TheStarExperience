'use client';

import { useEffect, useRef, useState } from 'react';
import { streamStaffEvents } from '@/lib/api';
import { LiveEvent } from '@/types';

const MAX_BACKOFF_MS = 15000;

/**
 * Subscribe a staff screen to live updates. Calls `onEvent` for every event and
 * returns whether the stream is currently connected. The server closes streams
 * about once a minute; this reconnects straight away, and backs off on errors.
 * Screens should still refresh on a slow timer as a safety net.
 */
export function useLiveUpdates(onEvent: (event: LiveEvent) => void, enabled = true): boolean {
  const handler = useRef(onEvent);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let stopped = false;

    void (async () => {
      let backoff = 1000;
      while (!stopped) {
        try {
          await streamStaffEvents(controller.signal, (event) => {
            setConnected(true);
            backoff = 1000;
            handler.current(event);
          });
          // Normal end of a stream: reconnect after a brief pause.
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch {
          if (stopped) break;
          setConnected(false);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
      }
    })();

    return () => {
      stopped = true;
      controller.abort();
      setConnected(false);
    };
  }, [enabled]);

  return connected;
}
