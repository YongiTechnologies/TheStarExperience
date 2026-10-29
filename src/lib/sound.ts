/**
 * Short alert chimes for staff screens. Browsers keep audio muted until the
 * user interacts with the page, so the shared AudioContext is resumed on the
 * first tap (see unlockSound) and chimes before that are silently skipped.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
  }
  return context;
}

/** Resume audio after a user gesture. Resolves to whether sound can now play. */
export async function unlockSound(): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;
  try {
    await ctx.resume();
  } catch {
    return false;
  }
  return ctx.state === 'running';
}

export function soundUnlocked(): boolean {
  return context?.state === 'running';
}

/** Two-note rising chime; "urgent" plays it twice. */
export function playChime(kind: 'new' | 'urgent' = 'new'): void {
  const ctx = getContext();
  if (!ctx || ctx.state !== 'running') return;
  const repeats = kind === 'urgent' ? 2 : 1;
  for (let i = 0; i < repeats; i++) {
    const start = ctx.currentTime + i * 0.7;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, start);
    osc.frequency.exponentialRampToValueAtTime(880, start + 0.15);
    gain.gain.setValueAtTime(0.22, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.6);
  }
}

/** Short buzz on phones that support it (Android); ignored elsewhere. */
export function buzz(pattern: number | number[] = [120, 60, 120]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration blocked or unsupported.
  }
}
