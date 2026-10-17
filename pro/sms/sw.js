// SMS Chat Service Worker — принимает Web Push
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
    let data = {};
    try { data = e.data ? e.data.json() : {}; }
    catch (err) { data = { title: 'SMS Чат', body: e.data ? e.data.text() : '' }; }

    const title = data.title || 'SMS Чат';
    const body = data.body || 'Новое сообщение';
    const total = data.total || 1;

    if ('setAppBadge' in self) {
        if (total > 0) self.setAppBadge(total).catch(() => {});
        else self.clearAppBadge().catch(() => {});
    }

    e.waitUntil(self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'smschat-unread',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: self.registration.scope },
    }));
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    const target = (e.notification.data && e.notification.data.url) || self.registration.scope;
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if (c.url.startsWith(target) && 'focus' in c) return c.focus();
            }
            if (clients.openWindow) return clients.openWindow(target);
        })
    );
    if ('clearAppBadge' in self) self.clearAppBadge().catch(() => {});
});
