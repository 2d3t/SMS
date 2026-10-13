<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pogoda2.js</title>
<style>
    body { font-family: sans-serif; padding: 20px; background: #f5f5f5; }
</style>
</head>
<body>
// ═══════════════════════════════════════════════════════════════
//  🧩 WIDGETS MODULE v6 — погода + прогноз + свайп по дням
//  ─────────────────────────────────────────────────────────────
//  Новое в v6:
//   • Прогноз на 4 дня прямо в карточке (тап → развернуть)
//   • Свайп влево/вправо по развёрнутой карточке = смена дня
//   • Тап по дню в ленте = выбор дня
//   • Точки-индикаторы + подсветка активного дня
//   • Клавиши ← → на десктопе
//   • Мягкие вибро-отклики на смене дня и на границах
//   • Всё из кэша, без лишних запросов
// ═══════════════════════════════════════════════════════════════

(function installWidgetsModuleV6() {
    'use strict';

    console.log('🧩 [Widgets v6] Запуск…');

    const CFG = {
        STORAGE_KEY: 'smschat_widgets',
        CACHE_KEY: 'smschat_widgets_cache',
        EXPANDED_KEY: 'smschat_weather_expanded',
        CACHE_TTL_MS: 30 * 60 * 1000,
        WEATHER_REFRESH_MS: 30 * 60 * 1000,
        SWIPE_THRESHOLD: 50,
        LONG_PRESS_MS: 600,
        DEBUG: true,
    };

    const log = (...a) => CFG.DEBUG && console.log('🧩 [Widgets v6]', ...a);
    const warn = (...a) => console.warn('🧩 [Widgets v6]', ...a);

    const AVAILABLE_WIDGETS = [
        { id: 'weather', name: 'Погода', icon: '⛅', description: 'Текущая погода и прогноз на 4 дня' },
    ];

    let _widgets = [];
    let _cache = {};

    // ─── Состояние UI виджета погоды ───
    let _weatherExpanded = (() => {
        try { return localStorage.getItem(CFG.EXPANDED_KEY) === '1'; }
        catch (e) { return false; }
    })();
    let _weatherDayIndex = 0;

    function setWeatherExpanded(v) {
        _weatherExpanded = !!v;
        try { localStorage.setItem(CFG.EXPANDED_KEY, _weatherExpanded ? '1' : '0'); } catch (e) {}
    }

    // ═══════════════════════════════════════════════════════════
    //  ХРАНИЛИЩЕ ВИДЖЕТОВ
    // ═══════════════════════════════════════════════════════════
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

    function readCacheRaw(id, sub) {
        const entry = _cache[getCacheKey(id, sub)];
        return entry ? entry.data : null;
    }

    function readCacheTs(id, sub) {
        const entry = _cache[getCacheKey(id, sub)];
        return entry ? entry.ts : 0;
    }

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
        const cached = readCacheRaw('weather', 'location');
        if (cached && isCacheFresh('weather', 'location')) return cached;

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

        if (cached) return cached;
        return { city: 'Минск', country: 'Belarus', lat: 53.9, lon: 27.5667, timezone: 'Europe/Minsk', _fallback: true };
    }

    async function fetchWeatherData() {
        const location = await detectLocationByIp();
        const subKey = `${location.lat.toFixed(3)}_${location.lon.toFixed(3)}`;

        if (isCacheFresh('weather', subKey)) {
            const cached = readCacheRaw('weather', subKey);
            if (cached) return { ...cached, location };
        }

        try {
            const url = `https://api.open-meteo.com/v1/forecast?` +
                `latitude=${location.lat}&longitude=${location.lon}` +
                `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
                `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum` +
                `&timezone=${encodeURIComponent(location.timezone)}&forecast_days=4`;

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

                // 🆕 Прогноз на 4 дня
                forecast: (d.time || []).map((date, i) => ({
                    date,
                    code: d.weather_code?.[i],
                    min: d.temperature_2m_min?.[i],
                    max: d.temperature_2m_max?.[i],
                    precip: d.precipitation_sum?.[i] || 0,
                })),
            };

            writeCache('weather', weather, subKey);
            return { ...weather, location };
        } catch (e) {
            warn('Погода недоступна:', e.message);

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

    function escapeHtmlSafe(s) {
        if (typeof escapeHtml === 'function') return escapeHtml(s);
        const div = document.createElement('div');
        div.textContent = s == null ? '' : String(s);
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════════════════════
    //  ДОБАВЛЕНИЕ / УДАЛЕНИЕ ВИДЖЕТОВ
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

        if (widgetId === 'weather') loadWeatherDataInBackground();
        rerenderChatsList();
        return true;
    }

    function removeWidget(widgetId) {
        const idx = _widgets.findIndex(w => w.id === widgetId);
        if (idx === -1) return false;
        _widgets.splice(idx, 1);
        saveWidgets();

        if (widgetId === 'weather') {
            setWeatherExpanded(false);
            _weatherDayIndex = 0;
        }

        if (typeof showToast === 'function') showToast('🗑️ Виджет удалён', 1500);
        if (typeof soundManager !== 'undefined') { try { soundManager.play('delete'); } catch (e) {} }
        if (navigator.vibrate) navigator.vibrate(20);

        document.querySelectorAll('.widget-card').forEach(el => el.remove());
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    //  HTML КАРТОЧКИ ПОГОДЫ
    // ═══════════════════════════════════════════════════════════
    function buildWeatherCardHTML() {
        const location = readCacheRaw('weather', 'location');
        let weather = null;
        if (location) {
            const subKey = `${location.lat.toFixed(3)}_${location.lon.toFixed(3)}`;
            weather = readCacheRaw('weather', subKey);
        }

        // ─── Скелет ───
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

        const flag = getCountryFlag(location.country);
        const staleMark = weather._stale ? ' <span style="color:#feca57;font-size:10px;">•</span>' : '';

        const forecast = Array.isArray(weather.forecast) ? weather.forecast : [];
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxIdx = Math.max(0, forecast.length - 1);
        if (_weatherDayIndex > maxIdx) _weatherDayIndex = maxIdx;
        if (_weatherDayIndex < 0) _weatherDayIndex = 0;

        // Сегодняшний день (из current)
        const todayDesc = describeWeatherCode(weather.code, weather.isDay);

        // Выбранный день
        let bodyIcon = todayDesc.icon;
        let bodyTemp = Math.round(weather.temp);
        let bodyDesc = todayDesc.text;
        let bodyMin = Math.round(weather.minTemp);
        let bodyMax = Math.round(weather.maxTemp);
        let bodyFeelsLabel = `Ощущ. ${Math.round(weather.apparentTemp)}°`;
        let selectedLabel = 'Сегодня';

        if (_weatherDayIndex > 0 && forecast[_weatherDayIndex]) {
            const d = forecast[_weatherDayIndex];
            const dDesc = describeWeatherCode(d.code, true);
            bodyIcon = dDesc.icon;
            bodyTemp = Math.round(d.max);
            bodyDesc = dDesc.text;
            bodyMin = Math.round(d.min);
            bodyMax = Math.round(d.max);
            bodyFeelsLabel = d.precip > 0
                ? `💧 ${d.precip.toFixed(1)} мм`
                : 'Без осадков';

            const date = new Date(d.date + 'T00:00:00');
            const diff = Math.round((date - today) / 86400000);
            if (diff === 1) selectedLabel = 'Завтра';
            else selectedLabel = dayNames[date.getDay()] + ', ' +
                date.getDate() + '.' + String(date.getMonth() + 1).padStart(2, '0');
        }

        // ─── Лента дней (в развёрнутом виде) ───
        let stripHTML = '';
        if (_weatherExpanded && forecast.length > 0) {
            stripHTML = `
                <div class="wc-strip-wrap">
                    <div class="wc-strip">
                        ${forecast.map((d, i) => {
                            const date = new Date(d.date + 'T00:00:00');
                            const diff = Math.round((date - today) / 86400000);
                            let label;
                            if (diff === 0) label = 'Сегодня';
                            else if (diff === 1) label = 'Завтра';
                            else label = dayNames[date.getDay()];

                            const dd = describeWeatherCode(d.code, true);
                            const active = i === _weatherDayIndex ? 'active' : '';

                            return `
                                <div class="wc-day ${active}" data-day-index="${i}">
                                    <div class="wc-day-label">${label}</div>
                                    <div class="wc-day-icon">${dd.icon}</div>
                                    <div class="wc-day-temp">
                                        <span class="wc-day-max">${Math.round(d.max)}°</span>
                                        <span class="wc-day-min">${Math.round(d.min)}°</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="wc-dots">
                        ${forecast.map((_, i) =>
                            `<span class="wc-dot ${i === _weatherDayIndex ? 'active' : ''}"></span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }

        const hint = _weatherExpanded
            ? '<div class="wc-hint">👈 Свайп по дням · Тап — свернуть 👉</div>'
            : '<div class="wc-hint">👆 Прогноз на 4 дня</div>';

        return `
            <div class="widget-card weather ${_weatherExpanded ? 'expanded' : ''}"
                 data-widget-id="weather"
                 data-day-index="${_weatherDayIndex}">
                <div class="wc-header">
                    <div class="wc-icon">⛅</div>
                    <div class="wc-title-block">
                        <div class="wc-title">${flag} ${escapeHtmlSafe(location.city || '—')}</div>
                        <div class="wc-subtitle">${selectedLabel}${staleMark}</div>
                    </div>
                </div>
                <div class="wc-body">
                    <div class="wc-weather-main">
                        <div class="wc-weather-icon">${bodyIcon}</div>
                        <div>
                            <div class="wc-weather-temp">${bodyTemp}°</div>
                            <div class="wc-weather-desc">${escapeHtmlSafe(bodyDesc)}</div>
                        </div>
                    </div>
                    <div class="wc-weather-extra">
                        <div class="wc-minmax">${bodyMin}° / ${bodyMax}°</div>
                        <div class="wc-feels">${bodyFeelsLabel}</div>
                    </div>
                </div>
                ${stripHTML}
                ${hint}
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════
    //  HTML ВСЕХ ВИДЖЕТОВ
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
    // ═══════════════════════════════════════════════════════════
    let _weatherLoadPromise = null;

    async function loadWeatherDataInBackground() {
        if (_weatherLoadPromise) return _weatherLoadPromise;

        _weatherLoadPromise = (async () => {
            try {
                const before = readCacheRaw('weather', 'location');
                const beforeSub = before ? `${before.lat.toFixed(3)}_${before.lon.toFixed(3)}` : null;
                const beforeData = beforeSub ? readCacheRaw('weather', beforeSub) : null;

                const data = await fetchWeatherData();

                const after = readCacheRaw('weather', 'location');
                const afterSub = after ? `${after.lat.toFixed(3)}_${after.lon.toFixed(3)}` : null;
                const afterData = afterSub ? readCacheRaw('weather', afterSub) : null;

                const wasSkeleton = !beforeData;
                const changed = !wasSkeleton && afterData && beforeData &&
                    (beforeData.temp !== afterData.temp ||
                     beforeData.code !== afterData.code);

                if (wasSkeleton || changed) {
                    log('Ререндер виджетов после загрузки погоды');
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

    function replaceWeatherCardInDom() {
        const container = document.getElementById('chatsList');
        if (!container) return;

        const oldCard = container.querySelector('.widget-card.weather');
        if (!oldCard) return;

        const newHtml = buildWeatherCardHTML();
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const newCard = temp.firstElementChild;
        if (!newCard) return;

        oldCard.replaceWith(newCard);
        log('Карточка погоды обновлена в DOM');
    }

    /** Плавная анимация смены состояния/дня карточки */
    function animateWeatherCardToggle(oldCard) {
        const wasExpanded = oldCard.classList.contains('expanded');
        const willExpand = _weatherExpanded;

        const newHtml = buildWeatherCardHTML();
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const newCard = temp.firstElementChild;
        if (!newCard) return;

        // Только смена дня — fade без анимации высоты
        if (wasExpanded === willExpand) {
            newCard.style.opacity = '0';
            newCard.style.transition = 'opacity 0.18s ease';
            oldCard.replaceWith(newCard);
            requestAnimationFrame(() => { newCard.style.opacity = '1'; });
            setTimeout(() => {
                newCard.style.opacity = '';
                newCard.style.transition = '';
            }, 200);
            return;
        }

        // Разворот/сворачивание — анимируем высоту
        const oldH = oldCard.offsetHeight;
        oldCard.style.height = oldH + 'px';
        oldCard.style.overflow = 'hidden';
        oldCard.style.transition = 'height 0.3s ease';

        oldCard.replaceWith(newCard);

        const newH = newCard.offsetHeight;
        newCard.style.height = oldH + 'px';
        newCard.style.overflow = 'hidden';
        newCard.style.transition = 'height 0.3s ease';

        requestAnimationFrame(() => {
            newCard.style.height = newH + 'px';
        });

        setTimeout(() => {
            newCard.style.height = '';
            newCard.style.overflow = '';
            newCard.style.transition = '';
        }, 320);
    }

    // ═══════════════════════════════════════════════════════════
    //  ПАТЧ innerHTML #chatsList
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
        setTimeout(() => {
            const card = document.querySelector('.widget-card.weather');
            if (!card) return;
            const hasSkeleton = card.querySelector('.wc-weather-temp')?.textContent === '—°';
            if (!hasSkeleton) return;
            replaceWeatherCardInDom();
        }, 100);
    }

    // ═══════════════════════════════════════════════════════════
    //  ДЕЛЕГИРОВАННЫЕ ОБРАБОТЧИКИ
    // ═══════════════════════════════════════════════════════════
    function installDelegatedHandlers() {
        const container = document.getElementById('chatsList');
        if (!container) { setTimeout(installDelegatedHandlers, 500); return; }
        if (container._widgetsV6Handlers) return;
        container._widgetsV6Handlers = true;

        // ─── Долгое нажатие (для удаления) ───
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
            }, CFG.LONG_PRESS_MS);
        }

        // ─── КЛИК: разворот / смена дня / сворачивание ───
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.widget-card');
            if (!card) return;
            if (fired) { fired = false; return; }

            const widgetId = card.dataset.widgetId;
            if (widgetId !== 'weather') return;

            // Тап по конкретному дню в ленте
            const dayEl = e.target.closest('.wc-day');
            if (dayEl && _weatherExpanded) {
                const idx = parseInt(dayEl.dataset.dayIndex, 10);
                if (!isNaN(idx) && idx !== _weatherDayIndex) {
                    _weatherDayIndex = idx;
                    if (navigator.vibrate) navigator.vibrate(8);
                    animateWeatherCardToggle(card);
                }
                return;
            }

            // Обычный тап — свернуть/развернуть
            setWeatherExpanded(!_weatherExpanded);
            if (!_weatherExpanded) _weatherDayIndex = 0;
            animateWeatherCardToggle(card);
        });

        // ─── Долгое нажатие (touch) ───
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

        // ─── Долгое нажатие (mouse) ───
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

        // ═══ СВАЙП ПО ДНЯМ (только для развёрнутой карточки) ═══
        let swipeStartX = 0, swipeStartY = 0, swipeCard = null, swipeActive = false;

        container.addEventListener('touchstart', (e) => {
            const card = e.target.closest('.widget-card.weather.expanded');
            if (!card) return;
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            swipeStartX = t.clientX;
            swipeStartY = t.clientY;
            swipeCard = card;
            swipeActive = false;
            card._edgeBuzzed = false;
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!swipeCard) return;
            const t = e.touches[0];
            const dx = t.clientX - swipeStartX;
            const dy = t.clientY - swipeStartY;

            if (!swipeActive) {
                if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                    swipeActive = true;
                } else if (Math.abs(dy) > 12) {
                    swipeCard = null;
                    return;
                }
            }

            if (swipeActive) {
                if (e.cancelable) e.preventDefault();

                const strip = swipeCard.querySelector('.wc-strip');
                if (strip) {
                    const dayCount = swipeCard.querySelectorAll('.wc-day').length || 1;
                    const maxIdx = dayCount - 1;
                    const atEdgeLeft = _weatherDayIndex <= 0 && dx > 0;
                    const atEdgeRight = _weatherDayIndex >= maxIdx && dx < 0;
                    const resist = (atEdgeLeft || atEdgeRight) ? 0.3 : 1;

                    strip.style.transform = `translateX(${dx * resist}px)`;
                    strip.style.transition = 'none';

                    // Вибро-«отказ» на границе — один раз за жест
                    if ((atEdgeLeft || atEdgeRight) && navigator.vibrate && !swipeCard._edgeBuzzed) {
                        swipeCard._edgeBuzzed = true;
                        navigator.vibrate(5);
                    }
                }
            }
        }, { passive: false });

        container.addEventListener('touchend', (e) => {
            if (!swipeCard) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - swipeStartX;

            const strip = swipeCard.querySelector('.wc-strip');
            if (strip) {
                strip.style.transition = 'transform 0.25s ease';
                strip.style.transform = '';
            }

            if (swipeActive) {
                const dayCount = swipeCard.querySelectorAll('.wc-day').length || 1;
                const maxIdx = dayCount - 1;

                if (dx < -CFG.SWIPE_THRESHOLD && _weatherDayIndex < maxIdx) {
                    _weatherDayIndex++;
                    if (navigator.vibrate) navigator.vibrate(8);
                    animateWeatherCardToggle(swipeCard);
                } else if (dx > CFG.SWIPE_THRESHOLD && _weatherDayIndex > 0) {
                    _weatherDayIndex--;
                    if (navigator.vibrate) navigator.vibrate(8);
                    animateWeatherCardToggle(swipeCard);
                }
            }

            swipeCard = null;
            swipeActive = false;
        }, { passive: true });

        container.addEventListener('touchcancel', () => {
            if (swipeCard) {
                const strip = swipeCard.querySelector('.wc-strip');
                if (strip) {
                    strip.style.transition = 'transform 0.25s ease';
                    strip.style.transform = '';
                }
            }
            swipeCard = null;
            swipeActive = false;
        });

        // ─── Клавиатура (десктоп) ───
        container.addEventListener('keydown', (e) => {
            if (!_weatherExpanded) return;
            const card = e.target.closest('.widget-card.weather');
            if (!card) return;

            const maxIdx = (card.querySelectorAll('.wc-day').length || 1) - 1;
            if (e.key === 'ArrowRight' && _weatherDayIndex < maxIdx) {
                _weatherDayIndex++;
                animateWeatherCardToggle(card);
            } else if (e.key === 'ArrowLeft' && _weatherDayIndex > 0) {
                _weatherDayIndex--;
                animateWeatherCardToggle(card);
            }
        });

        log('✅ Обработчики установлены');
    }

    installDelegatedHandlers();

    // ═══════════════════════════════════════════════════════════
    //  СТИЛИ
    // ═══════════════════════════════════════════════════════════
    function ensureStyles() {
        if (document.getElementById('widgetPickerStylesV6')) return;
        const style = document.createElement('style');
        style.id = 'widgetPickerStylesV6';
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

            /* ─── Лента дней ─── */
            .widget-card.weather .wc-strip-wrap {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                animation: wcFadeIn 0.25s ease;
            }
            @keyframes wcFadeIn {
                from { opacity: 0; transform: translateY(-4px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .widget-card.weather .wc-strip {
                display: flex;
                gap: 6px;
                touch-action: pan-y;
                will-change: transform;
            }
            .widget-card.weather .wc-day {
                flex: 1;
                min-width: 0;
                text-align: center;
                padding: 8px 4px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.05);
                transition: background 0.2s, border-color 0.2s, transform 0.15s;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }
            .widget-card.weather .wc-day:hover {
                background: rgba(255, 255, 255, 0.07);
            }
            .widget-card.weather .wc-day.active {
                background: linear-gradient(135deg,
                    rgba(108, 92, 231, 0.28),
                    rgba(0, 184, 148, 0.14));
                border-color: rgba(108, 92, 231, 0.5);
                box-shadow: 0 3px 12px rgba(108, 92, 231, 0.25);
            }
            .widget-card.weather .wc-day-label {
                font-size: 10px;
                color: #aaa;
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .widget-card.weather .wc-day.active .wc-day-label {
                color: #c4b5fd;
                font-weight: 700;
            }
            .widget-card.weather .wc-day-icon {
                font-size: 22px;
                line-height: 1;
                margin-bottom: 4px;
                transition: transform 0.2s;
            }
            .widget-card.weather .wc-day.active .wc-day-icon {
                transform: scale(1.1);
            }
            .widget-card.weather .wc-day-temp {
                display: flex;
                justify-content: center;
                gap: 4px;
                font-size: 12px;
                font-variant-numeric: tabular-nums;
            }
            .widget-card.weather .wc-day-max { color: #fff; font-weight: 700; }
            .widget-card.weather .wc-day-min { color: #888; }

            /* ─── Точки ─── */
            .widget-card.weather .wc-dots {
                display: flex;
                justify-content: center;
                gap: 6px;
                margin-top: 10px;
            }
            .widget-card.weather .wc-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.15);
                transition: all 0.25s ease;
            }
            .widget-card.weather .wc-dot.active {
                width: 18px;
                border-radius: 3px;
                background: linear-gradient(90deg, #6c5ce7, #00b894);
                box-shadow: 0 0 8px rgba(108, 92, 231, 0.5);
            }

            /* ─── Подсказка ─── */
            .widget-card.weather .wc-hint {
                text-align: center;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.35);
                margin-top: 10px;
                letter-spacing: 0.3px;
                transition: color 0.2s;
            }
            .widget-card.weather:hover .wc-hint {
                color: rgba(255, 255, 255, 0.55);
            }

            /* ─── Модалка выбора виджетов ─── */
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

    // ═══════════════════════════════════════════════════════════
    //  МОДАЛКА ВЫБОРА ВИДЖЕТОВ
    // ═══════════════════════════════════════════════════════════
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
                        <strong style="color:#feca57;">Тап</strong> — прогноз на 4 дня,<br>
                        <strong style="color:#feca57;">свайп</strong> по дням,<br>
                        <strong style="color:#feca57;">долгое нажатие</strong> — удалить.
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
    //  ПАТЧ showChatsScreen
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
        if (typeof state !== 'undefined' && state && state.currentScreen !== 'chats') return;
        if (!_widgets.find(w => w.id === 'weather')) return;
        log('Автообновление погоды');
        loadWeatherDataInBackground();
    }, CFG.WEATHER_REFRESH_MS);

    // ═══════════════════════════════════════════════════════════
    //  ЗАПУСК
    // ═══════════════════════════════════════════════════════════
    ensureStyles();
    loadWidgets();
    loadCache();

    setTimeout(() => {
        if (_widgets.find(w => w.id === 'weather')) {
            loadWeatherDataInBackground();
        }
    }, 2000);

    // ═══════════════════════════════════════════════════════════
    //  ПУБЛИЧНЫЙ API
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
            saveCache();
            return loadWeatherDataInBackground();
        },
        expand: () => {
            setWeatherExpanded(true);
            _weatherDayIndex = 0;
            replaceWeatherCardInDom();
        },
        collapse: () => {
            setWeatherExpanded(false);
            _weatherDayIndex = 0;
            replaceWeatherCardInDom();
        },
        selectDay: (idx) => {
            const loc = readCacheRaw('weather', 'location');
            if (!loc) return;
            const subKey = `${loc.lat.toFixed(3)}_${loc.lon.toFixed(3)}`;
            const w = readCacheRaw('weather', subKey);
            if (!w || !Array.isArray(w.forecast)) return;
            const maxIdx = Math.max(0, w.forecast.length - 1);
            _weatherDayIndex = Math.max(0, Math.min(maxIdx, idx | 0));
            setWeatherExpanded(true);
            const card = document.querySelector('.widget-card.weather');
            if (card) animateWeatherCardToggle(card);
            else replaceWeatherCardInDom();
        },
        debug: () => {
            const container = document.getElementById('chatsList');
            const info = {
                widgets: _widgets.length,
                cardsInDom: container ? container.querySelectorAll('.widget-card').length : 0,
                innerHTMLPatched: _innerHTMLPatched,
                expanded: _weatherExpanded,
                dayIndex: _weatherDayIndex,
                cachedLocation: readCacheRaw('weather', 'location'),
                cacheAge: (Date.now() - readCacheTs('weather', 'location')) / 1000 + ' сек',
                isFresh: isCacheFresh('weather', 'location'),
            };
            console.log('=== WIDGETS DEBUG v6 ===');
            console.table(info);
            return info;
        },
        reset: () => {
            if (!confirm('Удалить ВСЕ виджеты?')) return;
            _widgets = [];
            saveWidgets();
            _cache = {};
            saveCache();
            setWeatherExpanded(false);
            _weatherDayIndex = 0;
            document.querySelectorAll('.widget-card').forEach(el => el.remove());
            if (typeof showToast === 'function') showToast('🗑️ Все виджеты удалены', 1500);
        },
        clearWeatherCache: () => {
            delete _cache[getCacheKey('weather', 'location')];
            Object.keys(_cache).forEach(k => {
                if (k.startsWith('weather::')) delete _cache[k];
            });
            saveCache();
            console.log('🧩 [Widgets] Кэш погоды очищен');
        },
    };

    console.log('🧩 [Widgets v6] Готово');
    console.log('Проверить: Widgets.debug()');

})();
</body>
</html>