// ═══════════════════════════════════════════════════════════════
//  📻 RADIO WIDGET v1 — бесплатные станции через Radio Browser
//  ─────────────────────────────────────────────────────────────
//  • Поиск по названию через Radio Browser API (без ключей)
//  • Избранное в localStorage (живёт вечно)
//  • Плеер — глобальный <audio> в document.body (не сносится ререндером)
//  • Фильтр HTTPS-потоков (иначе Mixed Content блокирует воспроизведение)
//  • В стиле widget-weather v7: карточка + разворот + долгое нажатие
// ═══════════════════════════════════════════════════════════════

(function installRadioWidgetV1() {
    'use strict';

    console.log('📻 [Radio v1] Запуск…');

    const CFG = {
        WIDGET_KEY: 'smschat_widgets',              // общий список виджетов
        FAV_KEY: 'smschat_radio_favorites',         // избранные станции
        STATE_KEY: 'smschat_radio_state',           // что играло последним
        EXPANDED_KEY: 'smschat_radio_expanded',     // развёрнуто/свёрнуто
        SEARCH_CACHE_KEY: 'smschat_radio_search',   // кэш поиска (на сессию)
        API_BASE: 'https://de1.api.radio-browser.info',
        SEARCH_LIMIT: 20,
        LONG_PRESS_MS: 600,
        DEBUG: true,
    };

    const log = (...a) => CFG.DEBUG && console.log('📻 [Radio v1]', ...a);
    const warn = (...a) => console.warn('📻 [Radio v1]', ...a);

    // Станции по умолчанию — добавим при первом запуске, если избранное пустое
    const DEFAULT_STATIONS = [
        { name: 'Европа Плюс',   search: 'Европа Плюс' },
        { name: 'Relax FM',      search: 'Relax FM' },
    ];

    // ═══════════════════════════════════════════════════════════
    //  СОСТОЯНИЕ
    // ═══════════════════════════════════════════════════════════
    let _expanded = (() => {
        try { return localStorage.getItem(CFG.EXPANDED_KEY) === '1'; }
        catch (e) { return false; }
    })();

    let _favorites = (() => {
        try { return JSON.parse(localStorage.getItem(CFG.FAV_KEY) || '[]'); }
        catch (e) { return []; }
    })();

    let _current = (() => {
        try { return JSON.parse(localStorage.getItem(CFG.STATE_KEY) || 'null'); }
        catch (e) { return null; }
    })();

    let _searchResults = [];
    let _searchQuery = '';
    let _searching = false;
    let _audio = null;
    let _playing = false;
    let _volume = 0.8;

    // ═══════════════════════════════════════════════════════════
    //  УТИЛИТЫ
    // ═══════════════════════════════════════════════════════════
    function escapeHtmlSafe(s) {
        if (typeof escapeHtml === 'function') return escapeHtml(s);
        const div = document.createElement('div');
        div.textContent = s == null ? '' : String(s);
        return div.innerHTML;
    }

    function isRadioAdded() {
        try {
            const raw = localStorage.getItem(CFG.WIDGET_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) && list.some(w => w.id === 'radio');
        } catch (e) { return false; }
    }

    function saveFavorites() {
        try { localStorage.setItem(CFG.FAV_KEY, JSON.stringify(_favorites)); } catch (e) {}
    }

    function saveCurrent() {
        try {
            if (_current) localStorage.setItem(CFG.STATE_KEY, JSON.stringify(_current));
            else localStorage.removeItem(CFG.STATE_KEY);
        } catch (e) {}
    }

    function setExpanded(v) {
        _expanded = !!v;
        try { localStorage.setItem(CFG.EXPANDED_KEY, _expanded ? '1' : '0'); } catch (e) {}
    }

    function stationKey(s) {
        return s.stationuuid || s.url_resolved || s.name;
    }

    function isFavorite(s) {
        const k = stationKey(s);
        return _favorites.some(f => stationKey(f) === k);
    }

    // ═══════════════════════════════════════════════════════════
    //  ПЛЕЕР (глобальный <audio>, один на всё приложение)
    // ═══════════════════════════════════════════════════════════
    function ensureAudio() {
        if (_audio) return _audio;
        _audio = document.createElement('audio');
        _audio.id = 'radioWidgetAudio';
        _audio.preload = 'none';
        _audio.volume = _volume;
        _audio.crossOrigin = 'anonymous';
        _audio.style.display = 'none';
        document.body.appendChild(_audio);

        _audio.addEventListener('playing', () => {
            _playing = true;
            renderRadioCard();
            log('▶️ Играет:', _current?.name);
        });
        _audio.addEventListener('pause', () => {
            _playing = false;
            renderRadioCard();
        });
        _audio.addEventListener('waiting', () => {
            log('⏳ Буферизация…');
        });
        _audio.addEventListener('error', (e) => {
            _playing = false;
            warn('Ошибка потока:', _audio.src);
            if (typeof showToast === 'function') showToast('❌ Не удалось воспроизвести', 2500);
            renderRadioCard();
        });

        return _audio;
    }

    async function playStation(station) {
        if (!station || !station.url_resolved) return;

        // Mixed Content: только HTTPS
        if (!station.url_resolved.startsWith('https://')) {
            if (typeof showToast === 'function') showToast('⚠️ Станция доступна только по HTTP', 2500);
            return;
        }

        const audio = ensureAudio();
        _current = station;
        saveCurrent();

        try {
            audio.src = station.url_resolved;
            audio.load();
            await audio.play();
            _playing = true;
        } catch (e) {
            warn('play() не удался:', e.message);
            _playing = false;
            if (typeof showToast === 'function') showToast('❌ Поток не запустился', 2000);
        }
        renderRadioCard();
    }

    function pauseStation() {
        if (_audio) _audio.pause();
        _playing = false;
        renderRadioCard();
    }

    function togglePlay() {
        if (!_current) {
            // Ничего не выбрано — включаем первую из избранного
            if (_favorites.length > 0) playStation(_favorites[0]);
            else if (typeof showToast === 'function') showToast('📻 Сначала выбери станцию', 2000);
            return;
        }
        if (_playing) pauseStation();
        else playStation(_current);
    }

    function setVolume(v) {
        _volume = Math.max(0, Math.min(1, v));
        if (_audio) _audio.volume = _volume;
    }

    // ═══════════════════════════════════════════════════════════
    //  ПОИСК ЧЕРЕЗ RADIO BROWSER
    // ═══════════════════════════════════════════════════════════
    async function searchStations(query) {
        const q = (query || '').trim();
        if (!q) return [];

        _searching = true;
        renderRadioCard();

        try {
            const url = `${CFG.API_BASE}/json/stations/search?` +
                `name=${encodeURIComponent(q)}` +
                `&limit=${CFG.SEARCH_LIMIT}` +
                `&order=clickcount` +
                `&reverse=true` +
                `&hidebroken=true` +
                `&is_https=true`;

            const res = await fetch(url, {
                headers: { 'User-Agent': 'SMSChatWidget/1.0' },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // Фильтр: только HTTPS-потоки с валидным url_resolved
            const filtered = (Array.isArray(data) ? data : [])
                .filter(s => s.url_resolved && s.url_resolved.startsWith('https://'))
                .map(s => ({
                    stationuuid: s.stationuuid,
                    name: s.name,
                    url_resolved: s.url_resolved,
                    favicon: s.favicon,
                    country: s.country,
                    countrycode: s.countrycode,
                    tags: s.tags,
                    codec: s.codec,
                    bitrate: s.bitrate,
                }));

            log('Найдено:', filtered.length, 'из', data.length);
            return filtered;
        } catch (e) {
            warn('Поиск не удался:', e.message);
            if (typeof showToast === 'function') showToast('❌ Поиск недоступен', 2000);
            return [];
        } finally {
            _searching = false;
        }
    }

    async function findDefaultStation(nameQuery) {
        const results = await searchStations(nameQuery);
        return results[0] || null;
    }

    async function seedDefaultsIfEmpty() {
        if (_favorites.length > 0) return;
        log('Избранное пусто — загружаю станции по умолчанию…');
        for (const def of DEFAULT_STATIONS) {
            try {
                const st = await findDefaultStation(def.search);
                if (st && !isFavorite(st)) {
                    _favorites.push(st);
                    saveFavorites();
                    log('Добавлена по умолчанию:', st.name);
                }
            } catch (e) {}
        }
        if (_favorites.length > 0) renderRadioCard();
    }

    // ═══════════════════════════════════════════════════════════
    //  HTML КАРТОЧКИ
    // ═══════════════════════════════════════════════════════════
    function buildRadioCardHTML() {
        const cur = _current;
        const curName = cur ? cur.name : 'Не выбрано';
        const status = _playing ? '▶️ Играет' : (cur ? '⏸ Пауза' : '—');

        // ─── Свёрнутое тело ───
        const collapsedBody = `
            <div class="wc-radio-now">
                <div class="wc-radio-now-name">${escapeHtmlSafe(curName)}</div>
                <div class="wc-radio-now-status">${status}</div>
            </div>
            <div class="wc-radio-controls">
                <button class="wc-radio-btn wc-radio-play" data-radio-action="toggle">
                    ${_playing ? '⏸' : '▶️'}
                </button>
                ${cur ? `<button class="wc-radio-btn" data-radio-action="clear">✕</button>` : ''}
            </div>
        `;

        // ─── Развёрнутое тело ───
        let expandedBody = '';
        if (_expanded) {
            // Избранное
            const favHTML = _favorites.length === 0
                ? '<div class="wc-radio-empty">Пока пусто. Найди станцию ниже и нажми ⭐</div>'
                : _favorites.map(s => `
                    <div class="wc-radio-item ${cur && stationKey(cur) === stationKey(s) ? 'active' : ''}"
                         data-station-key="${escapeHtmlSafe(stationKey(s))}">
                        <span class="wc-radio-item-name">${escapeHtmlSafe(s.name)}</span>
                        <span class="wc-radio-item-tag">${escapeHtmlSafe((s.tags || '').split(',')[0] || s.country || '')}</span>
                        <button class="wc-radio-mini-btn" data-radio-action="play-fav" data-key="${escapeHtmlSafe(stationKey(s))}">▶️</button>
                        <button class="wc-radio-mini-btn danger" data-radio-action="remove-fav" data-key="${escapeHtmlSafe(stationKey(s))}">✕</button>
                    </div>
                `).join('');

            // Результаты поиска
            let searchHTML = '';
            if (_searching) {
                searchHTML = '<div class="wc-radio-empty">🔎 Ищу…</div>';
            } else if (_searchResults.length > 0) {
                searchHTML = _searchResults.map(s => {
                    const inFav = isFavorite(s);
                    return `
                        <div class="wc-radio-item">
                            <span class="wc-radio-item-name">${escapeHtmlSafe(s.name)}</span>
                            <span class="wc-radio-item-tag">${escapeHtmlSafe(s.countrycode || '')} ${s.bitrate ? '· ' + s.bitrate + 'k' : ''}</span>
                            <button class="wc-radio-mini-btn" data-radio-action="play-search" data-key="${escapeHtmlSafe(stationKey(s))}">▶️</button>
                            <button class="wc-radio-mini-btn ${inFav ? 'starred' : ''}"
                                    data-radio-action="${inFav ? 'remove-fav' : 'add-fav'}"
                                    data-key="${escapeHtmlSafe(stationKey(s))}">
                                ${inFav ? '★' : '⭐'}
                            </button>
                        </div>
                    `;
                }).join('');
            } else if (_searchQuery) {
                searchHTML = '<div class="wc-radio-empty">Ничего не найдено</div>';
            }

            expandedBody = `
                <div class="wc-radio-search">
                    <input type="text" class="wc-radio-input"
                           placeholder="Поиск станции…"
                           value="${escapeHtmlSafe(_searchQuery)}"
                           data-radio-input>
                    <button class="wc-radio-search-btn" data-radio-action="search">🔍</button>
                </div>

                <div class="wc-radio-section">
                    <div class="wc-radio-section-title">⭐ Избранное</div>
                    <div class="wc-radio-list">${favHTML}</div>
                </div>

                ${_searchResults.length > 0 || _searchQuery || _searching ? `
                <div class="wc-radio-section">
                    <div class="wc-radio-section-title">🔎 Результаты</div>
                    <div class="wc-radio-list">${searchHTML}</div>
                </div>
                ` : ''}
            `;
        }

        const hint = _expanded
            ? '<div class="wc-hint">👆 Тап по пустому месту — свернуть</div>'
            : '<div class="wc-hint">👆 Поиск станций</div>';

        return `
            <div class="widget-card radio ${_expanded ? 'expanded' : ''}" data-widget-id="radio">
                <div class="wc-header">
                    <div class="wc-icon">📻</div>
                    <div class="wc-title-block">
                        <div class="wc-title">Радио</div>
                        <div class="wc-subtitle">${_favorites.length} в избранном</div>
                    </div>
                </div>
                <div class="wc-body wc-radio-body">
                    ${collapsedBody}
                </div>
                ${expandedBody}
                ${hint}
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════
    //  ВСТАВКА В #chatsList (патч innerHTML)
    // ═══════════════════════════════════════════════════════════
    let _innerHTMLPatched = false;

    function buildWidgetHTMLIfAdded() {
        if (!isRadioAdded()) return '';
        return buildRadioCardHTML();
    }

    function patchChatsListInnerHTML() {
        const container = document.getElementById('chatsList');
        if (!container) { setTimeout(patchChatsListInnerHTML, 500); return; }
        if (container._radioPatched) return;

        const originalDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (!originalDescriptor) return;

        // Сохраняем предыдущий патч (от weather-модуля), если был
        const prevSetter = container.innerHTML !== undefined
            ? Object.getOwnPropertyDescriptor(container, 'innerHTML')?.set
            : null;

        const _patchedSetter = function(value) {
            if (this === container && isRadioAdded()) {
                const radioHtml = buildRadioCardHTML();
                // Если weather уже вставил свою часть — добавим после неё
                value = radioHtml + value;
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
            container._radioPatched = true;
            _innerHTMLPatched = true;
            log('✅ innerHTML #chatsList пропатчен (radio)');
        } catch (e) {
            warn('Патч innerHTML не удался:', e);
        }
    }

    setTimeout(patchChatsListInnerHTML, 600);
    setTimeout(patchChatsListInnerHTML, 2500);

    // ═══════════════════════════════════════════════════════════
    //  РЕРЕНДЕР ТОЛЬКО КАРТОЧКИ РАДИО
    // ═══════════════════════════════════════════════════════════
    function renderRadioCard() {
        const container = document.getElementById('chatsList');
        if (!container) return;
        const oldCard = container.querySelector('.widget-card.radio');
        if (!oldCard) return;

        const newHtml = buildRadioCardHTML();
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        const newCard = temp.firstElementChild;
        if (!newCard) return;

        // Сохраняем фокус на инпуте, если он был
        const oldInput = oldCard.querySelector('[data-radio-input]');
        const wasFocused = oldInput && document.activeElement === oldInput;
        const selStart = wasFocused ? oldInput.selectionStart : 0;
        const selEnd = wasFocused ? oldInput.selectionEnd : 0;

        oldCard.replaceWith(newCard);

        if (wasFocused) {
            const newInput = newCard.querySelector('[data-radio-input]');
            if (newInput) {
                newInput.focus();
                try { newInput.setSelectionRange(selStart, selEnd); } catch (e) {}
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ОБРАБОТЧИКИ
    // ═══════════════════════════════════════════════════════════
    function findStationByKey(key) {
        return _favorites.find(s => stationKey(s) === key)
            || _searchResults.find(s => stationKey(s) === key)
            || null;
    }

    function installHandlers() {
        const container = document.getElementById('chatsList');
        if (!container) { setTimeout(installHandlers, 500); return; }
        if (container._radioHandlers) return;
        container._radioHandlers = true;

        // ─── Долгое нажатие (удалить виджет) ───
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
                card.classList.remove('pressing');
                pressTarget = null;
                if (navigator.vibrate) navigator.vibrate(30);
                if (confirm('Удалить виджет «Радио»?')) {
                    removeRadioWidget();
                }
            }, CFG.LONG_PRESS_MS);
        }

        // ─── Клик ───
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.widget-card.radio');
            if (!card) return;

            // Кнопка действия
            const actionEl = e.target.closest('[data-radio-action]');
            if (actionEl) {
                e.stopPropagation();
                const action = actionEl.dataset.radioAction;
                const key = actionEl.dataset.key;

                switch (action) {
                    case 'toggle': togglePlay(); return;
                    case 'clear':
                        _current = null; saveCurrent();
                        if (_audio) { _audio.pause(); _audio.src = ''; }
                        _playing = false;
                        renderRadioCard();
                        return;
                    case 'play-fav':
                    case 'play-search': {
                        const st = findStationByKey(key);
                        if (st) playStation(st);
                        return;
                    }
                    case 'add-fav': {
                        const st = findStationByKey(key);
                        if (st && !isFavorite(st)) {
                            _favorites.push(st);
                            saveFavorites();
                            if (typeof showToast === 'function') showToast('⭐ Добавлено в избранное', 1500);
                            renderRadioCard();
                        }
                        return;
                    }
                    case 'remove-fav': {
                        const st = findStationByKey(key);
                        if (st) {
                            _favorites = _favorites.filter(f => stationKey(f) !== stationKey(st));
                            saveFavorites();
                            if (typeof showToast === 'function') showToast('Убрано из избранного', 1500);
                            renderRadioCard();
                        }
                        return;
                    }
                    case 'search': {
                        const input = card.querySelector('[data-radio-input]');
                        const q = input ? input.value : '';
                        _searchQuery = q;
                        searchStations(q).then(res => {
                            _searchResults = res;
                            renderRadioCard();
                        });
                        return;
                    }
                }
                return;
            }

            // Долгое нажатие сработало — игнорируем клик
            if (fired) { fired = false; return; }

            // Клик по инпуту / внутри развёрнутого контента — не сворачиваем
            if (e.target.closest('.wc-radio-search, .wc-radio-list, .wc-radio-section')) return;
            if (e.target.closest('input, button')) return;

            // Клик по телу — развернуть/свернуть
            setExpanded(!_expanded);
            renderRadioCard();
        });

        // ─── Enter в поиске ───
        container.addEventListener('keydown', (e) => {
            if (!e.target.matches('[data-radio-input]')) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                _searchQuery = e.target.value;
                searchStations(_searchQuery).then(res => {
                    _searchResults = res;
                    renderRadioCard();
                });
            }
        });

        // ─── Долгое нажатие (touch) ───
        container.addEventListener('touchstart', (e) => {
            const card = e.target.closest('.widget-card.radio');
            if (!card) return;
            if (e.target.closest('input, button')) return;
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
            const card = e.target.closest('.widget-card.radio');
            if (!card) return;
            if (e.target.closest('input, button')) return;
            startX = e.clientX; startY = e.clientY;
            startPress(card);
        });
        container.addEventListener('mouseup', cancelPress);
        container.addEventListener('mouseleave', cancelPress);

        container.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.widget-card.radio');
            if (!card) return;
            if (e.target.closest('input')) return;
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Удалить виджет «Радио»?')) removeRadioWidget();
        });

        log('✅ Обработчики установлены');
    }

    installHandlers();

    // ═══════════════════════════════════════════════════════════
    //  ДОБАВЛЕНИЕ / УДАЛЕНИЕ ВИДЖЕТА
    // ═══════════════════════════════════════════════════════════
    function addRadioWidget() {
        try {
            const raw = localStorage.getItem(CFG.WIDGET_KEY);
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
            if (list.some(w => w.id === 'radio')) {
                if (typeof showToast === 'function') showToast('📻 Радио уже добавлено', 2000);
                return false;
            }
            list.push({ id: 'radio', addedAt: Date.now() });
            localStorage.setItem(CFG.WIDGET_KEY, JSON.stringify(list));
        } catch (e) {
            warn('Не удалось сохранить виджет:', e);
            return false;
        }

        if (typeof showToast === 'function') showToast('✅ Виджет «Радио» добавлен', 2000);
        if (typeof soundManager !== 'undefined') { try { soundManager.play('send'); } catch (e) {} }

        // Загружаем дефолтные станции и рендерим
        seedDefaultsIfEmpty();
        rerenderChatsList();

        return true;
    }

    function removeRadioWidget() {
        try {
            const raw = localStorage.getItem(CFG.WIDGET_KEY);
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
            list = list.filter(w => w.id !== 'radio');
            localStorage.setItem(CFG.WIDGET_KEY, JSON.stringify(list));
        } catch (e) {}

        // Останавливаем плеер
        if (_audio) {
            try { _audio.pause(); _audio.src = ''; } catch (e) {}
        }
        _playing = false;
        _current = null;
        saveCurrent();

        if (typeof showToast === 'function') showToast('🗑️ Виджет «Радио» удалён', 1500);
        if (typeof soundManager !== 'undefined') { try { soundManager.play('delete'); } catch (e) {} }
        if (navigator.vibrate) navigator.vibrate(20);

        document.querySelectorAll('.widget-card.radio').forEach(el => el.remove());
    }

    function rerenderChatsList() {
        if (typeof renderChatsList === 'function') renderChatsList();
    }

    // ═══════════════════════════════════════════════════════════
    //  СТИЛИ
    // ═══════════════════════════════════════════════════════════
    function ensureStyles() {
        if (document.getElementById('radioWidgetStylesV1')) return;
        const style = document.createElement('style');
        style.id = 'radioWidgetStylesV1';
        style.textContent = `
            /* ─── Общие стили карточки берём из weather v7 ─── */
            /* Тут только специфика радио */

            .widget-card.radio .wc-radio-body {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding-top: 4px;
            }
            .widget-card.radio .wc-radio-now {
                flex: 1;
                min-width: 0;
            }
            .widget-card.radio .wc-radio-now-name {
                font-size: 15px;
                font-weight: 700;
                color: #fff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .widget-card.radio .wc-radio-now-status {
                font-size: 11px;
                color: #a78bfa;
                margin-top: 3px;
            }
            .widget-card.radio .wc-radio-controls {
                display: flex;
                gap: 6px;
                flex-shrink: 0;
            }
            .widget-card.radio .wc-radio-btn {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.15);
                background: rgba(255, 255, 255, 0.06);
                color: #fff;
                font-size: 18px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s, border-color 0.2s;
                -webkit-tap-highlight-color: transparent;
            }
            .widget-card.radio .wc-radio-btn:hover {
                background: rgba(108, 92, 231, 0.25);
                border-color: rgba(108, 92, 231, 0.5);
            }
            .widget-card.radio .wc-radio-play {
                background: linear-gradient(135deg, #6c5ce7, #00b894);
                border-color: transparent;
            }

            /* ─── Развёрнутое: поиск ─── */
            .widget-card.radio .wc-radio-search {
                display: flex;
                gap: 6px;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }
            .widget-card.radio .wc-radio-input {
                flex: 1;
                min-width: 0;
                padding: 10px 12px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                background: rgba(0, 0, 0, 0.25);
                color: #fff;
                font-size: 13px;
                outline: none;
                transition: border-color 0.2s;
            }
            .widget-card.radio .wc-radio-input:focus {
                border-color: rgba(108, 92, 231, 0.6);
            }
            .widget-card.radio .wc-radio-input::placeholder {
                color: rgba(255, 255, 255, 0.35);
            }
            .widget-card.radio .wc-radio-search-btn {
                width: 42px;
                border-radius: 10px;
                border: 1px solid rgba(108, 92, 231, 0.4);
                background: rgba(108, 92, 231, 0.2);
                color: #fff;
                font-size: 16px;
                cursor: pointer;
                flex-shrink: 0;
                transition: background 0.2s;
            }
            .widget-card.radio .wc-radio-search-btn:hover {
                background: rgba(108, 92, 231, 0.4);
            }

            /* ─── Секции ─── */
            .widget-card.radio .wc-radio-section {
                margin-top: 14px;
            }
            .widget-card.radio .wc-radio-section-title {
                font-size: 11px;
                font-weight: 700;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
            }
            .widget-card.radio .wc-radio-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            /* ─── Строка станции ─── */
            .widget-card.radio .wc-radio-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 10px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.05);
                transition: background 0.15s, border-color 0.15s;
            }
            .widget-card.radio .wc-radio-item:hover {
                background: rgba(255, 255, 255, 0.06);
            }
            .widget-card.radio .wc-radio-item.active {
                background: linear-gradient(135deg,
                    rgba(108, 92, 231, 0.22),
                    rgba(0, 184, 148, 0.12));
                border-color: rgba(108, 92, 231, 0.45);
            }
            .widget-card.radio .wc-radio-item-name {
                flex: 1;
                min-width: 0;
                font-size: 13px;
                color: #fff;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .widget-card.radio .wc-radio-item-tag {
                font-size: 10px;
                color: #888;
                flex-shrink: 0;
                max-width: 80px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .widget-card.radio .wc-radio-mini-btn {
                width: 30px;
                height: 30px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.04);
                color: #fff;
                font-size: 13px;
                cursor: pointer;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, border-color 0.15s;
                -webkit-tap-highlight-color: transparent;
            }
            .widget-card.radio .wc-radio-mini-btn:hover {
                background: rgba(108, 92, 231, 0.3);
                border-color: rgba(108, 92, 231, 0.5);
            }
            .widget-card.radio .wc-radio-mini-btn.starred {
                background: rgba(254, 202, 87, 0.2);
                border-color: rgba(254, 202, 87, 0.5);
                color: #feca57;
            }
            .widget-card.radio .wc-radio-mini-btn.danger:hover {
                background: rgba(255, 107, 107, 0.25);
                border-color: rgba(255, 107, 107, 0.5);
                color: #ff6b6b;
            }
            .widget-card.radio .wc-radio-empty {
                padding: 10px;
                text-align: center;
                font-size: 12px;
                color: #666;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    // ═══════════════════════════════════════════════════════════
    //  ПУНКТ В МОДАЛКЕ ВИДЖЕТОВ
    // ═══════════════════════════════════════════════════════════
    //  Если weather-модуль уже создал модалку — просто добавим
    //  пункт «Радио» в список. Иначе создадим свой DOM.
    function injectRadioIntoPicker() {
        const list = document.getElementById('wpWidgetsList');
        if (!list) return;
        if (list.querySelector('[data-widget-id="radio"]')) return;

        const isAdded = isRadioAdded();
        const el = document.createElement('div');
        el.className = `wp-widget-item ${isAdded ? 'added' : ''}`;
        el.dataset.widgetId = 'radio';
        el.innerHTML = `
            <div class="wp-widget-icon">📻</div>
            <div class="wp-widget-info">
                <div class="wp-widget-name">Радио</div>
                <div class="wp-widget-desc">Бесплатные станции, поиск, избранное</div>
            </div>
            <div class="wp-widget-status">${isAdded ? '✓ Добавлен' : '+ Добавить'}</div>
        `;
        el.addEventListener('click', () => {
            if (isRadioAdded()) {
                if (confirm('Удалить виджет «Радио»?')) {
                    removeRadioWidget();
                    el.classList.remove('added');
                    el.querySelector('.wp-widget-status').textContent = '+ Добавить';
                }
            } else {
                if (addRadioWidget()) {
                    el.classList.add('added');
                    el.querySelector('.wp-widget-status').textContent = '✓ Добавлен';
                }
            }
        });
        list.appendChild(el);
    }

    // Следим за появлением модалки виджетов — weather-модуль её создаёт
    const pickerObserver = new MutationObserver(() => {
        if (document.getElementById('wpWidgetsList')) {
            injectRadioIntoPicker();
        }
    });
    pickerObserver.observe(document.body, { childList: true, subtree: true });

    // ═══════════════════════════════════════════════════════════
    //  ЗАПУСК
    // ═══════════════════════════════════════════════════════════
    ensureStyles();
    ensureAudio();

    // Если виджет уже добавлен — при старте загружаем дефолты (если пусто)
    if (isRadioAdded()) {
        setTimeout(() => {
            seedDefaultsIfEmpty();
            renderRadioCard();
        }, 1500);
    }

    // ═══════════════════════════════════════════════════════════
    //  ПУБЛИЧНЫЙ API
    // ═══════════════════════════════════════════════════════════
    window.RadioWidget = {
        add: addRadioWidget,
        remove: removeRadioWidget,
        play: (nameQuery) => {
            searchStations(nameQuery).then(res => {
                if (res[0]) playStation(res[0]);
                else if (typeof showToast === 'function') showToast('❌ Станция не найдена', 2000);
            });
        },
        pause: pauseStation,
        toggle: togglePlay,
        volume: (v) => { setVolume(v); return _volume; },
        search: async (q) => {
            const res = await searchStations(q);
            _searchResults = res;
            _searchQuery = q;
            renderRadioCard();
            return res;
        },
        favorites: () => _favorites.slice(),
        clearFavorites: () => {
            _favorites = [];
            saveFavorites();
            renderRadioCard();
        },
        seedDefaults: seedDefaultsIfEmpty,
        debug: () => {
            const info = {
                added: isRadioAdded(),
                favorites: _favorites.length,
                current: _current?.name || null,
                playing: _playing,
                expanded: _expanded,
                searchQuery: _searchQuery,
                searchResults: _searchResults.length,
                audioSrc: _audio?.src || null,
            };
            console.log('=== RADIO WIDGET DEBUG ===');
            console.table(info);
            return info;
        },
    };

    console.log('📻 [Radio v1] Готово');
    console.log('Проверить: RadioWidget.debug()');

})();