/*
 * Staff alerts while the phone is locked (Web Push). The server sends
 * { title, body, tag, url }; notifications for the same order share a tag, so
 * "ready to serve" replaces "new order" instead of piling up.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  // Always show something: browsers penalise pushes that don't notify.
  event.waitUntil(
    self.registration.showNotification(data.title || 'The Star', {
      body: data.body || 'You have an update on your screen.',
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: '/icons/staff-192.png',
      badge: '/icons/staff-badge.png',
      vibrate: [200, 100, 200, 100, 200],
      data: { url: data.url || '/staff/waiter' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/staff/waiter', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(`${self.location.origin}/staff`));
      if (open) {
        await open.focus();
        if (open.url !== target && 'navigate' in open) await open.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
