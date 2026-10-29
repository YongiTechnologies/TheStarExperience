'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  SESSION_EXPIRED_EVENT,
  clearAdminSession,
  getSession,
  hasExpiredSession,
  hasValidAdminSession,
  hasValidSession,
  homeForRole,
} from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const LOGIN_PATH = '/admin/login';

/**
 * Keeps staff pages behind a valid sign-in. Missing or expired sessions go to
 * the login page, and a session that expires mid-shift (any staff request
 * returning 401) does the same instead of leaving a silently frozen board.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === LOGIN_PATH;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isLoginPage) return;

    const sendToLogin = (reason: 'signin' | 'expired') => {
      clearAdminSession();
      setAllowed(false);
      router.replace(reason === 'expired' ? `${LOGIN_PATH}?expired=1` : LOGIN_PATH);
    };

    const session = getSession();
    if (hasValidAdminSession()) {
      void Promise.resolve().then(() => setAllowed(true));
    } else if (session && hasValidSession()) {
      // A waiter, cook or bartender who wandered in: back to their own screen, still signed in.
      router.replace(homeForRole(session.role));
    } else {
      sendToLogin('signin');
    }

    const onExpired = () => sendToLogin('expired');
    // Notice a token running out, or a sign-out in another tab, without waiting for a request to fail.
    const recheck = () => {
      if (hasValidAdminSession()) return;
      const current = getSession();
      if (current && hasValidSession()) router.replace(homeForRole(current.role));
      else sendToLogin(hasExpiredSession() ? 'expired' : 'signin');
    };
    const timer = window.setInterval(recheck, 10000);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener('storage', recheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener('storage', recheck);
    };
  }, [isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;
  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Checking staff sign-in…" />
      </div>
    );
  }
  return <>{children}</>;
}
