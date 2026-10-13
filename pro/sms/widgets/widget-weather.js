

// ═══════════════════════════════════════════════════════════════
//  🧩 WIDGETS MODULE v5 — без дёрганья, с постоянным кэшем
//  ─────────────────────────────────────────────────────────────
//  Ключевое отличие:
//   • HTML карточки погоды генерируется ИЗ КЭША (если есть данные)
//   • Данные в localStorage живут бессрочно, обновляются по TTL
//   • renderChatsList может вызываться сколько угодно раз —
//     карточка всегда покажет уже загруженные данные
//   • Автообновление каждые 30 минут
// ═══════════════════════════════════════════════════════════════

(function installWidgetsModuleV5() {
    'use strict';

    console.log('🧩 [Widgets v5] Запуск…');

    const CFG = {
        STORAGE_KEY: 'smschat_widgets',
        CACHE_KEY: 'smschat_widgets_cache',
        // Данные в кэше считаются валидными 30 минут
        CACHE_TTL_MS: 30 * 60 * 1000,
        // Автообновление — раз в 30 минут
        WEATHER_REFRESH_MS: 30 * 60 * 1000,
        DEBUG: true,
    };

    const log = (...a) => CFG.DEBUG && console.log('🧩 [Widgets v5]', ...a);
    const warn = (...a) => console.warn('🧩 [Widgets v5]', ...a);

    const AVAILABLE_WIDGETS = [
        { id: 'weather', name: 'Погода', icon: '⛅', description: 'Текущая погода в вашем городе' },
    ];

    let _widgets = [];

    // ═══════════════════════════════════════════════════════════
    //  КЭШ — плоская структура: { key: { ts, data } }
    //  НЕ имеет TTL на уровне чтения — TTL проверяется отдельно,
    //  чтобы можно было показать устаревшие данные пока грузятся новые.
    // ═══════════════════════════════════════════════════════════
    let _cache = {};

    function loadWidgets() {
        try {
            const raw = localStorage.getItem(CFG.STORAGE_KEY);
            _widgets = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(_widgets)) _widgets = [];
            log('Загружено виджетов:', _widgets.length);
        } catch (e) { _widgets = []; }
    }

    function saveWidgets() {
        try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(_widgets)); } catch (e) {}
    }

    function loadCache() {
        try {
            const raw = localStorage.getItem(CFG.CACHE_KEY);
            _cache = raw ? JSON.parse(raw) : {};
        } catch (e) { _cache = {}; }
    }

    function saveCache() {
        try { localStorage.setItem(CFG.CACHE_KEY, JSON.stringify(_cache)); } catch (e) {}
    }

    function getCacheKey(id, sub) { return sub ? `${id}::${sub}` : id; }

    /** Возвращает данные из кэша ВНЕ зависимости от TTL. */
    function readCacheRaw(id, sub) {
        const entry = _cache[getCacheKey(id, sub)];
        return entry ? entry.data : null;
    }

    /** Возвращает timestamp записи в кэше. */
    function readCacheTs(id, sub) {
        const entry = _cache[getCacheKey(id, sub)];
        return entry ? entry.ts : 0;
    }

    /** Проверяет, свежие ли данные (в пределах TTL). */
    function isCacheFresh(id, sub) {
        const ts = readCacheTs(id, sub);
        return ts > 0 && (Date.now() - ts < CFG.CACHE_TTL_MS);
    }

    function writeCache(id, data, sub) {
        _cache[getCacheKey(id, sub)] = { ts: Date.now(), data };
        saveCache();
    }

    // ═══════════════════════════════════════════════════════════
    //  ГЕОЛОКАЦИЯ / ПОГОДА
    // ═══════════════════════════════════════════════════════════
    async function detectLocationByIp() {
        // 1. Возвращаем из кэша, если есть (даже устаревшее)
        const cached = readCacheRaw('weather', 'location');
        if (cached && isCacheFresh('weather', 'location')) {
            return cached;
        }

        // 2. Пробуем обновить
        try {
            let data;
            try {
                const res = await fetch('https://ipwho.is/');
                if (res.ok) {
                    const d = await res.json();
                    if (d.success) {
                        data = {
                            city: d.city, country: d.country,
                            lat: d.latitude, lon: d.longitude,
                            timezone: d.timezone?.id || 'auto',
                        };
                    }
                }
            } catch (e) {}

            if (!data) {
                const res = await fetch('http://ip-api.com/json/?fields=status,country,city,lat,lon,timezone&lang=ru');
                if (res.ok) {
                    const d = await res.json();
                    if (d.status === 'success') {
                        data = { city: d.city, country: d.country, lat: d.lat, lon: d.lon, timezone: d.timezone };
                    }
                }
            }

            if (data) {
                writeCache('weather', data, 'location');
                return data;
            }
        } catch (e) {
            warn('IP-геолокация не удалась:', e.message);
        }

        // 3. Фолбэк — старый кэш или Минск
        if (cached) return cached;
        return { city: 'Минск', country: 'Belarus', lat: 53.9, lon: 27.5667, timezone: 'Europe/Minsk', _fallback: true };
    }

    async function fetchWeatherData() {
        const location = await detectLocationByIp();
        const subKey = `${location.lat.toFixed(3)}_${location.lon.toFixed(3)}`;

        // 1. Если данные свежие — возвращаем сразу
        if (isCacheFresh('weather', subKey)) {
            const cached = readCacheRaw('weather', subKey);
            if (cached) return { ...cached, location };
        }

        // 2. Иначе — обновляем с сервера
        try {
            const url = `https://api.open-meteo.com/v1/forecast?` +
                `latitude=${location.lat}&longitude=${location.lon}` +
                `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
                `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
                `&timezone=${encodeURIComponent(location.timezone)}&forecast_days=1`;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const c = data.current || {}, d = data.daily || {};
            const weather = {
                temp: c.temperature_2m,
                apparentTemp: c.apparent_temperature,
                humidity: c.relative_humidity_2m,
                windSpeed: c.wind_speed_10m,
                precip: c.precipitation,
                isDay: c.is_day === 1,
                code: c.weather_code,
                minTemp: d.temperature_2m_min?.[0],
                maxTemp: d.temperature_2m_max?.[0],
            };

            writeCache('weather', weather, subKey);
            return { ...weather, location };
        } catch (e) {
            warn('Погода недоступна:', e.message);

            // 3. Если есть устаревший кэш — используем его как fallback
            const stale = readCacheRaw('weather', subKey);
            if (stale) {
                log('Используем устаревший кэш погоды');
                return { ...stale, location, _stale: true };
            }

            return { error: e.message, location };
        }
    }

    function describeWeatherCode(code, isDay = true) {
        if (code === 0) return { text: 'Ясно', icon: isDay ? '☀️' : '🌙' };
        if (code === 1) return { text: 'Преим. ясно', icon: isDay ? '🌤️' : '🌙' };
        if (code === 2) return { text: 'Перем. облачность', icon: '⛅' };
        if (code === 3) return { text: 'Пасмурно', icon: '☁️' };
        if (code === 45 || code === 48) return { text: 'Туман', icon: '🌫️' };
        if (code >= 51 && code <= 57) return { text: 'Морось', icon: '🌦️' };
        if (code >= 61 && code <= 67) return { text: 'Дождь', icon: '🌧️' };
        if (code >= 71 && code <= 77) return { text: 'Снег', icon: '🌨️' };
        if (code >= 80 && code <= 82) return { text: 'Ливень', icon: '🌧️' };
        if (code === 85 || code === 86) return { text: 'Снегопад', icon: '❄️' };
        if (code === 95) return { text: 'Гроза', icon: '⛈️' };
        if (code === 96 || code === 99) return { text: 'Гроза с градом', icon: '⛈️' };
        return { text: '—', icon: '🌡️' };
    }

    function getCountryFlag(country) {
        if (!country) return '🌍';
        const flags = {
            'Belarus': '🇧🇾', 'Russia': '🇷🇺', 'Ukraine': '🇺🇦',
            'Kazakhstan': '🇰🇿', 'Poland': '🇵🇱', 'Germany': '🇩🇪',
            'USA': '🇺🇸', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧',
            'France': '🇫🇷', 'Italy': '🇮🇹', 'Spain': '🇪🇸',
            'China': '🇨🇳', 'Japan': '🇯🇵', 'Turkey': '🇹🇷',
            'Netherlands': '🇳🇱', 'Lithuania': '🇱🇹', 'Latvia': '🇱🇻',
            'Estonia': '🇪🇪', 'Georgia': '🇬🇪', 'Armenia': '🇦🇲',
            'Uzbekistan': '🇺🇿', 'Azerbaijan': '🇦🇿', 'Moldova': '🇲🇩',
            'Czechia': '🇨🇿',
        };
        return flags[country] || '🌍';
    }

    // ═══════════════════════════════════════════════════════════
    //  ДОБАВЛЕНИЕ / УДАЛЕНИЕ
    // ═══════════════════════════════════════════════════════════
    function addWidget(widgetId) {
        if (!AVAILABLE_WIDGETS.find(w => w.id === widgetId)) {
            if (typeof showToast === 'function') showToast('❌ Неизвестный виджет', 2000);
            return false;
        }
        if (_widgets.find(w => w.id === widgetId)) {
            if (typeof showToast === 'function') showToast('🧩 Уже добавлен', 2000);
            return false;
        }

        _widgets.push({ id: widgetId, addedAt: Date.now() });
        saveWidgets();

        if (typeof showToast === 'function') showToast('✅ Виджет добавлен', 2000);
        if (typeof soundManager !== 'undefined') { try { soundManager.play('send'); } catch (e) {} }

        // 🎯 Сразу запускаем загрузку (если ещё не загружено)
        if (widgetId === 'weather') {
            loadWeatherDataInBackground();
        }

        // Принудительный ререндер — виджет появится с уже готовым HTML
        rerenderChatsList();

        return true;
    }

    function removeWidget(widgetId) {
        const idx = _widgets.findIndex(w => w.id === widgetId);
        if (idx === -1) return false;
        _widgets.splice(idx, 1);
        saveWidgets();

        if (typeof showToast === 'function') showToast('🗑️ Виджет удалён', 1500);
        if (typeof soundManager !== 'undefined') { try { soundManager.play('delete'); } catch (e) {} }
        if (navigator.vibrate) navigator.vibrate(20);

        document.querySelectorAll('.widget-card').forEach(el => el.remove());
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    //  🎯 ГЛАВНОЕ: генерация HTML карточки погоды ИЗ КЭША
    //  ─────────────────────────────────────────────────────────
    //  Если в кэше уже есть данные — рисуем сразу с ними.
    //  Если нет — рисуем скелет (загрузится чуть позже).
    // ═══════════════════════════════════════════════════════════
    function buildWeatherCardHTML() {
        const location = readCacheRaw('weather', 'location');
        let weather = null;
        if (location) {
            const subKey = `${location.lat.toFixed(3)}_${location.lon.toFixed(3)}`;
            weather = readCacheRaw('weather', subKey);
        }

        // ─── Если данных нет — рисуем скелет ───
        if (!location || !weather) {
            return `
                <div class="widget-card weather" data-widget-id="weather">
                    <div class="wc-header">
                        <div class="wc-icon">⛅</div>
                        <div class="wc-title-block">
                            <div class="wc-title">🌍 Погода</div>
                            <div class="wc-subtitle">Загрузка…</div>
                        </div>
                    </div>
                    <div class="wc-body">
                        <div class="wc-weather-main">
                            <div class="wc-weather-icon">⛅</div>
                            <div>
                                <div class="wc-weather-temp">—°</div>
                                <div class="wc-weather-desc">…</div>
                            </div>
                        </div>
                        <div class="wc-weather-extra">
                            <div class="wc-minmax">—° / —°</div>
                            <div class="wc-feels">…</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // ─── Есть данные — рисуем сразу с ними ───
        const desc = describeWeatherCode(weather.code, weather.isDay);
        const flag = getCountryFlag(location.country);
        const temp = Math.round(weather.temp);
        const feels = Math.round(weather.apparentTemp);
        const min = Math.round(weather.minTemp);
        const max = Math.round(weather.maxTemp);
        const staleMark = weather._stale ? ' <span style="color:#feca57;font-size:10px;">•</span>' : '';

        return `
            <div class="widget-card weather" data-widget-id="weather">
                <div class="wc-header">
                    <div class="wc-icon">⛅</div>
                    <div class="wc-title-block">
                        <div class="wc-title">${flag} ${escapeHtmlSafe(location.city || '—')}</div>
                        <div class="wc-subtitle">Погода${staleMark}</div>
                    </div>
                </div>
                <div class="wc-body">
                    <div class="wc-weather-main">
                        <div class="wc-weather-icon">${desc.icon}</div>
                        <div>
                            <div class="wc-weather-temp">${temp}°</div>
                            <div class="wc-weather-desc">${escapeHtmlSafe(desc.text)}</div>
                        </div>
                    </div>
                    <div class="wc-weather-extra">
                        <div class="wc-minmax">${min}° / ${max}°</div>
                        <div class="wc-feels">Ощущ. ${feels}°</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════
    //  HTML ВСЕХ ВИДЖЕТОВ (для вставки в renderChatsList)
    // ═══════════════════════════════════════════════════════════
    function buildWidgetsHTML() {
        if (_widgets.length === 0) return '';
        return _widgets.map(w => {
            if (w.id === 'weather') return buildWeatherCardHTML();
            const info = AVAILABLE_WIDGETS.find(x => x.id === w.id);
            if (!info) return '';
            return `
                <div class="widget-card" data-widget-id="${w.id}">
                    <div class="wc-header">
                        <div class="wc-icon">${info.icon}</div>
                        <div class="wc-title-block">
                            <div class="wc-title">${escapeHtmlSafe(info.name)}</div>
                            <div class="wc-subtitle">${escapeHtmlSafe(info.description)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ═══════════════════════════════════════════════════════════
    //  ФОНОВАЯ ЗАГРУЗКА ПОГОДЫ
    //  НЕ трогает DOM, если данные уже показаны. Просто тихо
    //  сохраняет в кэш. Если данных в DOM ещё нет (скелет) —
    //  после загрузки делает один точечный ререндер.
    // ═══════════════════════════════════════════════════════════
    let _weatherLoadPromise = null;

    async function loadWeatherDataInBackground() {
        // Защита от параллельных загрузок
        if (_weatherLoadPromise) return _weatherLoadPromise;

        _weatherLoadPromise = (async () => {
            try {
                const before = readCacheRaw('weather', 'location');
                const beforeSub = before ? `${before.lat.toFixed(3)}_${before.lon.toFixed(3)}` : null;
                const beforeData = beforeSub ? readCacheRaw('weather', beforeSub) : null;

                const data = await fetchWeatherData();

                // Проверяем — изменились ли данные (после загрузки)
                const after = readCacheRaw('weather', 'location');
                const afterSub = after ? `${after.lat.toFixed(3)}_${after.lon.toFixed(3)}` : null;
                const afterData = afterSub ? readCacheRaw('weather', afterSub) : null;

                // 🎯 Триггерим ререндер ТОЛЬКО если:
                //   • Раньше данных не было (был скелет)
                //   • Или данные изменились существенно
                const wasSkeleton = !beforeData;
                const changed = !wasSkeleton && afterData && beforeData &&
                    (beforeData.temp !== afterData.temp ||
                     beforeData.code !== afterData.code);

                if (wasSkeleton || changed) {
                    log('Ререндер виджетов после загрузки погоды');
                    // Мягкий ререндер — не пересоздаём весь список,
                    // а заменяем ТОЛЬКО карточку виджета
                    replaceWeatherCardInDom();
                } else {
                    log('Данные погоды актуальны, ререндер не нужен');
                }

                return data;
            } finally {
                _weatherLoadPromise = null;
            }
        })();

        return _weatherLoadPromise;
    }

    /** Заменяет только карточку виджета погоды в DOM — без полного ререндера. */
    function replaceWeatherCardInDom() {
        const container = document.getElementById('chatsList');
        if (!container) return;

        const oldCard = container.querySelector('.widget-card.weather');
        if (!oldCard) {
            // Карточки нет — значит нужно вставить (могло случиться при удалении)
            return;
        }

        const newHtml = buildWeatherCardHTML();
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const newCard = temp.firstElementChild;
        if (!newCard) return;

        // Плавная подмена без анимации (мгновенно)
        oldCard.replaceWith(newCard);
        log('Карточка погоды обновлена в DOM');
    }

    function escapeHtmlSafe(s) {
        if (typeof escapeHtml === 'function') return escapeHtml(s);
        const div = document.createElement('div');
        div.textContent = s == null ? '' : String(s);
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════════════════════
    //  ПАТЧ innerHTML #chatsList — вставка виджетов синхронно
    // ═══════════════════════════════════════════════════════════
    let _innerHTMLPatched = false;

    function patchChatsListInnerHTML() {
        const container = document.getElementById('chatsList');
        if (!container) { setTimeout(patchChatsListInnerHTML, 500); return; }
        if (_innerHTMLPatched) return;

        const originalDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (!originalDescriptor) { warn('Нет дескриптора innerHTML'); return; }

        const _patchedSetter = function(value) {
            if (this === container && _widgets.length > 0) {
                const widgetsHtml = buildWidgetsHTML();
                value = widgetsHtml + value;
            }
            return originalDescriptor.set.call(this, value);
        };

        const _patchedGetter = function() {
            return originalDescriptor.get.call(this);
        };

        try {
            Object.defineProperty(container, 'innerHTML', {
                get: _patchedGetter,
                set: _patchedSetter,
                configurable: true,
            });
            _innerHTMLPatched = true;
            log('✅ innerHTML #chatsList пропатчен');
        } catch (e) {
            warn('Патч innerHTML не удался:', e);
        }
    }

    setTimeout(patchChatsListInnerHTML, 500);
    setTimeout(patchChatsListInnerHTML, 2000);

    function rerenderChatsList() {
        if (typeof renderChatsList !== 'function') return;
        renderChatsList();
        // После рендера проверяем — если данных в карточке нет,
        // но они есть в кэше — заменяем
        setTimeout(() => {
            const card = document.querySelector('.widget-card.weather');
            if (!card) return;
            const hasSkeleton = card.querySelector('.wc-weather-temp')?.textContent === '—°';
            if (!hasSkeleton) return; // уже с данными
            replaceWeatherCardInDom();
        }, 100);
    }

    // ═══════════════════════════════════════════════════════════
    //  ДЕЛЕГИРОВАННЫЕ ОБРАБОТЧИКИ
    // ═══════════════════════════════════════════════════════════
    function installDelegatedHandlers() {
        const container = document.getElementById('chatsList');
        if (!container) { setTimeout(installDelegatedHandlers, 500); return; }
        if (container._widgetsV5Handlers) return;
        container._widgetsV5Handlers = true;

        let pressTimer = null, pressTarget = null, fired = false;
        let startX = 0, startY = 0;

        function cancelPress() {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            if (pressTarget) { pressTarget.classList.remove('pressing'); pressTarget = null; }
        }

        function startPress(card) {
            cancelPress();
            fired = false;
            pressTarget = card;
            card.classList.add('pressing');
            pressTimer = setTimeout(() => {
                fired = true;
                pressTimer = null;
                const widgetId = card.dataset.widgetId;
                card.classList.remove('pressing');
                pressTarget = null;
                if (navigator.vibrate) navigator.vibrate(30);
                const info = AVAILABLE_WIDGETS.find(w => w.id === widgetId);
                if (confirm(`Удалить виджет «${info ? info.name : widgetId}»?`)) {
                    removeWidget(widgetId);
                }
            }, 600);
        }

        // Клик — тихое обновление погоды
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.widget-card');
            if (!card) return;
            if (fired) { fired = false; return; }

            const widgetId = card.dataset.widgetId;
            if (widgetId === 'weather') {
                // Просто запускаем фоновую перезагрузку — она сама заменит данные
                loadWeatherDataInBackground();
            }
        });

        container.addEventListener('touchstart', (e) => {
            const card = e.target.closest('.widget-card');
            if (!card) return;
            const t = e.touches[0];
            startX = t.clientX; startY = t.clientY;
            startPress(card);
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!pressTimer) return;
            const t = e.touches[0];
            if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) {
                cancelPress();
            }
        }, { passive: true });

        container.addEventListener('touchend', cancelPress);
        container.addEventListener('touchcancel', cancelPress);

        container.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const card = e.target.closest('.widget-card');
            if (!card) return;
            startX = e.clientX; startY = e.clientY;
            startPress(card);
        });
        container.addEventListener('mouseup', cancelPress);
        container.addEventListener('mouseleave', cancelPress);

        container.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.widget-card');
            if (!card) return;
            e.preventDefault();
            e.stopPropagation();
            const widgetId = card.dataset.widgetId;
            const info = AVAILABLE_WIDGETS.find(w => w.id === widgetId);
            if (confirm(`Удалить виджет «${info ? info.name : widgetId}»?`)) {
                removeWidget(widgetId);
            }
        });

        log('✅ Обработчики установлены');
    }

    installDelegatedHandlers();

    // ═══════════════════════════════════════════════════════════
    //  СТИЛИ
    // ═══════════════════════════════════════════════════════════
    function ensureStyles() {
        if (document.getElementById('widgetPickerStylesV5')) return;
        const style = document.createElement('style');
        style.id = 'widgetPickerStylesV5';
        style.textContent = `
            .widget-card {
                position: relative;
                overflow: hidden;
                cursor: pointer;
                border-radius: 14px;
                padding: 14px 16px;
                margin-bottom: 10px;
                background: linear-gradient(135deg,
                    rgba(108, 92, 231, 0.20),
                    rgba(0, 184, 148, 0.12));
                border: 1px solid rgba(108, 92, 231, 0.35);
                transition: background 0.25s, border-color 0.25s, transform 0.15s, box-shadow 0.2s;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
                -webkit-user-select: none;
            }
            .widget-card:hover {
                background: linear-gradient(135deg,
                    rgba(108, 92, 231, 0.30),
                    rgba(0, 184, 148, 0.20));
                border-color: rgba(108, 92, 231, 0.55);
                transform: translateY(-1px);
                box-shadow: 0 6px 22px rgba(108, 92, 231, 0.25);
            }
            .widget-card:active { transform: scale(0.98); }
            .widget-card.pressing {
                transform: scale(0.97);
                box-shadow: 0 0 0 2px rgba(255, 159, 67, 0.5),
                            0 6px 22px rgba(255, 159, 67, 0.3);
            }
            .widget-card .wc-header {
                display: flex; align-items: center; gap: 12px; margin-bottom: 10px;
            }
            .widget-card .wc-icon {
                width: 42px; height: 42px; border-radius: 12px;
                background: linear-gradient(135deg, #6c5ce7, #00b894);
                display: flex; align-items: center; justify-content: center;
                font-size: 22px; flex-shrink: 0;
                box-shadow: 0 4px 12px rgba(108, 92, 231, 0.35);
            }
            .widget-card .wc-title-block { flex: 1; min-width: 0; }
            .widget-card .wc-title {
                font-size: 14px; font-weight: 700; color: #fff;
                margin-bottom: 2px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .widget-card .wc-subtitle {
                font-size: 11px; color: #aaa;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .widget-card.weather .wc-body {
                display: flex; align-items: center; gap: 14px; padding-top: 4px;
            }
            .widget-card.weather .wc-weather-main {
                display: flex; align-items: center; gap: 10px; flex: 1;
            }
            .widget-card.weather .wc-weather-icon {
                font-size: 40px; line-height: 1;
                filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
            }
            .widget-card.weather .wc-weather-temp {
                font-size: 26px; font-weight: 800; color: #fff;
                line-height: 1; font-variant-numeric: tabular-nums;
            }
            .widget-card.weather .wc-weather-desc {
                font-size: 12px; color: #ccc; margin-top: 4px;
            }
            .widget-card.weather .wc-weather-extra {
                display: flex; flex-direction: column; gap: 2px;
                text-align: right; font-size: 11px; color: #999;
                flex-shrink: 0;
            }
            .widget-card.weather .wc-weather-extra .wc-minmax { color: #feca57; font-weight: 700; }
            .widget-card.weather .wc-weather-extra .wc-feels { color: #a78bfa; }
            /* Модалка */
            #widgetPickerModal { display: none; }
            #widgetPickerModal.active { display: flex; }
            #widgetPickerModal .wp-content {
                background: #1a1a2e; border-radius: 20px;
                max-width: 440px; width: 100%; max-height: 88vh;
                display: flex; flex-direction: column;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
                overflow: hidden;
            }
            #widgetPickerModal .wp-header {
                display: flex; align-items: center; gap: 12px;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                background: linear-gradient(135deg, rgba(108, 92, 231, 0.12), rgba(0, 184, 148, 0.06));
                flex-shrink: 0;
            }
            #widgetPickerModal .wp-header h2 {
                flex: 1; min-width: 0;
                font-size: 17px; font-weight: 700; color: #fff; margin: 0;
            }
            #widgetPickerModal .wp-close {
                width: 34px; height: 34px; border-radius: 50%; border: none;
                background: rgba(255, 255, 255, 0.06); color: #888; font-size: 16px;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            #widgetPickerModal .wp-close:hover {
                background: rgba(255, 107, 107, 0.2); color: #ff6b6b;
            }
            #widgetPickerModal .wp-body {
                flex: 1; overflow-y: auto; padding: 16px 20px; min-height: 0;
            }
            #widgetPickerModal .wp-hint {
                font-size: 12px; color: #888; margin-bottom: 16px;
                line-height: 1.5; text-align: center;
            }
            #widgetPickerModal .wp-widget-item {
                display: flex; align-items: center; gap: 14px;
                padding: 14px 16px; border-radius: 14px;
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.08);
                margin-bottom: 10px; cursor: pointer;
                transition: all 0.18s;
                -webkit-tap-highlight-color: transparent;
            }
            #widgetPickerModal .wp-widget-item:hover {
                background: rgba(108, 92, 231, 0.12);
                border-color: rgba(108, 92, 231, 0.35);
            }
            #widgetPickerModal .wp-widget-item:active { transform: scale(0.98); }
            #widgetPickerModal .wp-widget-item.added {
                background: linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(108, 92, 231, 0.08));
                border-color: rgba(0, 184, 148, 0.4);
            }
            #widgetPickerModal .wp-widget-icon {
                width: 46px; height: 46px; border-radius: 12px;
                background: linear-gradient(135deg, #6c5ce7, #00b894);
                display: flex; align-items: center; justify-content: center;
                font-size: 22px; flex-shrink: 0;
                box-shadow: 0 4px 12px rgba(108, 92, 231, 0.35);
            }
            #widgetPickerModal .wp-widget-info { flex: 1; min-width: 0; }
            #widgetPickerModal .wp-widget-name {
                font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 3px;
            }
            #widgetPickerModal .wp-widget-desc {
                font-size: 12px; color: #888; line-height: 1.4;
            }
            #widgetPickerModal .wp-widget-status {
                font-size: 12px; font-weight: 700;
                padding: 4px 10px; border-radius: 8px; flex-shrink: 0;
                background: rgba(108, 92, 231, 0.2); color: #a78bfa;
                border: 1px solid rgba(108, 92, 231, 0.4);
            }
            #widgetPickerModal .wp-widget-item.added .wp-widget-status {
                background: rgba(0, 184, 148, 0.2); color: #00b894;
                border-color: rgba(0, 184, 148, 0.4);
            }
            #widgetPickerModal .wp-footer {
                padding: 12px 20px 18px;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
                background: rgba(255, 255, 255, 0.02);
                flex-shrink: 0;
            }
            #widgetPickerModal .wp-footer .btn {
                width: 100%; padding: 12px; font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }

    function openWidgetPicker() {
        ensureStyles();
        const existing = document.getElementById('widgetPickerModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'widgetPickerModal';
        modal.className = 'image-modal active';
        modal.innerHTML = `
            <div class="wp-content" onclick="event.stopPropagation()">
                <div class="wp-header">
                    <h2>🧩 Виджеты</h2>
                    <button class="wp-close" id="wpCloseBtn">✕</button>
                </div>
                <div class="wp-body">
                    <div class="wp-hint">
                        Виджеты появляются над списком чатов.<br>
                        <strong style="color:#feca57;">Долгое нажатие</strong> на виджет — удалить.
                    </div>
                    <div id="wpWidgetsList"></div>
                </div>
                <div class="wp-footer">
                    <button class="btn" id="wpDoneBtn">✅ Готово</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        renderPickerList();

        modal.querySelector('#wpCloseBtn').addEventListener('click', () => modal.remove());
        modal.querySelector('#wpDoneBtn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    function renderPickerList() {
        const list = document.getElementById('wpWidgetsList');
        if (!list) return;
        list.innerHTML = AVAILABLE_WIDGETS.map(w => {
            const isAdded = _widgets.some(x => x.id === w.id);
            return `
                <div class="wp-widget-item ${isAdded ? 'added' : ''}" data-widget-id="${w.id}">
                    <div class="wp-widget-icon">${w.icon}</div>
                    <div class="wp-widget-info">
                        <div class="wp-widget-name">${escapeHtmlSafe(w.name)}</div>
                        <div class="wp-widget-desc">${escapeHtmlSafe(w.description)}</div>
                    </div>
                    <div class="wp-widget-status">${isAdded ? '✓ Добавлен' : '+ Добавить'}</div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.wp-widget-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.widgetId;
                const isAdded = _widgets.some(x => x.id === id);
                if (isAdded) {
                    if (confirm(`Удалить виджет «${AVAILABLE_WIDGETS.find(w => w.id === id).name}»?`)) {
                        removeWidget(id);
                        renderPickerList();
                    }
                } else {
                    if (addWidget(id)) renderPickerList();
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  ПУНКТ В МЕНЮ «⋯»
    // ═══════════════════════════════════════════════════════════
    function injectWidgetMenuItem() {
        const menu = document.getElementById('chatsActionsMenu');
        if (!menu) return false;
        if (menu.querySelector('[data-action="widgets"]')) return true;

        const item = document.createElement('div');
        item.className = 'ucm-item';
        item.dataset.action = 'widgets';
        item.innerHTML = `
            <span class="ucm-icon">🧩</span>
            <span class="ucm-label">Виджеты</span>
        `;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            menu.classList.remove('show');
            const backdrop = document.getElementById('chatsActionsMenuBackdrop');
            if (backdrop) backdrop.classList.remove('show');
            setTimeout(() => openWidgetPicker(), 150);
        });

        const cacheItem = menu.querySelector('[data-action="clear-cache"]');
        if (cacheItem) {
            const divider = document.createElement('div');
            divider.className = 'ucm-divider';
            cacheItem.parentNode.insertBefore(divider, cacheItem);
            cacheItem.parentNode.insertBefore(item, cacheItem);
        } else {
            menu.appendChild(item);
        }

        log('Пункт «Виджеты» вставлен');
        return true;
    }

    const menuObserver = new MutationObserver(() => {
        if (document.getElementById('chatsActionsMenu')) injectWidgetMenuItem();
    });
    menuObserver.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', (e) => {
        if (e.target.closest('#chatsActionsBtn')) {
            setTimeout(injectWidgetMenuItem, 30);
            setTimeout(injectWidgetMenuItem, 150);
        }
    }, true);

    setTimeout(injectWidgetMenuItem, 2000);
    setTimeout(injectWidgetMenuItem, 5000);

    // ═══════════════════════════════════════════════════════════
    //  ПАТЧ showChatsScreen — запускаем фоновую загрузку
    // ═══════════════════════════════════════════════════════════
    if (typeof showChatsScreen === 'function') {
        const _orig = showChatsScreen;
        showChatsScreen = function() {
            const r = _orig.apply(this, arguments);
            setTimeout(() => {
                if (_widgets.find(w => w.id === 'weather')) {
                    loadWeatherDataInBackground();
                }
            }, 200);
            return r;
        };
    }

    // ═══════════════════════════════════════════════════════════
    //  АВТООБНОВЛЕНИЕ — раз в 30 минут
    // ═══════════════════════════════════════════════════════════
    setInterval(() => {
        if (document.hidden) return;
        if (!state || state.currentScreen !== 'chats') return;
        if (!_widgets.find(w => w.id === 'weather')) return;
        log('Автообновление погоды');
        loadWeatherDataInBackground();
    }, CFG.WEATHER_REFRESH_MS);

    // ═══════════════════════════════════════════════════════════
