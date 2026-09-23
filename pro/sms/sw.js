// sw.js - Универсальный кеш + уведомления
const CACHE_NAME = 'sms-pwa-v32';

const FILES_TO_CACHE = [
    '/SMS/pro/sms/index.html',
    '/SMS/pro/sms/manifest.json',
    '/SMS/pro/sms/icon-192.png',
    '/SMS/pro/sms/icon-512.png'
];

// ═══════════════════════════════════════════════════════════════
//  УСТАНОВКА И АКТИВАЦИЯ
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Кэшируем ProX...');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Удаляем старый кэш:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ═══════════════════════════════════════════════════════════════
//  КЭШИРОВАНИЕ ЗАПРОСОВ
// ═══════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
    // Не кэшируем запросы к GitHub API — они всегда должны быть свежими
    if (event.request.url.includes('api.github.com')) return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Фоновое обновление кэша
                    fetch(event.request)
                        .then(response => {
                            if (response && response.status === 200) {
                                const clone = response.clone();
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(event.request, clone);
                                });
                            }
                        })
                        .catch(() => {});
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(response => {
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, clone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Fallback на главную страницу при офлайне
                        return caches.match('/SMS/pro/sms/index.html');
                    });
            })
    );
});

// ═══════════════════════════════════════════════════════════════
//  УВЕДОМЛЕНИЯ
// ═══════════════════════════════════════════════════════════════

// Клик по уведомлению — открываем/фокусируем приложение
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Если приложение уже открыто — фокусируем
                for (const client of clientList) {
                    if (client.url.includes('/SMS/pro/sms/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Иначе — открываем новое окно
                if (clients.openWindow) {
                    return clients.openWindow('/SMS/pro/sms/index.html');
                }
            })
    );
});

// Push от сервера (пригодится, если позже добавишь Web Push)
self.addEventListener('push', (event) => {
    let data = { title: 'SMS Чат', body: 'Новое сообщение' };
    try {
        if (event.data) data = event.data.json();
    } catch (e) {
        if (event.data) data.body = event.data.text();
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/SMS/pro/sms/icon-192.png',
            badge: '/SMS/pro/sms/icon-192.png',
            tag: data.tag || 'sms-chat',
            renotify: true,
        })
    );
});