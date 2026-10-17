'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, UtensilsCrossed, LogOut } from 'lucide-react';
import { clearAdminSession } from '@/lib/api';

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = () => {
    clearAdminSession();
    router.replace('/admin/login');
  };

  const navItems = [
    {
      label: 'Live Orders Board',
      href: '/admin/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      label: 'Menu Management',
      href: '/admin/menu',
      icon: <UtensilsCrossed className="w-5 h-5" />,
    },
  ];

  return (
    <aside className="w-full md:w-64 bg-[#0F0F0F] border-r border-[#222222] flex flex-col justify-between shrink-0 p-4">
      <div className="space-y-6">
        <div className="px-3 pt-2 hidden md:block">
          <span className="text-[10px] uppercase font-bold tracking-widest text-star-muted block">
            PORTAL
          </span>
          <p className="text-sm font-extrabold text-white mt-0.5">Republic Bar Staff</p>
        </div>

        <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  isActive
                    ? 'bg-star-gold text-star-black font-bold gold-glow-sm shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-[#1A1A1A]'
                }`}
              >
                <span className={isActive ? 'text-star-black' : 'text-star-gold'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 md:pt-6 md:border-t border-[#222222]">
        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-star-red hover:bg-star-red/10 transition-colors font-semibold cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
