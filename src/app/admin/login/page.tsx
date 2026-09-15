'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Lock, Mail, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError, loginAdmin } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your staff email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await loginAdmin(email, password);
      setIsLoading(false);
      router.push('/admin/dashboard');
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    }
  };

  const handleDemoFill = () => {
    setEmail('staff@thestar.republicbar.com');
    setPassword('republic2026');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-between text-white p-4 sm:p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-star-gold/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Bar */}
      <header className="flex items-center justify-between py-2">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-star-muted hover:text-white transition-colors"
        >
          <span>← Event Landing Page</span>
        </Link>
        <span className="text-[11px] font-mono text-zinc-500">Staff Portal v1.0</span>
      </header>

      {/* Main Login Card */}
      <main className="max-w-sm mx-auto w-full my-auto">
        <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-star-gold/15 border border-star-gold/40 flex items-center justify-center text-star-gold mx-auto mb-3">
              <img src="/assets/republic_logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>

            <span className="text-[10px] uppercase font-bold tracking-widest text-star-gold block">
              THE STAR EXPERIENCE
            </span>
            <h2 className="text-xl font-extrabold text-white mt-1">BAR STAFF LOGIN</h2>
            <p className="text-xs text-star-muted mt-1">
              The Republic Bar and Grill, Osu
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Staff Email or Username"
              type="text"
              placeholder="staff@thestar.republicbar.com or staff.username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {error && (
              <p className="text-xs text-star-red font-medium">{error}</p>
            )}

            <Button
              type="submit"
              variant="gold"
              size="lg"
              isLoading={isLoading}
              className="w-full font-black tracking-wider uppercase mt-2"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              LOGIN
            </Button>
          </form>

          {/* Quick Demo Autofill */}
          <div className="mt-5 pt-4 border-t border-[#222222] text-center">
            <button
              type="button"
              onClick={handleDemoFill}
              className="text-xs text-star-gold hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <span>Fill Demo Credentials</span>
            </button>
            <p className="text-[10px] text-zinc-500 mt-1">
              Use your bar staff credentials to access the dashboard
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-zinc-500 py-3">
        The Republic Bar & Grill • Osu, Accra, Ghana
      </footer>
    </div>
  );
}
