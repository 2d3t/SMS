// sw.js — SW для SMS Чат (PWA)
// ВАЖНО: GitHub API и raw.githubusercontent НИКОГДА не кэшируются,
// иначе ломается синхронизация чатов и медиа между устройствами.

const CACHE_NAME = 'sms-pwa-v4';   // ← подняли версию, чтобы вычистить старый кэш

// Статика, которую можно смело кэшировать
const STATIC_ASSETS = [
    '/SMS/pro/sms/index.html',
    '/SMS/pro/sms/manifest.json',
    '/SMS/pro/sms/icon-192.png',
    '/SMS/pro/sms/icon-512.png'
];

// ─────────────────────────────────────────────────────────────
//  INSTALL
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
            .catch(err => console.warn('[SW] install cache error:', err))
    );
});

// ─────────────────────────────────────────────────────────────
//  ACTIVATE — удаляем все старые кэши
// ─────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.map(name => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Удаляем старый кэш:', name);
                        return caches.delete(name);
                    }
                })
            ))
            .then(() => self.clients.claim())
    );
});

// ─────────────────────────────────────────────────────────────
//  FETCH
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Нас интересуют только GET-запросы
    if (req.method !== 'GET') return;

    let url;
    try {
        url = new URL(req.url);
    } catch {
        return;
    }

    // 1) GitHub API — ТОЛЬКО СЕТЬ. Никогда не отдавать из кэша.
    if (url.hostname === 'api.github.com') {
        event.respondWith(fetch(req));
        return;
    }

    // 2) Файлы с GitHub (аватары, raw, objects) — ТОЛЬКО СЕТЬ.
    if (url.hostname.endsWith('githubusercontent.com')) {
        event.respondWith(fetch(req));
        return;
    }

    // 3) Всё, что не наш origin — просто сеть, без кэширования
    if (url.origin !== self.location.origin) {
        event.respondWith(fetch(req));
        return;
    }

    // 4) HTML — network-first (чтобы обновления приложения подхватывались сразу)
    const isHTML =
        req.mode === 'navigate' ||
        (req.headers.get('accept') || '').includes('text/html') ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('/');

    if (isHTML) {
        event.respondWith(
            fetch(req)
                .then(response => {
                    // Кладём свежую версию в кэш на случай офлайна
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(req).then(r => r || caches.match('/SMS/pro/sms/index.html')))
        );
        return;
    }

    // 5) Статика (иконки, manifest) — cache-first + фоновое обновление
    event.respondWith(
        caches.match(req).then(cached => {
            const networkFetch = fetch(req)
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
                    }
                    return response;
                })
                .catch(() => null);

            // Если есть кэш — отдаём сразу, обновляем в фоне
            if (cached) {
                networkFetch.catch(() => {}); // фоновое обновление, ошибки игнорируем
                return cached;
            }

            // Кэша нет — ждём сеть
            return networkFetch.then(resp => resp || Response.error());
        })
    );
});

// ─────────────────────────────────────────────────────────────
//  MESSAGE — ручное обновление / сброс кэша (на всякий случай)
// ─────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
        );
    }
});