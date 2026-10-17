'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SESSION_EXPIRED_EVENT, clearAdminSession, hasValidAdminSession } from '@/lib/api';
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

    if (hasValidAdminSession()) {
      void Promise.resolve().then(() => setAllowed(true));
    } else {
      sendToLogin('signin');
    }

    const onExpired = () => sendToLogin('expired');
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
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