//  ЗАПУСК
// ═══════════════════════════════════════════════════════════

// 🎯 СНАЧАЛА — CSS. Чтобы виджеты выглядели правильно с первой секунды
ensureStyles();

loadWidgets();
loadCache();

    // Фоновая загрузка погоды при старте, если виджет добавлен
    setTimeout(() => {
        if (_widgets.find(w => w.id === 'weather')) {
            loadWeatherDataInBackground();
        }
    }, 2000);

    // ═══════════════════════════════════════════════════════════
    //  API
    // ═══════════════════════════════════════════════════════════
    window.Widgets = {
        openPicker: openWidgetPicker,
        add: addWidget,
        remove: removeWidget,
        list: () => _widgets.slice(),
        available: () => AVAILABLE_WIDGETS.slice(),
        refresh: () => rerenderChatsList(),
        refreshWeather: () => {
            delete _cache[getCacheKey('weather', 'location')];
            const loc = readCacheRaw('weather', 'location');
            saveCache();
            return loadWeatherDataInBackground();
        },
        debug: () => {
            const container = document.getElementById('chatsList');
            const info = {
                widgets: _widgets.length,
                cardsInDom: container ? container.querySelectorAll('.widget-card').length : 0,
                innerHTMLPatched: _innerHTMLPatched,
                cachedLocation: readCacheRaw('weather', 'location'),
                cacheAge: (Date.now() - readCacheTs('weather', 'location')) / 1000 + ' сек',
                isFresh: isCacheFresh('weather', 'location'),
            };
            console.log('=== WIDGETS DEBUG v5 ===');
            console.table(info);
            return info;
        },
        reset: () => {
            if (!confirm('Удалить ВСЕ виджеты?')) return;
            _widgets = [];
            saveWidgets();
            _cache = {};
            saveCache();
            document.querySelectorAll('.widget-card').forEach(el => el.remove());
            if (typeof showToast === 'function') showToast('🗑️ Все виджеты удалены', 1500);
        },
        clearWeatherCache: () => {
            delete _cache[getCacheKey('weather', 'location')];
            // Также чистим weather-кэши по координатам
            Object.keys(_cache).forEach(k => {
                if (k.startsWith('weather::')) delete _cache[k];
            });
            saveCache();
            console.log('🧩 [Widgets] Кэш погоды очищен');
        },
    };

    console.log('🧩 [Widgets v5] Готово');
    console.log('Проверить: Widgets.debug()');

})();

