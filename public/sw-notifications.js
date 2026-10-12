/* Loaded into the generated service worker: shows pushed reminders and opens their card when tapped. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : 'Kept' };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kept', {
      body: data.body || '',
      tag: data.tag,
      icon: `${scope}icons/icon-192.png`,
      badge: `${scope}icons/favicon-32.png`,
      data: { url: data.url || scope },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || self.registration.scope, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.registration.scope) && 'focus' in w) {
          return w.focus().then((f) => (f && 'navigate' in f ? f.navigate(url) : f));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
