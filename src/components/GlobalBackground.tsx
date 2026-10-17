'use client';

import { usePathname } from 'next/navigation';

/** Faint event artwork behind the staff screens. Guest screens have their own hero. */
export function GlobalBackground() {
  const pathname = usePathname();

  if (!pathname.startsWith('/admin')) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none flex justify-center items-center opacity-10">
      <img
        src="/assets/IMG_0611.JPG.jpeg"
        alt=""
        className="w-full max-w-xl h-auto object-contain" 
      />
    </div>
  );
}
