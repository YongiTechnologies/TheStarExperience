'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  SESSION_EXPIRED_EVENT,
  clearSession,
  getSession,
  hasExpiredSession,
  hasValidSession,
  homeForRole,
} from '@/lib/api';
import { StaffRoleName } from '@/types';

const SIGN_IN_PATH = '/staff';

/**
 * Staff screens (/staff/waiter, /staff/kitchen, /staff/bar) open only for that
 * role (admins can also open kitchen and bar). Anyone else goes to their own screen, and signed-out or
 * expired sessions go to the PIN sign-in.
 */
export function StaffGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isSignIn = pathname === SIGN_IN_PATH;
  const required = pathname.split('/')[2] as StaffRoleName | undefined;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isSignIn) return;

    const sendToSignIn = (expired: boolean) => {
      clearSession();
      setAllowed(false);
      router.replace(expired ? `${SIGN_IN_PATH}?expired=1` : SIGN_IN_PATH);
    };

    const session = getSession();
    if (session && hasValidSession()) {
      if (session.role === required || (session.role === 'admin' && required !== 'waiter')) {
        void Promise.resolve().then(() => setAllowed(true));
      } else if (session.role === 'admin') {
        // The waiter screen is personal (my tables); admins oversee waiters from the floor view.
        router.replace('/admin/floor');
      } else {
        router.replace(homeForRole(session.role));
      }
    } else {
      sendToSignIn(hasExpiredSession());
    }

    const onExpired = () => sendToSignIn(true);
    // Notice a token running out, or a sign-out / different sign-in in another tab.
    const recheck = () => {
      const current = getSession();
      if (!current || !hasValidSession()) sendToSignIn(hasExpiredSession());
      else if (current.token !== session?.token) router.replace(homeForRole(current.role));
    };
    const timer = window.setInterval(recheck, 10000);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener('storage', recheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener('storage', recheck);
    };
  }, [isSignIn, required, router]);

  if (isSignIn || allowed) return <>{children}</>;
  return <div className="min-h-screen bg-ink" aria-busy="true" />;
}
