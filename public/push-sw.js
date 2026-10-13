// Loaded into the generated service worker via workbox `importScripts` (see vite.config.ts).
// Shows the daily reminder and opens the app when it's tapped.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'کارهای امروز رو ثبت کردی؟';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body,
      dir: data.dir || 'rtl',
      lang: data.lang || 'fa',
      icon: data.icon || '/pwa-192x192.png',
      badge: data.badge || '/pwa-64x64.png',
      tag: data.tag || 'daily-reminder',
      data: { url: (data.data && data.data.url) || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Reuse an open app window if there is one; otherwise open a new one.
      const existing = windows.find((w) => new URL(w.url).origin === target.origin);
      if (existing) return existing.focus();
      return self.clients.openWindow(target.href);
    })(),
  );
});
