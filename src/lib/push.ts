/**
 * Alerts on a locked phone (Web Push). A page can't make a sound once the screen
 * is off, so the waiter's phone subscribes through the service worker (public/sw.js)
 * and the server pushes "new order" / "ready to serve" notifications to it.
 */
import { deletePushSubscription, getPushKey, savePushSubscription } from '@/lib/api';

export type PushState =
  | 'unsupported' // browser can't do it, or the page isn't served over HTTPS
  | 'needs-install' // iPhone/iPad: only works once added to the home screen
  | 'off' // not configured on the server
  | 'default' // can ask
  | 'denied' // blocked in browser settings
  | 'on';

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Opened from the home screen as an app, rather than in a browser tab. */
export function isInstalledApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

/** Where this browser stands; with "on", the server has this browser's subscription. */
export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined' || !window.isSecureContext || !('serviceWorker' in navigator)) return 'unsupported';
  if (!('PushManager' in window) || !('Notification' in window)) return isIOS() && !isInstalledApp() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (!(await getPushKey().catch(() => null))) return 'off';
  if (Notification.permission !== 'granted') return 'default';
  const subscription = await (await registration()).pushManager.getSubscription();
  return subscription ? 'on' : 'default';
}

/** Ask for permission (must run from a tap) and send this browser's subscription to the server. */
export async function enablePush(): Promise<PushState> {
  const key = await getPushKey();
  if (!key) return 'off';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';
  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await savePushSubscription(subscription.toJSON());
  return 'on';
}

/**
 * Re-send an existing subscription after sign-in, so a shared phone alerts whoever is
 * signed in now (and a subscription the browser rotated is picked up).
 */
export async function refreshPush(): Promise<void> {
  if ((await pushState()) !== 'on') return;
  const subscription = await (await registration()).pushManager.getSubscription();
  if (subscription) await savePushSubscription(subscription.toJSON());
}

/** On sign-out: stop alerts for this person on this browser. Best effort. */
export async function disablePush(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const subscription = await reg?.pushManager.getSubscription();
    if (!subscription) return;
    await deletePushSubscription(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe();
  } catch {
    // Offline or unsupported: whoever signs in next on this phone takes the subscription over.
  }
}
