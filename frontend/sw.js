// Service worker : affiche les notifications push, même app fermée, et
// ouvre la bonne section quand on touche la notification. Il ne met rien en
// cache : l'app reste toujours à jour (voir Cache-Control dans backend/src/app.js).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Better Man AI', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'better-man-ai',
    data: { view: data.view || 'daily' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = `/?view=${encodeURIComponent(event.notification.data?.view || 'daily')}`;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        client.postMessage({ type: 'open-view', view: event.notification.data?.view });
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
