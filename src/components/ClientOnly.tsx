'use client';

import React, { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * Renders children only in the browser. Use it around UI that depends on
 * localStorage or the URL, so the server HTML never disagrees with the client.
 */
export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  return <>{isClient ? children : fallback}</>;
}
