'use client';

import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export interface NavSection {
  id: string;
  label: string;
  count: number;
}

interface CategoryNavProps {
  sections: NavSection[];
  activeId: string;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  isSearching: boolean;
  onSearchingChange: (searching: boolean) => void;
}

/**
 * Sticky menu navigation: category chips that follow your scroll position,
 * and a search field that replaces them when opened.
 */
export const CategoryNav = React.forwardRef<HTMLDivElement, CategoryNavProps>(function CategoryNav(
  { sections, activeId, onSelect, query, onQueryChange, isSearching, onSearchingChange },
  ref
) {
  const barRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Keep the active chip centred in the bar as the guest scrolls the menu.
  useEffect(() => {
    const bar = barRef.current;
    const chip = chipRefs.current[activeId];
    if (!bar || !chip) return;
    bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
  }, [activeId]);

  return (
    <div ref={ref} className="sticky top-0 z-30 bg-ink/90 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-2xl mx-auto h-14 flex items-center gap-1 pl-3 pr-2">
        {isSearching ? (
          <div className="flex-1 flex items-center gap-2 animate-fade-in">
            <div className="flex-1 flex items-center gap-2 h-10 rounded-full bg-ink-high ring-1 ring-white/10 px-3.5 focus-within:ring-star-gold/60">
              <Search className="w-4 h-4 text-dust shrink-0" />
              <input
                autoFocus
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Kokoroko, jollof, Club…"
                aria-label="Search the menu"
                className="flex-1 min-w-0 bg-transparent text-base text-cream placeholder:text-dust/60 outline-none"
              />
              {query && (
                <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search" className="text-dust cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                onQueryChange('');
                onSearchingChange(false);
              }}
              className="h-10 px-2 text-sm font-semibold text-cream cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSearchingChange(true)}
              aria-label="Search the menu"
              className="shrink-0 w-10 h-10 grid place-items-center rounded-full text-cream hover:bg-white/5 cursor-pointer"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>
            <div ref={barRef} className="relative flex-1 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 pr-2 w-max">
                {sections.map((section) => {
                  const active = section.id === activeId;
                  return (
                    <button
                      key={section.id}
                      ref={(el) => {
                        chipRefs.current[section.id] = el;
                      }}
                      type="button"
                      onClick={() => onSelect(section.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`h-9 px-3.5 rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        active ? 'bg-cream text-ink' : 'text-dust hover:text-cream'
                      }`}
                    >
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
