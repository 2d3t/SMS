
// ═══════════════════════════════════════════════════════════════
//  📻 RADIO WIDGET v2 — фиксированный список станций
//  ─────────────────────────────────────────────────────────────
//  • Большой готовый список станций (наши + зарубежные)
//  • Избранное в localStorage
//  • Плеер — глобальный <audio> в document.body
//  • Только HTTPS-потоки
//  • В стиле widget-weather v7: карточка + разворот + долгое нажатие
// ═══════════════════════════════════════════════════════════════

(function installRadioWidgetV2() {
    'use strict';

    console.log('📻 [Radio v2] Запуск…');

    const CFG = {
        WIDGET_KEY: 'smschat_widgets',
        FAV_KEY: 'smschat_radio_favorites',
        STATE_KEY: 'smschat_radio_state',
        EXPANDED_KEY: 'smschat_radio_expanded',
        LONG_PRESS_MS: 600,
        DEBUG: true,
    };

    const log = (...a) => CFG.DEBUG && console.log('📻 [Radio v2]', ...a);
    const warn = (...a) => console.warn('📻 [Radio v2]', ...a);

    // ═══════════════════════════════════════════════════════════
    //  БОЛЬШОЙ СПИСОК СТАНЦИЙ (только HTTPS-потоки)
    // ═══════════════════════════════════════════════════════════
    const STATIONS = [
        // ───🇷🇺 РОССИЯ / СНГ ───
        { id: 'ru-europaplus',  name: 'Европа Плюс',        country: '🇷🇺', genre: 'Pop',       url: 'https://ep128.hostingradio.ru:8030/ep128' },
        { id: 'ru-retro',       name: 'Ретро FM',           country: '🇷🇺', genre: 'Retro',     url: 'https://retroserver.streamr.ru:8043/retro256.mp3' },
        { id: 'ru-relax',       name: 'Relax FM',           country: '🇷🇺', genre: 'Chill',     url: 'https://pub0302.101.ru:8443/stream/air/aac/64' },
        { id: 'ru-russian',     name: 'Русское Радио',      country: '🇷🇺', genre: 'Pop',       url: 'https://rusradio.hostingradio.ru/rusradio96.aacp' },
        { id: 'ru-road',        name: 'Дорожное Радио',     country: '🇷🇺', genre: 'Pop',       url: 'https://dorognoe.hostingradio.ru:8000/dorognoe' },
        { id: 'ru-record',      name: 'Radio Record',       country: '🇷🇺', genre: 'Dance',     url: 'https://radiorecord.hostingradio.ru/rr_main96.aacp' },
        { id: 'ru-montekarlo',  name: 'Монте-Карло',        country: '🇷🇺', genre: 'Pop',       url: 'https://montecarlo.hostingradio.ru/montecarlo96.aacp' },
        { id: 'ru-energy',      name: 'NRJ Energy',         country: '🇷🇺', genre: 'Dance',     url: 'https://energydance.hostingradio.ru/energydance96.aacp' },
        { id: 'ru-dfm',         name: 'DFM',                country: '🇷🇺', genre: 'Dance',     url: 'https://dfm.hostingradio.ru/dfm96.aacp' },
        { id: 'ru-hitfm',       name: 'Хит FM',             country: '🇷🇺', genre: 'Pop',       url: 'https://hitfm.hostingradio.ru/hitfm96.aacp' },
        { id: 'ru-maximum',     name: 'Radio Maximum',      country: '🇷🇺', genre: 'Rock',      url: 'https://maximum.hostingradio.ru/maximum96.aacp' },
        { id: 'ru-ultra',       name: 'Ultra',              country: '🇷🇺', genre: 'Electronic',url: 'https://ultra.hostingradio.ru/ultra96.aacp' },
        { id: 'ru-comedy',      name: 'Comedy Radio',       country: '🇷🇺', genre: 'Talk',      url: 'https://comedy.hostingradio.ru/comedy96.aacp' },
        { id: 'ru-vesti',       name: 'Вести FM',           country: '🇷🇺', genre: 'News',      url: 'https://icecast-vgtrk.cdnvideo.ru/vestifm_mp3_128kbps' },
        { id: 'ru-mayak',       name: 'Маяк',               country: '🇷🇺', genre: 'Talk',      url: 'https://icecast-vgtrk.cdnvideo.ru/mayakfm_mp3_128kbps' },
        { id: 'ru-jazz',        name: 'Radio Jazz',         country: '🇷🇺', genre: 'Jazz',      url: 'https://jazz.hostingradio.ru:8014/jazz128.mp3' },
        { id: 'ru-7not',        name: '7 Нот',              country: '🇷🇺', genre: 'Classical', url: 'https://7not.fm/mp3/' },
        { id: 'ru-child',       name: 'Детское Радио',      country: '🇷🇺', genre: 'Kids',      url: 'https://deti.hostingradio.ru/deti96.aacp' },

        // ───🇺🇦 УКРАИНА ───
        { id: 'ua-hit',         name: 'Хіт FM',             country: '🇺🇦', genre: 'Pop',       url: 'https://online.hitfm.ua/HitFM' },
        { id: 'ua-kiss',        name: 'Kiss FM UA',         country: '🇺🇦', genre: 'Dance',     url: 'https://online.kissfm.ua/KissFM' },
        { id: 'ua-roks',        name: 'Radio ROKS',         country: '🇺🇦', genre: 'Rock',      url: 'https://online.radioroks.ua/RadioROKS' },
        { id: 'ua-nv',          name: 'Radio NV',           country: '🇺🇦', genre: 'News',      url: 'https://online.radiorelax.ua/RadioNV' },

        // ───🇧🇾 БЕЛАРУСЬ ───
        { id: 'by-unistar',     name: 'Unistar',            country: '🇧🇾', genre: 'Pop',       url: 'https://stream.unistar.by/unistar-128.mp3' },

        // ───🇰🇿 КАЗАХСТАН ───
        { id: 'kz-europa',      name: 'Европа Плюс KZ',     country: '🇰🇿', genre: 'Pop',       url: 'https://ep128.hostingradio.ru:8030/ep128' },

        // ───🇺🇸 США ───
        { id: 'us-npr',         name: 'NPR News',           country: '🇺🇸', genre: 'News',      url: 'https://npr-ice.streamguys1.com/live.mp3' },
        { id: 'us-classic',     name: 'Classic FM USA',     country: '🇺🇸', genre: 'Classical', url: 'https://live.wostreaming.net/direct/whrb-fm1-ibc1' },
        { id: 'us-lofi',        name: 'Lofi Girl',          country: '🇺🇸', genre: 'Lo-Fi',     url: 'https://stream.zeno.fm/0r0xa792kwzuv' },

        // ───🇬🇧 ВЕЛИКОБРИТАНИЯ ───
        { id: 'uk-bbc1',        name: 'BBC Radio 1',        country: '🇬🇧', genre: 'Pop',       url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one' },
        { id: 'uk-bbc2',        name: 'BBC Radio 2',        country: '🇬🇧', genre: 'Pop',       url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_two' },
        { id: 'uk-bbc4',        name: 'BBC Radio 4',        country: '🇬🇧', genre: 'Talk',      url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm' },
        { id: 'uk-classic',     name: 'Classic FM UK',      country: '🇬🇧', genre: 'Classical', url: 'https://media-ice.musicradio.com/ClassicFMMP3' },
        { id: 'uk-capital',     name: 'Capital FM',         country: '🇬🇧', genre: 'Pop',       url: 'https://media-ice.musicradio.com/CapitalMP3' },
        { id: 'uk-heart',       name: 'Heart FM',           country: '🇬🇧', genre: 'Pop',       url: 'https://media-ice.musicradio.com/HeartLondonMP3' },

        // ───🇩🇪 ГЕРМАНИЯ ───
        { id: 'de-1live',       name: '1LIVE',              country: '🇩🇪', genre: 'Pop',       url: 'https://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3' },
        { id: 'de-swr3',        name: 'SWR3',               country: '🇩🇪', genre: 'Pop',       url: 'https://liveradio.swr.de/sw282p3/swr3/play.mp3' },
        { id: 'de-bayern3',     name: 'Bayern 3',           country: '🇩🇪', genre: 'Pop',       url: 'https://streams.br.de/bayern3_2.m3u' },

        // ───🇫🇷 ФРАНЦИЯ ───
        { id: 'fr-nrj',         name: 'NRJ France',         country: '🇫🇷', genre: 'Pop',       url: 'https://cdn.nrjaudio.fm/audio1/fr/30001/mp3_128.mp3' },
        { id: 'fr-nostalgie',   name: 'Nostalgie',          country: '🇫🇷', genre: 'Retro',     url: 'https://cdn.nrjaudio.fm/audio1/fr/30601/mp3_128.mp3' },
        { id: 'fr-rire',        name: 'Rire & Chansons',    country: '🇫🇷', genre: 'Comedy',    url: 'https://cdn.nrjaudio.fm/audio1/fr/30401/mp3_128.mp3' },
        { id: 'fr-classique',   name: 'Radio Classique',    country: '🇫🇷', genre: 'Classical', url: 'https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3' },

        // ───🇮🇹 ИТАЛИЯ ───
        { id: 'it-rai1',        name: 'Rai Radio 1',        country: '🇮🇹', genre: 'News',      url: 'https://icestreaming.rai.it/1.mp3' },
        { id: 'it-rai2',        name: 'Rai Radio 2',        country: '🇮🇹', genre: 'Pop',       url: 'https://icestreaming.rai.it/2.mp3' },
        { id: 'it-rai3',        name: 'Rai Radio 3',        country: '🇮🇹', genre: 'Classical', url: 'https://icestreaming.rai.it/3.mp3' },
        { id: 'it-virgin',      name: 'Virgin Radio IT',    country: '🇮🇹', genre: 'Rock',      url: 'https://icy.unitedradio.it/Virgin.mp3' },
        { id: 'it-deejay',      name: 'Radio Deejay',       country: '🇮🇹', genre: 'Pop',       url: 'https://4c4b867c89244861ac216426883d1ad0.msvdn.net/radiodeejay/radiodeejay/master.m3u8' },
        { id: 'it-105',         name: 'Radio 105',          country: '🇮🇹', genre: 'Pop',       url: 'https://icy.unitedradio.it/Radio105.mp3' },

        // ───🇪🇸 ИСПАНИЯ ───
        { id: 'es-los40',       name: 'LOS40',              country: '🇪🇸', genre: 'Pop',       url: 'https://21423.live.streamtheworld.com/LOS40AAC.aac' },
        { id: 'es-cadena',      name: 'Cadena SER',         country: '🇪🇸', genre: 'News',      url: 'https://25603.live.streamtheworld.com/CADENASER.mp3' },
        { id: 'es-flamenco',    name: 'Flamenco Radio',     country: '🇪🇸', genre: 'Flamenco',  url: 'https://cdnapi.kaltura.com/p/2209221/sp/220922100/playManifest/entryId/1_gxqqn89h/format/applehttp/protocol/https/a.m3u8' },

        // ───🇳🇱 НИДЕРЛАНДЫ ───
        { id: 'nl-538',         name: 'Radio 538',          country: '🇳🇱', genre: 'Pop',       url: 'https://25293.live.streamtheworld.com/RADIO538.mp3' },
        { id: 'nl-sky',         name: 'Sky Radio',          country: '🇳🇱', genre: 'Pop',       url: 'https://25293.live.streamtheworld.com/SKYRADIO.mp3' },
        { id: 'nl-veronica',    name: 'Radio Veronica',     country: '🇳🇱', genre: 'Rock',      url: 'https://25353.live.streamtheworld.com/VERONICA.mp3' },

        // ───🇨🇭 ШВЕЙЦАРИЯ ───
        { id: 'ch-srf3',        name: 'SRF 3',              country: '🇨🇭', genre: 'Pop',       url: 'https://stream.srg-ssr.ch/m/drs3/mp3_128' },
        { id: 'ch-srf2',        name: 'SRF 2 Kultur',       country: '🇨🇭', genre: 'Classical', url: 'https://stream.srg-ssr.ch/m/drs2/mp3_128' },

        // ───🇸🇪 ШВЕЦИЯ ───
        { id: 'se-p3',          name: 'Sveriges Radio P3',  country: '🇸🇪', genre: 'Pop',       url: 'https://sverigesradio.se/topsy/direkt/164-hi-mp3' },
        { id: 'se-p1',          name: 'Sveriges Radio P1',  country: '🇸🇪', genre: 'Talk',      url: 'https://sverigesradio.se/topsy/direkt/132-hi-mp3' },

        // ───🇦🇹 АВСТРИЯ ───
        { id: 'at-oe3',         name: 'Hitradio Ö3',        country: '🇦🇹', genre: 'Pop',       url: 'https://orf-live.ors-shoutcast.at/oe3-q2a' },
        { id: 'at-fm4',         name: 'FM4',                country: '🇦🇹', genre: 'Alternative',url: 'https://orf-live.ors-shoutcast.at/fm4-q2a' },

        // ───🇵🇱 ПОЛЬША ───
        { id: 'pl-rmf',         name: 'RMF FM',             country: '🇵🇱', genre: 'Pop',       url: 'https://rs6-krk2.rmfstream.pl/RMFFM48' },
        { id: 'pl-zeto',        name: 'Radio ZET',          country: '🇵🇱', genre: 'Pop',       url: 'https://n-4-7.dcs.redcdn.pl/sc/o2/Eurozet/live/audio.livx?audio=5' },

        // ───🇨🇿 ЧЕХИЯ ───
        { id: 'cz-impuls',      name: 'Rádio Impuls',       country: '🇨🇿', genre: 'Pop',       url: 'https://icecast5.play.cz/impuls128.mp3' },
        { id: 'cz-europa2',     name: 'Evropa 2',           country: '🇨🇿', genre: 'Pop',       url: 'https://ice.actve.net/fm-evropa2-128' },

        // ───🇬🇷 ГРЕЦИЯ ───
        { id: 'gr-ert',         name: 'ERT Open',           country: '🇬🇷', genre: 'Talk',      url: 'https://radiostreaming.ert.gr/ert-open' },

        // ───🇯🇵 ЯПОНИЯ ───
        { id: 'jp-jpop',        name: 'J-Pop Powerplay',    country: '🇯🇵', genre: 'J-Pop',     url: 'https://kathy.torontocast.com:3560/;' },

        // ───🇧🇷 БРАЗИЛИЯ ───
        { id: 'br-jovem',       name: 'Jovem Pan FM',       country: '🇧🇷', genre: 'Pop',       url: 'https://stream.jovempanfm.com.br/jp_sp_hd' },

        // ───🇲🇽 МЕКСИКА ───
        { id: 'mx-exa',         name: 'Exa FM',             country: '🇲🇽', genre: 'Pop',       url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/XHEXAAC.aac' },

        // ───🇦🇷 АРГЕНТИНА ───
        { id: 'ar-la100',       name: 'La 100',             country: '🇦🇷', genre: 'Pop',       url: 'https://buecl2.cienradios.com/la100.aac' },

        // ───🌍 МЕЖДУНАРОДНЫЕ / ОНЛАЙН ───
        { id: 'int-soma',       name: 'SomaFM Groove Salad',country: '🌍', genre: 'Chill',     url: 'https://ice1.somafm.com/groovesalad-128-mp3' },
        { id: 'int-soma-indie', name: 'SomaFM Indie Pop',   country: '🌍', genre: 'Indie',     url: 'https://ice1.somafm.com/indiepop-128-mp3' },
        { id: 'int-soma-def',   name: 'SomaFM DEF CON',     country: '🌍', genre: 'Electronic',url: 'https://ice1.somafm.com/defcon-128-mp3' },
        { id: 'int-soma-space', name: 'SomaFM Space',       country: '🌍', genre: 'Ambient',   url: 'https://ice1.somafm.com/spacestation-128-mp3' },
        { id: 'int-soma-lush',  name: 'SomaFM Lush',        country: '🌍', genre: 'Vocal',     url: 'https://ice1.somafm.com/lush-128-mp3' },
        { id: 'int-soma-boot',  name: 'SomaFM Boot Liquor', country: '🌍', genre: 'Country',   url: 'https://ice1.somafm.com/bootliquor-128-mp3' },
        { id: 'int-radioparadise', name: 'Radio Paradise',  country: '🌍', genre: 'Eclectic',  url: 'https://stream.radioparadise.com/mp3-128' },
        { id: 'int-nectarine',  name: 'Nectarine Demoscene',country: '🌍', genre: 'Electronic',url: 'https://necta.burn.net:8443/necta' },
        { id: 'int-fip',        name: 'FIP (France)',       country: '🇫🇷', genre: 'Eclectic',  url: 'https://icecast.radiofrance.fr/fip-midfi.mp3' },
        { id: 'int-fipjazz',    name: 'FIP Jazz',           country: '🇫🇷', genre: 'Jazz',      url: 'https://icecast.radiofrance.fr/fipjazz-midfi.mp3' },
        { id: 'int-fiprock',    name: 'FIP Rock',           country: '🇫🇷', genre: 'Rock',      url: 'https://icecast.radiofrance.fr/fiprock-midfi.mp3' },
        { id: 'int-fipgroove',  name: 'FIP Groove',         country: '🇫🇷', genre: 'Funk',      url: 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3' },
        { id: 'int-fipworld',   name: 'FIP Monde',          country: '🇫🇷', genre: 'World',     url: 'https://icecast.radiofrance.fr/fipworld-midfi.mp3' },
        { id: 'int-fipreggae',  name: 'FIP Reggae',         country: '🇫🇷', genre: 'Reggae',    url: 'https://icecast.radiofrance.fr/fipreggae-midfi.mp3' },
        { id: 'int-fipnouveau', name: 'FIP Nouveautés',     country: '🇫🇷', genre: 'New',       url: 'https://icecast.radiofrance.fr/fipnouveautes-midfi.mp3' },
        { id: 'int-mouv',       name: 'Mouv\'',             country: '🇫🇷', genre: 'Hip-Hop',   url: 'https://icecast.radiofrance.fr/mouv-midfi.mp3' },
        { id: 'int-classique',  name: 'France Musique',     country: '🇫🇷', genre: 'Classical', url: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3' },
        { id: 'int-franceinfo', name: 'France Info',        country: '🇫🇷', genre: 'News',      url: 'https://icecast.radiofrance.fr/franceinfo-midfi.mp3' },
        { id: 'int-franceinter',name: 'France Inter',       country: '🇫🇷', genre: 'Talk',      url: 'https://icecast.radiofrance.fr/franceinter-midfi.mp3' },
        { id: 'int-franceri',   name: 'France Culture',     country: '🇫🇷', genre: 'Culture',   url: 'https://icecast.radiofrance.fr/franceculture-midfi.mp3' },

        // ───🎵 ЖАНРОВЫЕ МЕЖДУНАРОДНЫЕ ───
        { id: 'g-jazz24',       name: 'Jazz24',             country: '🌍', genre: 'Jazz',      url: 'https://live.wostreaming.net/direct/ppm-jazz24aac-ibc1' },
        { id: 'g-classicfm',    name: 'Classic FM',         country: '🌍', genre: 'Classical', url: 'https://media-ssl.musicradio.com/ClassicFMMP3' },
        { id: 'g-1fm',          name: '1.FM Top 40',        country: '🌍', genre: 'Top 40',    url: 'https://strm112.1.fm/top40_mobile_mp3' },
        { id: 'g-1fmrock',      name: '1.FM Rock',          country: '🌍', genre: 'Rock',      url: 'https://strm112.1.fm/rock_mobile_mp3' },
        { id: 'g-1fmtrance',    name: '1.FM Trance',        country: '🌍', genre: 'Trance',    url: 'https://strm112.1.fm/trance_mobile_mp3' },
        { id: 'g-1fm80s',       name: '1.FM 80s',           country: '🌍', genre: '80s',       url: 'https://strm112.1.fm/back280s_mobile_mp3' },
        { id: 'g-1fm90s',       name: '1.FM 90s',           country: '🌍', genre: '90s',       url: 'https://strm112.1.fm/90s_mobile_mp3' },
        { id: 'g-1fmlounge',    name: '1.FM Lounge',        country: '🌍', genre: 'Lounge',    url: 'https://strm112.1.fm/lounge_mobile_mp3' },
        { id: 'g-1fmchill',     name: '1.FM Chillout',      country: '🌍', genre: 'Chillout',  url: 'https://strm112.1.fm/chilloutlounge_mobile_mp3' },
        { id: 'g-1fmambient',   name: '1.FM Ambient',       country: '🌍', genre: 'Ambient',   url: 'https://strm112.1.fm/ambient_mobile_mp3' },
        { id: 'g-1fmsalsa',     name: '1.FM Salsa',         country: '🌍', genre: 'Salsa',     url: 'https://strm112.1.fm/salsa_mobile_mp3' },
        { id: 'g-1fmreggae',    name: '1.FM Reggae',        country: '🌍', genre: 'Reggae',    url: 'https://strm112.1.fm/reggae_mobile_mp3' },
        { id: 'g-1fmcountry',   name: '1.FM Country',       country: '🌍', genre: 'Country',   url: 'https://strm112.1.fm/country_mobile_mp3' },
        { id: 'g-1fmcountry',   name: '1.FM Blues',         country: '🌍', genre: 'Blues',     url: 'https://strm112.1.fm/blues_mobile_mp3' },
        { id: 'g-1fmoldies',    name: '1.FM Oldies',        country: '🌍', genre: 'Oldies',    url: 'https://strm112.1.fm/oldies_mobile_mp3' },
        { id: 'g-1fmdisco',     name: '1.FM Disco',         country: '🌍', genre: 'Disco',     url: 'https://strm112.1.fm/disco_mobile_mp3' },
        { id: 'g-lofi',         name: 'Lofi Radio',         country: '🌍', genre: 'Lo-Fi',     url: 'https://stream.zeno.fm/f3wvbbqmdg8uv' },
        { id: 'g-chillhop',     name: 'Chillhop',           country: '🌍', genre: 'Chillhop',  url: 'https://streams.fluxfm.de/Chillhop/mp3-128/streams.fluxfm.de/' },
        { id: 'g-fluxfm',       name: 'FluxFM',             country: '🇩🇪', genre: 'Alternative',url: 'https://streams.fluxfm.de/FluxFM/mp3-128/streams.fluxfm.de/' },
        { id: 'g-sunshine',     name: 'Sunshine Live',      country: '🇩🇪', genre: 'Electronic',url: 'https://stream.sunshine-live.de/live/mp3-192/stream.sunshine-live.de/' },
        { id: 'g-innergong',    name: 'Inner Gong',         country: '🇩🇪', genre: 'Chill',     url: 'https://stream.innergong.de/mp3' },
    ];

    // ═══════════════════════════════════════════════════════════
    //  СОСТОЯНИЕ
    // ═══════════════════════════════════════════════════════════
    let _expanded = (() => {
        try { return localStorage.getItem(CFG.EXPANDED_KEY) === '1'; }
        catch (e) { return false; }
    })();

    // Избранное хранит МАССИВ ID станций
    let _favorites = (() => {
        try {
            const raw = JSON.parse(localStorage.getItem(CFG.FAV_KEY) || '[]');
            if (!Array.isArray(raw)) return [];
            // Совместимость со старой версией (там были объекты станций)
            return raw.map(x => typeof x === 'string' ? x : (x.stationuuid || x.id)).filter(Boolean);
        } catch (e) { return []; }
    })();

    // Текущая станция — ID
    let _currentId = (() => {
        try {
            const raw = localStorage.getItem(CFG.STATE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'string') return parsed;
            return parsed?.id || null;
        } catch (e) { return null; }
    })();

    let _audio = null;
    let _playing = false;
    let _volume = 0.8;
    let _filterGenre = 'all';
    let _filterCountry = 'all';

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
            if (_currentId) localStorage.setItem(CFG.STATE_KEY, JSON.stringify(_currentId));
            else localStorage.removeItem(CFG.STATE_KEY);
        } catch (e) {}
    }

    function setExpanded(v) {
        _expanded = !!v;
        try { localStorage.setItem(CFG.EXPANDED_KEY, _expanded ? '1' : '0'); } catch (e) {}
    }

    function getStationById(id) {
        return STATIONS.find(s => s.id === id) || null;
    }

    function getCurrentStation() {
        return _currentId ? getStationById(_currentId) : null;
    }

    function isFavorite(id) {
        return _favorites.includes(id);
    }

    function toggleFavorite(id) {
        if (isFavorite(id)) {
            _favorites = _favorites.filter(x => x !== id);
        } else {
            _favorites.push(id);
        }
        saveFavorites();
    }

    // ═══════════════════════════════════════════════════════════
    //  ПЛЕЕР
    // ═══════════════════════════════════════════════════════════
    function ensureAudio() {
        if (_audio) return _audio;
        _audio = document.createElement('audio');
        _audio.id = 'radioWidgetAudio';
        _audio.preload = 'none';
        _audio.volume = _volume;
        _audio.style.display = 'none';
        document.body.appendChild(_audio);

        _audio.addEventListener('playing', () => {
            _playing = true;
            renderRadioCard();
        });
        _audio.addEventListener('pause', () => {
            _playing = false;
            renderRadioCard();
        });
        _audio.addEventListener('error', () => {
            _playing = false;
            warn('Ошибка потока:', _audio.src);
            if (typeof showToast === 'function') showToast('❌ Не удалось воспроизвести', 2500);
            renderRadioCard();
        });
        return _audio;
    }

    async function playStation(station) {
        if (!station || !station.url) return;
        if (!station.url.startsWith('https://')) {
            if (typeof showToast === 'function') showToast('⚠️ Станция только по HTTP', 2500);
            return;
        }

        const audio = ensureAudio();
        _currentId = station.id;
        saveCurrent();

        try {
            audio.src = station.url;
            audio.load();
            await audio.play();
            _playing = true;
        } catch (e) {
            warn('play() ошибка:', e.message);
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
        const cur = getCurrentStation();
        if (!cur) {
            // Нет текущей — берём первую из избранного или первую из списка
            const firstFav = _favorites[0] ? getStationById(_favorites[0]) : null;
            if (firstFav) playStation(firstFav);
            else if (STATIONS[0]) playStation(STATIONS[0]);
            return;
        }
        if (_playing) pauseStation();
        else playStation(cur);
    }

    function setVolume(v) {
        _volume = Math.max(0, Math.min(1, v));
        if (_audio) _audio.volume = _volume;
    }

    // ═══════════════════════════════════════════════════════════
    //  ФИЛЬТРАЦИЯ
    // ═══════════════════════════════════════════════════════════
    function getFilteredStations() {
        return STATIONS.filter(s => {
            if (_filterGenre !== 'all' && s.genre !== _filterGenre) return false;
            if (_filterCountry !== 'all' && s.country !== _filterCountry) return false;
            return true;
        });
    }

    function getAllGenres() {
        const set = new Set();
        STATIONS.forEach(s => s.genre && set.add(s.genre));
        return ['all', ...Array.from(set).sort()];
    }

    function getAllCountries() {
        const set = new Set();
        STATIONS.forEach(s => s.country && set.add(s.country));
        return ['all', ...Array.from(set).sort()];
    }

    // ═══════════════════════════════════════════════════════════
    //  HTML КАРТОЧКИ
    // ═══════════════════════════════════════════════════════════
    function buildRadioCardHTML() {
        const cur = getCurrentStation();
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
            // ─── Избранное ───
            const favStations = _favorites.map(getStationById).filter(Boolean);
            const favHTML = favStations.length === 0
                ? '<div class="wc-radio-empty">Пока пусто. Нажми ⭐ у станции ниже</div>'
                : favStations.map(s => `
                    <div class="wc-radio-item ${_currentId === s.id ? 'active' : ''}">
                        <button class="wc-radio-mini-btn" data-radio-action="play" data-id="${escapeHtmlSafe(s.id)}">▶️</button>
                        <span class="wc-radio-item-name">${escapeHtmlSafe(s.name)}</span>
                        <span class="wc-radio-item-tag">${escapeHtmlSafe(s.country)} · ${escapeHtmlSafe(s.genre)}</span>
                        <button class="wc-radio-mini-btn starred" data-radio-action="unfav" data-id="${escapeHtmlSafe(s.id)}">★</button>
                    </div>
                `).join('');

            // ─── Фильтры ───
            const genres = getAllGenres();
            const countries = getAllCountries();

            const genreOpts = genres.map(g =>
                `<option value="${escapeHtmlSafe(g)}" ${_filterGenre === g ? 'selected' : ''}>${g === 'all' ? 'Все жанры' : escapeHtmlSafe(g)}</option>`
            ).join('');

            const countryOpts = countries.map(c =>
                `<option value="${escapeHtmlSafe(c)}" ${_filterCountry === c ? 'selected' : ''}>${c === 'all' ? 'Все страны' : escapeHtmlSafe(c)}</option>`
            ).join('');

            // ─── Список станций ───
            const filtered = getFilteredStations();
            const listHTML = filtered.length === 0
                ? '<div class="wc-radio-empty">Ничего не найдено</div>'
                : filtered.map(s => `
                    <div class="wc-radio-item ${_currentId === s.id ? 'active' : ''}">
                        <button class="wc-radio-mini-btn" data-radio-action="play" data-id="${escapeHtmlSafe(s.id)}">▶️</button>
                        <span class="wc-radio-item-name">
                            <span class="wc-radio-flag">${escapeHtmlSafe(s.country)}</span>
                            ${escapeHtmlSafe(s.name)}
                        </span>
                        <span class="wc-radio-item-tag">${escapeHtmlSafe(s.genre)}</span>
                        <button class="wc-radio-mini-btn ${isFavorite(s.id) ? 'starred' : ''}"
                                data-radio-action="${isFavorite(s.id) ? 'unfav' : 'fav'}"
                                data-id="${escapeHtmlSafe(s.id)}">
                            ${isFavorite(s.id) ? '★' : '⭐'}
                        </button>
                    </div>
                `).join('');

            expandedBody = `
                <div class="wc-radio-section">
                    <div class="wc-radio-section-title">⭐ Избранное (${favStations.length})</div>
                    <div class="wc-radio-list">${favHTML}</div>
                </div>

                <div class="wc-radio-section">
                    <div class="wc-radio-section-title">🎵 Все станции (${filtered.length} из ${STATIONS.length})</div>
                    <div class="wc-radio-filters">
                        <select class="wc-radio-select" data-radio-filter="genre">${genreOpts}</select>
                        <select class="wc-radio-select" data-radio-filter="country">${countryOpts}</select>
                    </div>
                    <div class="wc-radio-list wc-radio-list-scroll">${listHTML}</div>
                </div>
            `;
        }

        const hint = _expanded
            ? '<div class="wc-hint">👆 Тап по пустому месту — свернуть</div>'
            : '<div class="wc-hint">👆 Список станций</div>';

        return `
            <div class="widget-card radio ${_expanded ? 'expanded' : ''}" data-widget-id="radio">
                <div class="wc-header">
                    <div class="wc-icon">📻</div>
                    <div class="wc-title-block">
                        <div class="wc-title">Радио</div>
                        <div class="wc-subtitle">${_favorites.length} в избранном · ${STATIONS.length} станций</div>
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
    //  ПАТЧ #chatsList.innerHTML
    // ═══════════════════════════════════════════════════════════
    function patchChatsListInnerHTML() {
        const container = document.getElementById('chatsList');
        if (!container) { setTimeout(patchChatsListInnerHTML, 500); return; }
        if (container._radioPatched) return;

        const originalDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (!originalDescriptor) return;

        try {
            Object.defineProperty(container, 'innerHTML', {
                get() {
                    return originalDescriptor.get.call(this);
                },
                set(value) {
                    if (isRadioAdded()) {
                        // Проверяем: не вставили ли мы уже радио в этот HTML?
                        if (typeof value === 'string' && value.indexOf('data-widget-id="radio"') === -1) {
                            const radioHtml = buildRadioCardHTML();
                            value = radioHtml + value;
                        }
                    }
                    return originalDescriptor.set.call(this, value);
                },
                configurable: true,
            });
            container._radioPatched = true;
            log('✅ innerHTML #chatsList пропатчен (radio v2)');
        } catch (e) {
            warn('Патч innerHTML не удался:', e);
        }
    }

    setTimeout(patchChatsListInnerHTML, 600);
    setTimeout(patchChatsListInnerHTML, 2500);

    // ═══════════════════════════════════════════════════════════
    //  РЕРЕНДЕР ТОЛЬКО КАРТОЧКИ
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

        // Сохраняем позицию скролла в списке станций
        const oldScroll = oldCard.querySelector('.wc-radio-list-scroll');
        const scrollTop = oldScroll ? oldScroll.scrollTop : 0;

        oldCard.replaceWith(newCard);

        const newScroll = newCard.querySelector('.wc-radio-list-scroll');
        if (newScroll && scrollTop > 0) newScroll.scrollTop = scrollTop;
    }

    // ═══════════════════════════════════════════════════════════
    //  ОБРАБОТЧИКИ
    // ═══════════════════════════════════════════════════════════
    function installHandlers() {
        const container = document.getElementById('chatsList');
        if (!container) { setTimeout(installHandlers, 500); return; }
        if (container._radioHandlers) return;
        container._radioHandlers = true;

        // ─── Долгое нажатие ───
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

            // Кнопки
            const actionEl = e.target.closest('[data-radio-action]');
            if (actionEl) {
                e.stopPropagation();
                const action = actionEl.dataset.radioAction;
                const id = actionEl.dataset.id;

                switch (action) {
                    case 'toggle': togglePlay(); return;
                    case 'clear':
                        _currentId = null; saveCurrent();
                        if (_audio) { _audio.pause(); _audio.src = ''; }
                        _playing = false;
                        renderRadioCard();
                        return;
                    case 'play': {
                        const st = getStationById(id);
                        if (st) playStation(st);
                        return;
                    }
                    case 'fav': {
                        toggleFavorite(id);
                        if (typeof showToast === 'function') showToast('⭐ Добавлено', 1200);
                        renderRadioCard();
                        return;
                    }
                    case 'unfav': {
                        toggleFavorite(id);
                        if (typeof showToast === 'function') showToast('Убрано', 1200);
                        renderRadioCard();
                        return;
                    }
                }
                return;
            }

            // Селекты фильтров
            const filterEl = e.target.closest('[data-radio-filter]');
            if (filterEl) return; // даём браузеру обработать

            if (fired) { fired = false; return; }

            // Клик по развёрнутому контенту — не сворачиваем
            if (e.target.closest('.wc-radio-section')) return;
            if (e.target.closest('button, select, input')) return;

            setExpanded(!_expanded);
            renderRadioCard();
        });

        // ─── Смена фильтров ───
        container.addEventListener('change', (e) => {
            const sel = e.target.closest('[data-radio-filter]');
            if (!sel) return;
            const type = sel.dataset.radioFilter;
            if (type === 'genre') _filterGenre = sel.value;
            if (type === 'country') _filterCountry = sel.value;
            renderRadioCard();
        });

        // ─── Долгое нажатие touch ───
        container.addEventListener('touchstart', (e) => {
            const card = e.target.closest('.widget-card.radio');
            if (!card) return;
            if (e.target.closest('button, select, input')) return;
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

        // ─── Долгое нажатие mouse ───
        container.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const card = e.target.closest('.widget-card.radio');
            if (!card) return;
            if (e.target.closest('button, select, input')) return;
            startX = e.clientX; startY = e.clientY;
            startPress(card);
        });
        container.addEventListener('mouseup', cancelPress);
        container.addEventListener('mouseleave', cancelPress);

        container.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.widget-card.radio');
            if (!card) return;
            if (e.target.closest('select, input')) return;
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Удалить виджет «Радио»?')) removeRadioWidget();
        });

        log('✅ Обработчики установлены');
    }

    installHandlers();

    // ═══════════════════════════════════════════════════════════
    //  ДОБАВЛЕНИЕ / УДАЛЕНИЕ
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
            warn('Не удалось сохранить:', e);
            return false;
        }

        if (typeof showToast === 'function') showToast('✅ Виджет «Радио» добавлен', 2000);
        if (typeof soundManager !== 'undefined') { try { soundManager.play('send'); } catch (e) {} }

        if (typeof renderChatsList === 'function') renderChatsList();
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

        if (_audio) {
            try { _audio.pause(); _audio.src = ''; } catch (e) {}
        }
        _playing = false;
        _currentId = null;
        saveCurrent();

        if (typeof showToast === 'function') showToast('🗑️ Виджет «Радио» удалён', 1500);
        if (typeof soundManager !== 'undefined') { try { soundManager.play('delete'); } catch (e) {} }
        if (navigator.vibrate) navigator.vibrate(20);

        document.querySelectorAll('.widget-card.radio').forEach(el => el.remove());
    }

    // ═══════════════════════════════════════════════════════════
    //  СТИЛИ
    // ═══════════════════════════════════════════════════════════
    function ensureStyles() {
        if (document.getElementById('radioWidgetStylesV2')) return;
        const style = document.createElement('style');
        style.id = 'radioWidgetStylesV2';
        style.textContent = `
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
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(255,255,255,0.06);
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
                background: rgba(108,92,231,0.25);
                border-color: rgba(108,92,231,0.5);
            }
            .widget-card.radio .wc-radio-play {
                background: linear-gradient(135deg, #6c5ce7, #00b894);
                border-color: transparent;
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
            .widget-card.radio .wc-radio-list-scroll {
                max-height: 340px;
                overflow-y: auto;
                padding-right: 2px;
                scrollbar-width: thin;
                scrollbar-color: rgba(108,92,231,0.5) transparent;
            }
            .widget-card.radio .wc-radio-list-scroll::-webkit-scrollbar {
                width: 4px;
            }
            .widget-card.radio .wc-radio-list-scroll::-webkit-scrollbar-track {
                background: transparent;
            }
            .widget-card.radio .wc-radio-list-scroll::-webkit-scrollbar-thumb {
                background: rgba(108,92,231,0.5);
                border-radius: 2px;
            }

            /* ─── Фильтры ─── */
            .widget-card.radio .wc-radio-filters {
                display: flex;
                gap: 6px;
                margin-bottom: 8px;
            }
            .widget-card.radio .wc-radio-select {
                flex: 1;
                min-width: 0;
                padding: 8px 10px;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(0,0,0,0.35);
                color: #fff;
                font-size: 12px;
                outline: none;
                cursor: pointer;
                -webkit-appearance: none;
                appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23a78bfa' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 8px center;
                padding-right: 24px;
            }
            .widget-card.radio .wc-radio-select:focus {
                border-color: rgba(108,92,231,0.6);
            }
            .widget-card.radio .wc-radio-select option {
                background: #1a1a2e;
                color: #fff;
            }

            /* ─── Строка станции ─── */
            .widget-card.radio .wc-radio-item {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 7px 8px;
                border-radius: 10px;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.05);
                transition: background 0.15s, border-color 0.15s;
            }
            .widget-card.radio .wc-radio-item:hover {
                background: rgba(255,255,255,0.06);
            }
            .widget-card.radio .wc-radio-item.active {
                background: linear-gradient(135deg, rgba(108,92,231,0.22), rgba(0,184,148,0.12));
                border-color: rgba(108,92,231,0.45);
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
            .widget-card.radio .wc-radio-flag {
                margin-right: 4px;
                font-size: 13px;
            }
            .widget-card.radio .wc-radio-item-tag {
                font-size: 10px;
                color: #888;
                flex-shrink: 0;
                max-width: 90px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .widget-card.radio .wc-radio-mini-btn {
                width: 30px;
                height: 30px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.04);
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
                background: rgba(108,92,231,0.3);
                border-color: rgba(108,92,231,0.5);
            }
            .widget-card.radio .wc-radio-mini-btn.starred {
                background: rgba(254,202,87,0.2);
                border-color: rgba(254,202,87,0.5);
                color: #feca57;
            }
            .widget-card.radio .wc-radio-mini-btn.danger:hover {
                background: rgba(255,107,107,0.25);
                border-color: rgba(255,107,107,0.5);
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
    //  МОДАЛКА ВИДЖЕТОВ
    // ═══════════════════════════════════════════════════════════
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
                <div class="wp-widget-desc">${STATIONS.length} станций · избранное · фильтры</div>
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

    const pickerObserver = new MutationObserver(() => {
        if (document.getElementById('wpWidgetsList')) injectRadioIntoPicker();
    });
    pickerObserver.observe(document.body, { childList: true, subtree: true });

    // ═══════════════════════════════════════════════════════════
    //  ЗАПУСК
    // ═══════════════════════════════════════════════════════════
    ensureStyles();
    ensureAudio();

    if (isRadioAdded()) {
        setTimeout(() => renderRadioCard(), 1500);
    }

    // ═══════════════════════════════════════════════════════════
    //  ПУБЛИЧНЫЙ API
    // ═══════════════════════════════════════════════════════════
    window.RadioWidget = {
        add: addRadioWidget,
        remove: removeRadioWidget,
        play: (id) => {
            const st = typeof id === 'string' ? getStationById(id) : id;
            if (st) playStation(st);
            else if (typeof showToast === 'function') showToast('❌ Станция не найдена', 2000);
        },
        playByName: (nameQuery) => {
            const q = (nameQuery || '').toLowerCase();
            const st = STATIONS.find(s => s.name.toLowerCase().includes(q));
            if (st) playStation(st);
            else if (typeof showToast === 'function') showToast('❌ Станция не найдена', 2000);
        },
        pause: pauseStation,
        toggle: togglePlay,
        volume: (v) => { setVolume(v); return _volume; },
        list: () => STATIONS.slice(),
        favorites: () => _favorites.slice(),
        clearFavorites: () => {
            _favorites = [];
            saveFavorites();
            renderRadioCard();
        },
        filter: (genre, country) => {
            if (genre !== undefined) _filterGenre = genre;
            if (country !== undefined) _filterCountry = country;
            renderRadioCard();
        },
        debug: () => {
            const info = {
                added: isRadioAdded(),
                totalStations: STATIONS.length,
                favorites: _favorites.length,
                current: getCurrentStation()?.name || null,
                playing: _playing,
                expanded: _expanded,
                filterGenre: _filterGenre,
                filterCountry: _filterCountry,
                audioSrc: _audio?.src || null,
            };
            console.log('=== RADIO WIDGET v2 DEBUG ===');
            console.table(info);
            return info;
        },
    };

    console.log('📻 [Radio v2] Готово ·', STATIONS.length, 'станций');
    console.log('Проверить: RadioWidget.debug()');

})();
