import React from 'react';

interface MenuHeroProps {
  tableNumber: string;
}

/** Event poster at the top of the menu: who, where, and which table you're at. */
export function MenuHero({ tableNumber }: MenuHeroProps) {
  return (
    <header className="relative isolate h-[268px] overflow-hidden grain">
      <img
        src="/assets/IMG_0499.JPG.jpeg"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-10 w-full h-full object-cover object-[50%_36%] scale-110 saturate-[0.85]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/50 via-ink/35 to-ink" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_70%_at_85%_0%,rgba(248,213,14,0.18),transparent_60%)]" />

      <div className="relative h-full max-w-2xl mx-auto px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-5 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/assets/republic_logo.png" alt="The Republic Bar & Grill" width={36} height={36} className="w-9 h-9 rounded-full" />
            <span className="text-[12px] font-medium text-cream/80 leading-tight">
              The Republic
              <br />
              Bar &amp; Grill · Osu
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-ink/70 backdrop-blur-md ring-1 ring-white/10 pl-3 pr-3.5 py-1.5">
            <span className="relative flex w-2 h-2" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-flag-red animate-live-ring" />
              <span className="relative w-2 h-2 rounded-full bg-flag-red" />
            </span>
            {tableNumber ? (
              <span className="text-[13px] font-semibold text-cream">
                Table <span className="font-display text-base font-extrabold text-star-gold tabular">{tableNumber}</span>
              </span>
            ) : (
              <span className="text-[13px] font-semibold text-cream">Live tonight</span>
            )}
          </div>
        </div>

        <div className="mt-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-star-gold animate-rise">
            Kwesi Dain presents
          </p>
          <h1 className="mt-1.5 font-stencil font-extrabold uppercase text-[54px] leading-[0.82] tracking-tight text-cream animate-rise [animation-delay:80ms]">
            The <span className="text-star-gold">Star</span>
            <br />
            Experience
          </h1>
          <p className="mt-3 text-[13px] text-cream/70 animate-rise [animation-delay:160ms]">
            3 Dec · Order to your table, pay with MoMo
          </p>
        </div>
      </div>
    </header>
  );
}
