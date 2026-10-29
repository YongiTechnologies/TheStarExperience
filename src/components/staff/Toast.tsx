'use client';

import React, { useCallback, useEffect, useState } from 'react';

/** One short message at the bottom of the screen that clears itself. */
export function useToast(durationMs = 4000) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs]);

  const show = useCallback((text: string) => setMessage(text), []);
  const toast = message ? (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-safe pointer-events-none">
      <p
        role="alert"
        className="pointer-events-auto max-w-md rounded-2xl bg-cream text-ink px-4 py-3 text-[14px] font-semibold shadow-2xl animate-rise"
        onClick={() => setMessage(null)}
      >
        {message}
      </p>
    </div>
  ) : null;

  return { show, toast };
}
