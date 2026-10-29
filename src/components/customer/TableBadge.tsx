'use client';

import React from 'react';
import { QrCode } from 'lucide-react';

interface TableBadgeProps {
  tableNumber: string | number;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showIcon?: boolean;
}

export function TableBadge({
  tableNumber,
  size = 'md',
  onClick,
  showIcon = true,
}: TableBadgeProps) {
  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3.5 py-1.5 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5 font-extrabold',
  };

  const isInteractive = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center rounded-xl bg-[#1A1A1A] border border-star-gold/40 text-white font-bold gold-glow-sm select-none transition-all ${
        sizeStyles[size]
      } ${isInteractive ? 'cursor-pointer hover:border-star-gold hover:bg-[#222]' : ''}`}
    >
      {showIcon && (
        <span className="text-star-gold flex items-center shrink-0">
          <QrCode className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
        </span>
      )}
      <span className="tracking-wider text-star-gold font-mono whitespace-nowrap">
        TABLE {tableNumber || '--'}
      </span>
    </div>
  );
}
