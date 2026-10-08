// ═══════════════════════════════════════════════════════════════
//  sw.js — Service Worker для офлайн-старта SMS Чата
//  Кэширует оболочку приложения (HTML, манифест, иконки)
//  и отдаёт её из кэша, когда сети нет.
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'smschat-v1.0.0';   // ← меняй при обновлении
const CACHE_NAME = `smschat-shell-${CACHE_VERSION}`;

// Всё, что нужно для холодного старта без сети
const SHELL_URLS = [
    './',
    './Cashrldmin.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
];

// ═══ Установка: кладём оболочку в кэш ═══
self.addEventListener('install', (event) => {
    console.log('[SW] install', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(SHELL_URLS).catch((err) => {
                console.warn('[SW] Не удалось закэшировать всё:', err);
                // Кэшируем по одному — какие-то файлы могут отсутствовать
                return Promise.allSettled(
                    SHELL_URLS.map((url) =>
                        cache.add(url).catch(() => {})
                    )
                );
            });
        })
    );
    self.skipWaiting();
});

// ═══ Активация: чистим старые кэши ═══
self.addEventListener('activate', (event) => {
    console.log('[SW] activate', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key.startsWith('smschat-shell-') && key !== CACHE_NAME) {
                        console.log('[SW] удаляю старый кэш', key);
                        return caches.delete(key);
                    }
                    return null;
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ═══ Fetch: стратегия "Network-first, но с офлайн-fallback" ═══
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Пропускаем всё, что не GET
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Пропускаем запросы к GitHub API и сторонним ресурсам —
    // их не кэшируем здесь (это делает сама программа через IndexedDB)
    if (url.hostname === 'api.github.com') return;
    if (url.hostname.endsWith('githubusercontent.com')) return;
    if (url.hostname !== self.location.hostname) return;

    // ═══ Стратегия для оболочки: Cache-first с фоновым обновлением ═══
    //  HTML, manifest, иконки — отдаём из кэша мгновенно,
    //  и параллельно пытаемся обновить из сети.
    event.respondWith(
        caches.match(req).then((cached) => {
            const networkPromise = fetch(req)
                .then((response) => {
                    // Обновляем кэш, если ответ валиден
                    if (response && response.status === 200) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(req, cloned).catch(() => {});
                        });
                    }
                    return response;
                })
                .catch(() => null);

            // Если есть в кэше — отдаём сразу, сеть догоняет
            if (cached) {
                networkPromise.catch(() => {});
                return cached;
            }

            // Нет в кэше — ждём сеть
            return networkPromise.then((response) => {
                if (response) return response;

                // Совсем нет ни кэша, ни сети — для HTML отдаём
                // сохранённую оболочку
                if (req.mode === 'navigate' || req.destination === 'document') {
                    return caches.match('./Cashrldmin.html');
                }

                return new Response('Offline', { status: 503 });
            });
        })
    );
});