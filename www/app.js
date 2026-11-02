/* ============================================================
   MAXA PHONE LAUNCHER — логика
   ============================================================ */

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    /* ------------------------------------------------------------
       Состояние
       ------------------------------------------------------------ */

    const DEFAULTS = {
        storageVersion: 3,
        wifi: true,
        bluetooth: false,
        flashlight: false,
        saver: true,
        brightness: 80,
        devMode: true,
        carrier: 'Нет сети',
        network: '',
        registered: false,
        signalLevel: 0,
        wifiConnected: false,
        cellularConnected: false,
        simState: -1,
        canWrite: false,
        frontCamera: false,
        timerRemaining: 25 * 60,
        timerRunning: false,
        alarms: [
            { time: '07:30', label: 'Подъём', days: 'Пн–Пт', enabled: true },
            { time: '09:00', label: 'Зарядка', days: 'Сб–Вс', enabled: false }
        ],
        devToggles: { usb: true, mock: false, taps: false, awake: true }
    };

    function loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem('maxa.launcher.state') || '{}');
            if (saved.storageVersion !== DEFAULTS.storageVersion) {
                return JSON.parse(JSON.stringify(DEFAULTS));
            }
            const merged = Object.assign({}, DEFAULTS, saved, {
                alarms: saved.alarms || DEFAULTS.alarms.map((a) => Object.assign({}, a)),
                devToggles: Object.assign({}, DEFAULTS.devToggles, saved.devToggles || {})
            });
            merged.saver = true;
            return merged;        } catch (e) {
            return JSON.parse(JSON.stringify(DEFAULTS));
        }
    }

    const state = loadState();
    save();

    function save() {
        try {
            localStorage.setItem('maxa.launcher.state', JSON.stringify(state));
        } catch (e) { /* ignore */ }
    }

    /* ------------------------------------------------------------
       Системные настройки (яркость, поворот, Wi-Fi, Bluetooth)
       ------------------------------------------------------------ */

    function nativeKiosk() {
        return (window.Kiosk && typeof window.Kiosk.getSystemState === 'function') ? window.Kiosk : null;
    }

    let brightnessTimer = null;

    function refreshSystemState(callback) {
        const kiosk = nativeKiosk();
        if (!kiosk) {
            if (callback) callback();
            return;
        }
        kiosk.getSystemState(function (result) {
            try {
                const s = typeof result === 'string' ? JSON.parse(result) : result;
                if (s) {
                    if (typeof s.wifi === 'boolean') state.wifi = s.wifi;
                    if (typeof s.bluetooth === 'boolean') state.bluetooth = s.bluetooth;
                    if (typeof s.wifiConnected === 'boolean') state.wifiConnected = s.wifiConnected;
                    if (typeof s.carrier === 'string') state.carrier = s.carrier;
                    if (typeof s.networkType === 'string') state.network = s.networkType;
                    if (typeof s.signalLevel === 'number') state.signalLevel = s.signalLevel;
                    if (typeof s.registered === 'boolean') state.registered = s.registered;
                    if (typeof s.cellularConnected === 'boolean') state.cellularConnected = s.cellularConnected;
                    if (typeof s.simState === 'number') state.simState = s.simState;
                    if (typeof s.brightness === 'number') {
                        state.brightness = Math.max(10, Math.min(100, s.brightness));
                    }
                    state.canWrite = !!s.canWrite;
                    state.accessibilityEnabled = !!s.accessibility;
                }
            } catch (e) { /* ignore */ }
            updateToggles();
            applyBrightness();
            if (callback) callback();
        }, function () {
            if (callback) callback();
        });
    }

    function promptWriteSettings(force) {
        if (!force && state.canWrite) return;
        if (!force && localStorage.getItem('maxa.writePrompted') === '1') return;
        localStorage.setItem('maxa.writePrompted', '1');
        showToast('Разрешите изменение системных настроек');
        const kiosk = nativeKiosk();
        if (kiosk) kiosk.requestWriteSettings(function () {}, function () {});
        else showToast('Настройки → Специальный доступ → Изменение системных настроек');
    }

    function applySystemDefaults() {
        const kiosk = nativeKiosk();
        if (!kiosk) return;
        kiosk.applySystemDefaults(function () {}, function (err) {
            if (String(err).indexOf('WRITE_SETTINGS_NOT_GRANTED') !== -1) {
                promptWriteSettings(false);
            }
        });
    }

    function setSystemBrightness(percent) {
        const dim = $('#dim');
        const kiosk = nativeKiosk();
        if (!kiosk) {
            // Предпросмотр в браузере.
            if (dim) dim.style.opacity = String(((100 - percent) / 100) * 0.6);
            return;
        }
        if (dim) dim.style.opacity = '0';
        kiosk.setBrightness(percent, function () {}, function (err) {
            if (String(err).indexOf('WRITE_SETTINGS_NOT_GRANTED') !== -1) {
                promptWriteSettings(true);
            }
        });
    }

    function openConnectivity(kind) {
        const kiosk = nativeKiosk();
        closeQS();
        if (!kiosk) {
            // Предпросмотр в браузере.
            state[kind] = !state[kind];
            save();
            updateToggles();
            return;
        }
        showToast(kind === 'wifi' ? 'Открываю Wi-Fi…' : 'Открываю Bluetooth…');
        if (kind === 'wifi') kiosk.openWifiSettings(function () {}, function () {});
        else kiosk.openBluetoothSettings(function () {}, function () {});
    }

    /* ------------------------------------------------------------
       Иконки
       ------------------------------------------------------------ */

    const ICONS = {
        search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
        wifi: '<svg viewBox="0 0 24 24"><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/></svg>',
        bluetooth: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10-5 4V3l5 4L7 17"/></svg>',
        cellular: '<svg viewBox="0 0 24 24"><path d="M4 18v-3M9 18v-7M14 18V7M19 18V4"/></svg>',
        battery: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="17" height="10" rx="3"/><path d="M22 10v4"/><path d="M5 10h5v4H5z"/></svg>',
        saver: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
        volume: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
        code: '<svg viewBox="0 0 24 24"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></svg>',
        info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>',
        phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
        phoneIn: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
        phoneOut: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
        chat: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.6 9.6 0 0 1-3.8-.8L3 21l1.4-4a8.2 8.2 0 0 1-1.4-4.5C3 7.4 7 3.5 12 3.5s9 3.6 9 8z"/><path d="M8.5 9.5h7M8.5 13.5h4.5"/></svg>',
        globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
        alarm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M5 3.5 2.5 6M19 3.5 21.5 6"/></svg>',
        camera: '<svg viewBox="0 0 24 24"><path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>',
        settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.55V20h-3v-.15a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.9.3l-.1.1L6.6 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.55-1H5v-3h.15a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.3-1.9L6.3 8l2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.55V4h3v.15a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.6 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.55 1H21v3h-.15a1.7 1.7 0 0 0-1.45 1z"/></svg>',
        chevron: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
        lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v2"/></svg>',
        flash: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
        grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
        timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/></svg>',
        gallery: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
        flip: '<svg viewBox="0 0 24 24"><path d="M4 8h4l2-3h4l2 3h4v12H4z"/><path d="M12 11a4 4 0 1 1-4 4"/><path d="M8 12v3h3"/></svg>',
        usb: '<svg viewBox="0 0 24 24"><path d="M12 3v13M12 3l-2 3M12 3l2 3"/><path d="M12 16l-3 3M12 16l3 3"/><path d="M9 19h6"/><circle cx="12" cy="16" r="1.4"/></svg>',
        location: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
        tap: '<svg viewBox="0 0 24 24"><path d="M9 11V5a2 2 0 0 1 4 0v6"/><path d="M13 11V4a2 2 0 0 1 4 0v8"/><path d="M17 12V7a2 2 0 0 1 4 0v8a7 7 0 0 1-7 7h-1a8 8 0 0 1-8-8v-1"/></svg>',
        awake: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8M12 18v4"/><path d="M7 11h2l1-2 2 5 1-3h2"/></svg>'
    };

    function icon(name, cls) {
        return '<span class="row-ico ' + (cls || '') + '">' + ICONS[name] + '</span>';
    }

    /* ------------------------------------------------------------
       Часы, статус, батарея
       ------------------------------------------------------------ */

    const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const pad = (n) => String(n).padStart(2, '0');

    function tick() {
        const d = new Date();
        const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
        const dateText = DAYS[d.getDay()].charAt(0).toUpperCase() + DAYS[d.getDay()].slice(1) + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];

        const clockTime = $('#clockTime');
        if (clockTime) clockTime.textContent = time;
        const clockDate = $('#clockDate');
        if (clockDate) clockDate.textContent = dateText;
        const qsClock = $('#qsClock');
        if (qsClock) qsClock.textContent = time;
        const qsDate = $('#qsDateSmall');
        if (qsDate) qsDate.textContent = dateText;

        tickTimer();
    }

    function applyStatus() {
        const carrier = $('#carrier');
        if (carrier) carrier.textContent = state.carrier || 'Нет сети';

        const network = $('#network');
        if (network) {
            network.textContent = state.registered ? (state.network || '') : '';
            network.style.display = state.registered && state.network ? '' : 'none';
        }

        const wifi = $('#wifiStatus');
        if (wifi) {
            wifi.classList.toggle('off', !state.wifi);
            wifi.classList.toggle('idle', !!state.wifi && !state.wifiConnected);
        }

        const signal = $('#signal');
        if (signal) {
            signal.style.display = state.registered ? '' : 'none';
            const level = state.registered
                ? Math.max(0, Math.min(4, state.signalLevel || 0))
                : 0;
            signal.querySelectorAll('i').forEach((bar, idx) => {
                bar.style.opacity = idx < level ? '1' : '0.18';
            });
        }
    }

    function updateBattery(level) {
        const pct = Math.max(0, Math.min(100, Math.round(level)));
        const pctEl = $('#batteryPct');
        if (pctEl) pctEl.textContent = pct + '%';
        const fill = $('#batteryFill');
        if (fill) fill.setAttribute('width', String(16 * pct / 100));
        const big = $('#batteryBig');
        if (big) big.textContent = pct + '%';
    }

    if (navigator.getBattery) {
        navigator.getBattery().then((b) => {
            updateBattery(b.level * 100);
            b.addEventListener('levelchange', () => updateBattery(b.level * 100));
        }).catch(() => {});
    }
    window.addEventListener('online', applyStatus);
    window.addEventListener('offline', applyStatus);

    /* ------------------------------------------------------------
       Яркость
       ------------------------------------------------------------ */

    function applyBrightness() {
        const dim = $('#dim');
        if (dim) {
            dim.style.opacity = nativeKiosk()
                ? '0'
                : String(((100 - state.brightness) / 100) * 0.6);
        }
        const slider = $('#brightnessSlider');
        if (slider) slider.value = state.brightness;
        const label = $('#brightnessValue');
        if (label) label.textContent = state.brightness + '%';
    }

    /* ------------------------------------------------------------
       Тосты
       ------------------------------------------------------------ */

    let toastTimer = null;
    function showToast(text) {
        const toast = $('#toast');
        if (!toast) return;
        toast.textContent = text;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
    }

    /* ------------------------------------------------------------
       Быстрые настройки
       ------------------------------------------------------------ */

    let qsOpen = false;

    function openQS() {
        if (qsOpen) return;
        qsOpen = true;
        const scrim = $('#qsScrim');
        const panel = $('#quickSettings');
        scrim.hidden = false;
        void scrim.offsetWidth;
        scrim.classList.add('show');
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        tick();
    }

    function closeQS() {
        if (!qsOpen) return;
        qsOpen = false;
        const scrim = $('#qsScrim');
        const panel = $('#quickSettings');
        scrim.classList.remove('show');
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        setTimeout(() => { if (!qsOpen) scrim.hidden = true; }, 300);
    }

    /* ------------------------------------------------------------
       Переключатели
       ------------------------------------------------------------ */

    const TOGGLE_META = {
        wifi: { label: 'Wi-Fi', on: 'Вкл', off: 'Выкл' },
        bluetooth: { label: 'Bluetooth', on: 'Вкл', off: 'Выкл' },
        flashlight: { label: 'Фонарик', on: 'Вкл', off: 'Выкл' },
        saver: { label: 'Экономия заряда', on: 'Вкл', off: 'Выкл' }
    };

    function toggleSetting(key) {
        if (key === 'saver') {
            state.saver = true;
            updateToggles();
            showToast('Экономия заряда включена постоянно');
            return;
        }
        if (key === 'wifi' || key === 'bluetooth') {
            openConnectivity(key);
            return;
        }
        if (key === 'flashlight') {
            const next = !state.flashlight;
            const kiosk = nativeKiosk();
            if (kiosk && typeof kiosk.setFlashlight === 'function') {
                kiosk.setFlashlight(next, function () {
                    state.flashlight = next;
                    save();
                    updateToggles();
                    showToast(next ? 'Фонарик включён' : 'Фонарик выключен');
                }, function (err) {
                    state.flashlight = false;
                    updateToggles();
                    showToast(String(err).indexOf('CAMERA_PERMISSION_DENIED') !== -1
                        ? 'Разрешите доступ к камере'
                        : 'Фонарик недоступен');
                });
                return;
            }
        }
        if (!(key in TOGGLE_META)) return;
        state[key] = !state[key];
        save();
        updateToggles();
        if (key === 'flashlight') showToast(state.flashlight ? 'Фонарик включён' : 'Фонарик выключен');
        else showToast(TOGGLE_META[key].label + ': ' + (state[key] ? 'включено' : 'выключено'));
    }

    function updateToggles() {
        $$('[data-toggle]').forEach((el) => {
            const key = el.dataset.toggle;
            const isOn = key === 'saver' ? true : !!state[key];
            el.classList.toggle('locked', key === 'saver');
            if (el.classList.contains('qs-tile')) {
                el.classList.toggle('on', isOn);
                const st = el.querySelector('.qs-state');
                if (st) st.textContent = isOn ? 'Вкл' : 'Выкл';
            } else {
                const sw = el.querySelector('.switch');
                if (sw) sw.classList.toggle('on', isOn);
                const sub = el.querySelector('[data-sub]');
                if (sub) sub.textContent = isOn ? TOGGLE_META[key].on : TOGGLE_META[key].off;
            }
        });
        applyStatus();
    }

    /* ------------------------------------------------------------
       Навигация по экранам
       ------------------------------------------------------------ */

    const stack = [];
    let pinBuffer = '';
    let pinErrorTimer = null;

    function currentName() {
        return stack[stack.length - 1] || null;
    }

    function openApp(name) {
        closeQS();
        stack.length = 0;
        stack.push(name);
        renderScreen();
    }

    function pushScreen(name) {
        closeQS();
        stack.push(name);
        renderScreen();
    }

    function popScreen() {
        if (!stack.length) return;
        stack.pop();
        if (!stack.length) {
            hideScreen();
        } else {
            renderScreen();
        }
    }

    function hideScreen() {
        const screen = $('#screen');
        screen.hidden = true;
        screen.classList.remove('camera-screen');
        $('#screenTitle').textContent = '';
        $('#screenBody').innerHTML = '';
        $('#screenActions').innerHTML = '';
        $('#screenHead').style.display = '';
        stack.length = 0;
        pinBuffer = '';
    }

    function renderScreen() {
        const name = currentName();
        if (!name) { hideScreen(); return; }
        const screen = $('#screen');
        screen.hidden = false;
        const def = SCREENS[name]();
        screen.classList.toggle('camera-screen', !!def.camera);
        $('#screenTitle').textContent = def.title || '';
        $('#screenHead').style.display = def.camera ? 'none' : '';
        $('#screenActions').innerHTML = def.actions || '';
        $('#screenBody').innerHTML = def.html || '';
        if (def.after) def.after();
        updateToggles();
    }

    /* ------------------------------------------------------------
       Данные
       ------------------------------------------------------------ */

    const CALLS = [
        { name: 'Мама', initial: 'М', type: 'in', time: '17:02', color: 'linear-gradient(145deg,#f472b6,#db2777)' },
        { name: 'Максим Орлов', initial: 'М', type: 'out', time: '16:48', color: 'linear-gradient(145deg,#60a5fa,#2563eb)' },
        { name: 'Служба доставки', initial: 'С', type: 'missed', time: '16:20', color: 'linear-gradient(145deg,#fbbf24,#d97706)' },
        { name: 'Анна Соколова', initial: 'А', type: 'in', time: '14:05', color: 'linear-gradient(145deg,#a78bfa,#7c3aed)' },
        { name: 'Работа', initial: 'Р', type: 'out', time: '11:32', color: 'linear-gradient(145deg,#34d399,#059669)' },
        { name: 'МТС', initial: 'М', type: 'in', time: '09:15', color: 'linear-gradient(145deg,#f87171,#dc2626)' }
    ];

    const CHATS = [
        { name: 'Команда MAXA', initial: 'К', last: 'Готово, проверяй макет', time: '17:05', unread: 3, color: 'linear-gradient(145deg,#fde68a,#f59e0b)' },
        { name: 'Анна Соколова', initial: 'А', last: 'Скинула финальные правки', time: '16:42', unread: 1, color: 'linear-gradient(145deg,#fbcfe8,#db2777)' },
        { name: 'Доставка', initial: 'Д', last: 'Курьер будет через 20 минут', time: '15:18', unread: 0, color: 'linear-gradient(145deg,#86efac,#16a34a)' },
        { name: 'Максим Орлов', initial: 'М', last: 'Посмотри статус сборки', time: '14:07', unread: 0, color: 'linear-gradient(145deg,#93c5fd,#2563eb)' },
        { name: 'Избранное', initial: 'И', last: 'Вы сохранили сообщение', time: 'Вчера', unread: 0, color: 'linear-gradient(145deg,#c4b5fd,#7c3aed)' }
    ];

    const QUICK_LINKS = [
        { label: 'Google', letter: 'G', bg: 'linear-gradient(145deg,#4285f4,#1a73e8)' },
        { label: 'YouTube', letter: '▶', bg: 'linear-gradient(145deg,#ff4d5a,#e00000)' },
        { label: 'VK', letter: 'VK', bg: 'linear-gradient(145deg,#2787f5,#0a5dc2)' },
        { label: 'Telegram', letter: 'TG', bg: 'linear-gradient(145deg,#2AABEE,#1c7fc4)' },
        { label: 'Википедия', letter: 'W', bg: 'linear-gradient(145deg,#4b5563,#111827)' },
        { label: 'Погода', letter: '☀', bg: 'linear-gradient(145deg,#fbbf24,#f59e0b)' },
        { label: 'Новости', letter: 'N', bg: 'linear-gradient(145deg,#fb7185,#e11d48)' },
        { label: 'Карты', letter: 'M', bg: 'linear-gradient(145deg,#34d399,#059669)' }
    ];

    const TABS = [
        { title: 'MAXA Launcher — документация', domain: 'maxa.dev/docs', letter: 'M' },
        { title: 'Погода в Москве на неделю', domain: 'yandex.ru/pogoda', letter: 'Я' },
        { title: 'Новости технологий', domain: 'lenta.ru', letter: 'Л' }
    ];

    const ABOUT_ROWS = [
        { title: 'Модель', value: 'Redmi Note 10T' },
        { title: 'Версия Android', value: '15' },
        { title: 'Процессор', value: 'Dimensity 700' },
        { title: 'Оперативная память', value: '4 ГБ' },
        { title: 'Сборка', value: 'MAXA Launcher 1.0.0' },
        { title: 'Разрешение экрана', value: '1080 × 2400' }
    ];

    /* ------------------------------------------------------------
       Реальные приложения для дока
       ------------------------------------------------------------ */

    const NATIVE_APPS = {
        phone: [
            { packageName: 'com.google.android.dialer' },
            { packageName: 'com.android.dialer' },
            { actionName: 'android.intent.action.DIAL' }
        ],
        max: [
            { packageName: 'ru.oneme.app' }
        ],
        browser: [
            { packageName: 'com.android.chrome' },
            { uri: 'https://www.google.com' }
        ],
        alarm: [
            { packageName: 'com.android.deskclock' },
            { packageName: 'com.miui.clock' },
            { actionName: 'android.intent.action.SHOW_ALARMS' }
        ],
        camera: [
            { packageName: 'com.android.camera' },
            { packageName: 'com.miui.camera' },
            { actionName: 'android.media.action.STILL_IMAGE_CAMERA' }
        ],
        vol: [
            { packageName: 'com.vol.app' }
        ],
        diary: [
            { packageName: 'ru.mes.dnevnik.fgis' },
            { packageName: 'ru.mos.school' },
            { packageName: 'ru.mos.mesh' },
            { packageName: 'com.mos.dnevnik' },
            { packageName: 'ru.dnevnik' },
            { packageName: 'com.dnevnik' },
            { packageName: 'ru.moya.shkola' },
            { packageName: 'com.moya.school.diary' }
        ]
    };

    function launchNativeApp(name) {
        const attempts = NATIVE_APPS[name];
        const launcher = window.plugins && window.plugins.launcher;
        if (!attempts) return;
        if (!launcher) {
            // Запасной вариант для предпросмотра в браузере.
            openApp(name);
            return;
        }

        let index = 0;
        const tryNext = () => {
            if (index >= attempts.length) {
                showToast('Приложение не найдено');
                return;
            }
            const options = attempts[index++];
            launcher.launch(options, () => {}, () => setTimeout(tryNext, 60));
        };
        tryNext();
    }

    /* ------------------------------------------------------------
       Экраны
       ------------------------------------------------------------ */

    const SCREENS = {};

    /* --- Телефон --- */
    SCREENS.phone = () => ({
        title: 'Телефон',
        html:
            '<div class="search-bar">' + ICONS.search + '<input id="phoneSearch" type="search" placeholder="Поиск контакта" autocomplete="off"></div>' +
            '<div class="section-label">Недавние звонки</div>' +
            '<div id="callList">' + CALLS.map((c) => {
                const missed = c.type === 'missed';
                const typeText = c.type === 'in' ? 'Входящий' : c.type === 'out' ? 'Исходящий' : 'Пропущенный';
                const typeIcon = missed ? ICONS.phoneIn : c.type === 'out' ? ICONS.phoneOut : ICONS.phoneIn;
                return '<div class="call-row" data-name="' + c.name.toLowerCase() + '">' +
                    '<span class="avatar" style="background:' + c.color + '">' + c.initial + '</span>' +
                    '<div class="call-main"><div class="call-name">' + c.name + '</div>' +
                    '<div class="call-meta' + (missed ? ' missed' : '') + '">' + typeIcon + '<span>' + typeText + '</span></div></div>' +
                    '<span class="call-time">' + c.time + '</span>' +
                    '<button class="call-btn" data-call="' + c.name + '" aria-label="Позвонить">' + ICONS.phone + '</button>' +
                    '</div>';
            }).join('') + '</div>',
        after: () => {
            const input = $('#phoneSearch');
            if (!input) return;
            input.addEventListener('input', () => {
                const q = input.value.trim().toLowerCase();
                $$('#callList .call-row').forEach((row) => {
                    row.style.display = row.dataset.name.includes(q) ? '' : 'none';
                });
            });
        }
    });

    /* --- MAX --- */
    SCREENS.max = () => ({
        title: 'MAX',
        html:
            '<div class="search-bar">' + ICONS.search + '<input id="chatSearch" type="search" placeholder="Поиск по чатам" autocomplete="off"></div>' +
            '<div class="section-label">Чаты</div>' +
            '<div id="chatList">' + CHATS.map((c) =>
                '<div class="chat-row" data-name="' + c.name.toLowerCase() + '">' +
                '<span class="chat-avatar" style="background:' + c.color + '">' + c.initial + '</span>' +
                '<div class="chat-main"><div class="chat-top"><span class="chat-name">' + c.name + '</span><span class="chat-time">' + c.time + '</span></div>' +
                '<div class="chat-last">' + c.last + '</div></div>' +
                (c.unread ? '<span class="chat-badge">' + c.unread + '</span>' : '') +
                '</div>'
            ).join('') + '</div>',
        after: () => {
            const input = $('#chatSearch');
            if (!input) return;
            input.addEventListener('input', () => {
                const q = input.value.trim().toLowerCase();
                $$('#chatList .chat-row').forEach((row) => {
                    row.style.display = row.dataset.name.includes(q) ? '' : 'none';
                });
            });
        }
    });

    /* --- Браузер --- */
    SCREENS.browser = () => ({
        title: 'Браузер',
        html:
            '<div class="search-bar">' + ICONS.search + '<input id="browserSearch" type="search" placeholder="Поиск или адрес сайта" autocomplete="off"></div>' +
            '<div class="quick-links">' + QUICK_LINKS.map((l) =>
                '<button class="quick-link" data-link="' + l.label + '">' +
                '<span class="tile" style="background:' + l.bg + '">' + l.letter + '</span><span>' + l.label + '</span></button>'
            ).join('') + '</div>' +
            '<div class="section-label">Недавние вкладки</div>' +
            '<div class="card">' + TABS.map((t) =>
                '<div class="tab-row"><span class="tab-fav">' + t.letter + '</span>' +
                '<div class="tab-main"><div class="tab-title">' + t.title + '</div><div class="tab-domain">' + t.domain + '</div></div>' +
                '<button class="call-btn" data-tab="' + t.title + '" aria-label="Открыть">' + ICONS.chevron.replace('class="chev"', 'style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2"') + '</button></div>'
            ).join('') + '</div>',
        after: () => {
            const input = $('#browserSearch');
            if (!input) return;
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && input.value.trim()) {
                    showToast('Открываю: ' + input.value.trim());
                    input.blur();
                }
            });
        }
    });

    /* --- Будильник --- */
    SCREENS.alarm = () => ({
        title: 'Будильник',
        html:
            '<div class="section-label">Мои будильники</div>' +
            '<div class="card">' + state.alarms.map((a, i) =>
                '<div class="alarm-row">' +
                '<div class="alarm-main"><div class="alarm-time' + (a.enabled ? '' : ' off') + '">' + a.time + '</div>' +
                '<div class="alarm-meta">' + a.label + '</div><div class="alarm-day">' + a.days + '</div></div>' +
                '<span class="switch' + (a.enabled ? ' on' : '') + '" data-alarm="' + i + '" role="switch" aria-checked="' + a.enabled + '"></span>' +
                '</div>'
            ).join('') + '</div>' +
            '<div class="timer-card">' +
            '<div class="timer-title">Таймер</div>' +
            '<div class="timer-value" id="timerValue">' + formatTime(state.timerRemaining) + '</div>' +
            '<div class="timer-presets">' +
            [5, 10, 25, 60].map((m) => '<button class="chip" data-timer-preset="' + m + '">' + m + ' мин</button>').join('') +
            '</div>' +
            '<div class="timer-actions">' +
            '<button class="timer-btn secondary" data-timer="reset">Сброс</button>' +
            '<button class="timer-btn" data-timer="toggle">' + (state.timerRunning ? 'Пауза' : 'Старт') + '</button>' +
            '</div></div>',
        after: () => { updateTimerDom(); }
    });

    function formatTime(total) {
        const s = Math.max(0, Math.floor(total));
        return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    }

    function updateTimerDom() {
        const el = $('#timerValue');
        if (el) el.textContent = formatTime(state.timerRemaining);
        const btn = $('[data-timer="toggle"]');
        if (btn) btn.textContent = state.timerRunning ? 'Пауза' : 'Старт';
    }

    function tickTimer() {
        if (!state.timerRunning) return;
        if (state.timerRemaining > 0) {
            state.timerRemaining -= 1;
            if (state.timerRemaining === 0) {
                state.timerRunning = false;
                save();
                showToast('Таймер завершён');
            }
            updateTimerDom();
        } else {
            state.timerRunning = false;
            updateTimerDom();
        }
    }

    /* --- Камера --- */
    SCREENS.camera = () => ({
        title: 'Камера',
        camera: true,
        html:
            '<div class="camera-view">' +
            '<div class="camera-scene"></div>' +
            '<div class="camera-grid"></div>' +
            '<div class="cam-top">' +
            '<button class="cam-pill" data-action="back">' +
            '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> Назад</button>' +
            '<div class="cam-top-right">' +
            '<button class="cam-round" data-action="cam-flash" aria-label="Вспышка">' + ICONS.flash + '</button>' +
            '<button class="cam-round" data-action="cam-timer" aria-label="Таймер">' + ICONS.timer + '</button>' +
            '</div></div>' +
            '<div class="cam-bottom">' +
            '<div class="cam-modes" id="camModes">' +
            ['Видео', 'Фото', 'Портрет', 'Ночь'].map((m, i) =>
                '<button class="cam-mode' + (m === 'Фото' ? ' active' : '') + '" data-mode="' + m + '">' + m + '</button>'
            ).join('') + '</div>' +
            '<div class="cam-controls">' +
            '<button class="cam-gallery" id="camGallery" data-action="cam-gallery">0</button>' +
            '<button class="shutter" id="shutter" aria-label="Снять"></button>' +
            '<button class="cam-flip" data-action="cam-flip" aria-label="Сменить камеру">' + ICONS.flip + '</button>' +
            '</div></div>' +
            '<div class="cam-flash" id="camFlash"></div>' +
            '</div>',
        after: () => {
            const flash = $('#camFlash');
            const shutter = $('#shutter');
            let shots = 0;

            if (shutter) shutter.addEventListener('click', () => {
                if (flash) {
                    flash.classList.remove('fire');
                    void flash.offsetWidth;
                    flash.classList.add('fire');
                }
                shots += 1;
                const g = $('#camGallery');
                if (g) g.textContent = String(shots);
            });

            const modes = $('#camModes');
            if (modes) modes.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-mode]');
                if (!btn) return;
                $$('#camModes .cam-mode').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                showToast('Режим: ' + btn.dataset.mode);
            });
        }
    });

    /* --- Настройки --- */
    SCREENS.settings = () => ({
        title: 'Настройки',
        html:
            '<div class="settings-group"><div class="settings-group-title">Сети</div><div class="card">' +
            '<div class="list-row" data-toggle="wifi">' + icon('wifi') +
            '<div class="row-main"><div class="row-title">Wi-Fi</div><div class="row-sub" data-sub>Вкл</div></div><span class="switch"></span></div>' +
            '<div class="list-row" data-toggle="bluetooth">' + icon('bluetooth') +
            '<div class="row-main"><div class="row-title">Bluetooth</div><div class="row-sub" data-sub>Выкл</div></div><span class="switch"></span></div>' +
            '<div class="list-row" data-nav="mobile">' + icon('cellular') +
            '<div class="row-main"><div class="row-title">Мобильная сеть</div><div class="row-sub">' + state.carrier + ' · ' + state.network + '</div></div>' + ICONS.chevron + '</div>' +
            '</div></div>' +

            '<div class="settings-group"><div class="settings-group-title">Устройство</div><div class="card">' +
            '<div class="list-row" data-nav="sound">' + icon('volume') +
            '<div class="row-main"><div class="row-title">Звук и вибрация</div><div class="row-sub">Звонок, медиа, будильник</div></div>' + ICONS.chevron + '</div>' +
            '</div></div>' +

            '<div class="settings-group"><div class="settings-group-title">Система</div><div class="card">' +
            '<div class="list-row" data-nav="developer-gate">' + icon('code') +
            '<div class="row-main"><div class="row-title">Режим разработчика</div><div class="row-sub">' + (state.devMode ? 'Включён · защищён PIN' : 'Отключён') + '</div></div>' + ICONS.chevron + '</div>' +
            '<div class="list-row" data-nav="about">' + icon('info') +
            '<div class="row-main"><div class="row-title">О телефоне</div><div class="row-sub">Redmi Note 10T · Android 15</div></div>' + ICONS.chevron + '</div>' +
            '</div></div>'
    });

    SCREENS.mobile = () => {
        const levels = ['Нет сигнала', 'Слабый', 'Средний', 'Хороший', 'Отличный'];
        const level = Math.max(0, Math.min(4, state.signalLevel || 0));
        const signalText = state.registered ? levels[level] : 'Нет сети';
        const signalValue = state.registered ? level + '/4' : '—';
        const simText = state.simState === 1
            ? 'SIM не установлена'
            : (state.registered ? 'SIM · ' + (state.network || 'сеть') : 'SIM · нет сети');

        return {
            title: 'Мобильная сеть',
            html:
                '<div class="card">' +
                '<div class="list-row">' + icon('cellular') +
                '<div class="row-main"><div class="row-title">Оператор</div><div class="row-sub">' + state.carrier + '</div></div><span class="row-value">' + (state.registered && state.network ? state.network : '—') + '</span></div>' +
                '<div class="list-row">' + icon('cellular') +
                '<div class="row-main"><div class="row-title">Уровень сигнала</div><div class="row-sub">' + signalText + '</div></div><span class="row-value">' + signalValue + '</span></div>' +
                '<div class="list-row">' + icon('cellular') +
                '<div class="row-main"><div class="row-title">Передача данных</div><div class="row-sub">' + (state.cellularConnected ? 'Мобильный интернет активен' : 'Мобильный интернет недоступен') + '</div></div><span class="row-value">' + (state.cellularConnected ? 'Активно' : '—') + '</span></div>' +
                '</div>' +
                '<div class="section-label">SIM</div>' +
                '<div class="card"><div class="list-row">' + icon('cellular') +
                '<div class="row-main"><div class="row-title">' + (state.simState === 1 ? 'SIM не установлена' : state.carrier) + '</div><div class="row-sub">' + simText + '</div></div></div></div>'
        };
    };

    SCREENS.battery = () => ({
        title: 'Батарея',
        html:
            '<div class="big-value" id="batteryBig">100%</div><div class="big-caption">Полный заряд · хватит на 1 д 8 ч</div>' +
            '<div class="card">' +
            '<div class="list-row">' + icon('battery') + '<div class="row-main"><div class="row-title">Экран</div><div class="row-sub">С момента последней зарядки</div></div><span class="row-value">32%</span></div>' +
            '<div class="list-row">' + icon('code') + '<div class="row-main"><div class="row-title">Система</div><div class="row-sub">Android и сервисы</div></div><span class="row-value">18%</span></div>' +
            '<div class="list-row">' + icon('chat') + '<div class="row-main"><div class="row-title">Приложения</div><div class="row-sub">MAX, Браузер, Камера</div></div><span class="row-value">12%</span></div>' +
            '</div>' +
            '<div class="section-label">Режим</div>' +
            '<div class="card"><div class="list-row" data-toggle="saver">' + icon('saver') +
            '<div class="row-main"><div class="row-title">Экономия заряда</div><div class="row-sub" data-sub>Выкл</div></div><span class="switch"></span></div></div>',
        after: () => {
            const pct = $('#batteryPct') ? $('#batteryPct').textContent : '100%';
            const big = $('#batteryBig');
            if (big) big.textContent = pct;
        }
    });

    SCREENS.sound = () => ({
        title: 'Звук и вибрация',
        html:
            '<div class="card">' +
            '<div class="slider-row"><div class="slider-head"><span>Медиа</span><span>70%</span></div><input type="range" min="0" max="100" value="70"></div>' +
            '<div class="slider-row"><div class="slider-head"><span>Звонок</span><span>80%</span></div><input type="range" min="0" max="100" value="80"></div>' +
            '<div class="slider-row"><div class="slider-head"><span>Будильник</span><span>60%</span></div><input type="range" min="0" max="100" value="60"></div>' +
            '</div>' +
            '<div class="section-label">Вибрация</div>' +
            '<div class="card"><div class="list-row"><div class="row-main"><div class="row-title">Вибрация при звонке</div><div class="row-sub">Короткая</div></div><span class="switch on"></span></div>' +
            '<div class="list-row"><div class="row-main"><div class="row-title">Вибрация при нажатии</div><div class="row-sub">Слабая</div></div><span class="switch on"></span></div></div>',
        after: () => {
            $$('.slider-row input[type="range"]').forEach((input) => {
                input.addEventListener('input', () => {
                    const head = input.parentElement.querySelector('.slider-head span:last-child');
                    if (head) head.textContent = input.value + '%';
                });
            });
        }
    });

    SCREENS.about = () => ({
        title: 'О телефоне',
        html:
            '<div class="about-hero"><div class="about-logo">' + ICONS.phone + '</div>' +
            '<div class="about-name">MAXA Launcher</div><div class="about-sub">Версия 1.0.0 · Redmi Note 10T</div></div>' +
            '<div class="card">' + ABOUT_ROWS.map((r) =>
                '<div class="list-row"><div class="row-main"><div class="row-title">' + r.title + '</div></div><span class="row-value">' + r.value + '</span></div>'
            ).join('') + '</div>'
    });

    /* --- PIN --- */
    SCREENS['developer-gate'] = () => {
        if (!state.devMode) {
            return {
                title: 'Режим разработчика',
                html:
                    '<div class="about-hero"><div class="pin-lock">' + ICONS.lock + '</div>' +
                    '<div class="pin-title">Режим разработчика отключён</div>' +
                    '<div class="pin-hint">Включите его в разделе «Система», чтобы получить доступ.</div></div>'
            };
        }
        return SCREENS.pin();
    };

    SCREENS.pin = () => {
        pinBuffer = '';
        clearTimeout(pinErrorTimer);
        return {
            title: 'Режим разработчика',
            html:
                '<div class="pin-wrap" id="pinWrap">' +
                '<div class="pin-lock">' + ICONS.lock + '</div>' +
                '<div class="pin-title">Введите PIN</div>' +
                '<div class="pin-hint">Для доступа к режиму разработчика</div>' +
                '<div class="pin-dots" id="pinDots">' + [0, 1, 2, 3].map(() => '<span class="pin-dot"></span>').join('') + '</div>' +
                '<div class="pin-error" id="pinError">Неверный PIN. Попробуйте ещё раз.</div>' +
                '<div class="keypad" id="keypad">' +
                [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => '<button class="key" data-key="' + n + '">' + n + '</button>').join('') +
                '<span class="key ghost" style="visibility:hidden"></span>' +
                '<button class="key" data-key="0">0</button>' +
                '<button class="key ghost" data-action="pin-cancel">Отмена</button>' +
                '</div></div>'
        };
    };

    SCREENS.developer = () => ({
        title: 'Для разработчиков',
        html:
            '<div class="dev-banner">' + ICONS.code + '<div><strong>Режим разработчика включён</strong>Не отключайте отладку без необходимости.</div></div>' +
            '<div class="card">' +
            devToggleRow('usb', 'Отладка по USB', 'Подключение к компьютеру', 'usb') +
            devToggleRow('mock', 'Макетные местоположения', 'Подмена координат', 'location') +
            devToggleRow('taps', 'Показывать нажатия', 'Визуальная отладка касаний', 'tap') +
            devToggleRow('awake', 'Не выключать экран', 'Пока подключён USB', 'awake') +
            '</div>' +
            '<div class="section-label">Системные</div>' +
            '<div class="card">' +
            '<div class="list-row" data-action="open-usb-install">' + icon('usb') +
            '<div class="row-main"><div class="row-title">Установка через USB</div><div class="row-sub">Разрешить установку APK по ADB</div></div>' + ICONS.chevron + '</div>' +
            '<div class="list-row" data-action="open-a11y-settings">' + icon('tap') +
            '<div class="row-main"><div class="row-title">Служба доступности</div><div class="row-sub">Специальные возможности → MAXA Launcher</div></div>' + ICONS.chevron + '</div>' +
            '<div class="list-row" data-action="open-keyboard">' + icon('settings') +
            '<div class="row-main"><div class="row-title">Клавиатура RU/EN</div><div class="row-sub">Выбрать Gboard и языки ввода</div></div>' + ICONS.chevron + '</div>' +
            '<div class="list-row" data-action="open-files">' + icon('grid') +
            '<div class="row-main"><div class="row-title">Мои файлы</div><div class="row-sub">Проводник и папки устройства</div></div>' + ICONS.chevron + '</div>' +
            '<div class="list-row" data-action="open-rustore">' + icon('settings') +
            '<div class="row-main"><div class="row-title">Открыть RuStore</div><div class="row-sub">Магазин приложений RuStore</div></div>' + ICONS.chevron + '</div>' +
            '</div>' +
            '<button class="danger-btn" data-action="disable-dev">Отключить режим разработчика</button>'
    });

    function devToggleRow(key, title, sub, iconName) {
        return '<div class="list-row" data-devtoggle="' + key + '">' + icon(iconName) +
            '<div class="row-main"><div class="row-title">' + title + '</div><div class="row-sub">' + sub + '</div></div>' +
            '<span class="switch' + (state.devToggles[key] ? ' on' : '') + '"></span></div>';
    }

    /* ------------------------------------------------------------
       Обработчики нажатий
       ------------------------------------------------------------ */

    document.addEventListener('click', (e) => {
        const qsSettings = e.target.closest('#qsSettings');
        if (qsSettings) {
            closeQS();
            openApp('settings');
            return;
        }

        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            toggleSetting(toggle.dataset.toggle);
            return;
        }

        const nav = e.target.closest('[data-nav]');
        if (nav) {
            const name = nav.dataset.nav;
            if (name === 'developer-gate') {
                pushScreen(state.devMode ? 'pin' : 'developer-gate');
            } else {
                pushScreen(name);
            }
            return;
        }

        const app = e.target.closest('[data-app]');
        if (app) {
            launchNativeApp(app.dataset.app);
            return;
        }

        const back = e.target.closest('#backBtn');
        if (back) {
            popScreen();
            return;
        }

        const key = e.target.closest('[data-key]');
        if (key && currentName() === 'pin') {
            addPinDigit(key.dataset.key);
            return;
        }

        const alarm = e.target.closest('[data-alarm]');
        if (alarm) {
            const i = Number(alarm.dataset.alarm);
            state.alarms[i].enabled = !state.alarms[i].enabled;
            save();
            alarm.classList.toggle('on', state.alarms[i].enabled);
            alarm.setAttribute('aria-checked', String(state.alarms[i].enabled));
            const row = alarm.closest('.alarm-row');
            const time = row && row.querySelector('.alarm-time');
            if (time) time.classList.toggle('off', !state.alarms[i].enabled);
            showToast('Будильник ' + state.alarms[i].time + ': ' + (state.alarms[i].enabled ? 'включён' : 'выключен'));
            return;
        }

        const preset = e.target.closest('[data-timer-preset]');
        if (preset) {
            state.timerRemaining = Number(preset.dataset.timerPreset) * 60;
            state.timerRunning = false;
            save();
            updateTimerDom();
            return;
        }

        const timerBtn = e.target.closest('[data-timer]');
        if (timerBtn) {
            if (timerBtn.dataset.timer === 'reset') {
                state.timerRemaining = 25 * 60;
                state.timerRunning = false;
            } else {
                state.timerRunning = !state.timerRunning;
                if (state.timerRunning && state.timerRemaining <= 0) state.timerRemaining = 25 * 60;
            }
            save();
            updateTimerDom();
            return;
        }

        const devToggle = e.target.closest('[data-devtoggle]');
        if (devToggle) {
            const k = devToggle.dataset.devtoggle;
            state.devToggles[k] = !state.devToggles[k];
            save();
            const sw = devToggle.querySelector('.switch');
            if (sw) sw.classList.toggle('on', state.devToggles[k]);
            return;
        }

        const action = e.target.closest('[data-action]');
        if (action) {
            handleAction(action.dataset.action, action);
            return;
        }

        const call = e.target.closest('[data-call]');
        if (call) {
            showToast('Звонок: ' + call.dataset.call);
            return;
        }

        const link = e.target.closest('[data-link]');
        if (link) {
            showToast('Открываю ' + link.dataset.link);
            return;
        }

        const tab = e.target.closest('[data-tab]');
        if (tab) {
            showToast('Вкладка: ' + tab.dataset.tab);
        }
    });

    function handleAction(action, el) {
        switch (action) {
            case 'nav-home':
                closeQS();
                hideScreen();
                break;
            case 'nav-back':
                if (qsOpen) closeQS();
                else if (stack.length) popScreen();
                break;
            case 'clear-all': {
                const kiosk = nativeKiosk();
                showToast('Закрываю открытые приложения…');
                if (kiosk) {
                    kiosk.killAll(function () {
                        showToast('Открытые приложения закрыты');
                    }, function () {
                        showToast('Не удалось закрыть приложения');
                    });
                }
                break;
            }
            case 'write-settings':
                promptWriteSettings(true);
                break;
            case 'exit-kiosk': {
                const kiosk = nativeKiosk();
                if (kiosk && typeof kiosk.exitKiosk === 'function') {
                    kiosk.exitKiosk(function () {
                        showToast('Режим киоска отключён');
                    }, function () {
                        showToast('Не удалось выйти из режима киоска');
                    });
                }
                break;
            }
            case 'open-usb-install': {
                const kiosk = nativeKiosk();
                if (kiosk && typeof kiosk.openDeveloperSettings === 'function') {
                    kiosk.openDeveloperSettings(function () {}, function () {
                        showToast('Не удалось открыть настройки разработчика');
                    });
                }
                break;
            }
            case 'open-a11y-settings': {
                const kiosk = nativeKiosk();
                if (kiosk && typeof kiosk.openAccessibilitySettings === 'function') {
                    kiosk.openAccessibilitySettings(function () {}, function () {
                        showToast('Не удалось открыть специальные возможности');
                    });
                }
                break;
            }
            case 'open-keyboard': {
                const kiosk = nativeKiosk();
                if (kiosk && typeof kiosk.openKeyboardSettings === 'function') {
                    kiosk.openKeyboardSettings(function () {}, function () {
                        showToast('Не удалось открыть настройки клавиатуры');
                    });
                }
                break;
            }
            case 'open-files': {
                const kiosk = nativeKiosk();
                if (kiosk && typeof kiosk.openFileManager === 'function') {
                    kiosk.openFileManager(function () {}, function () {
                        showToast('Не удалось открыть проводник');
                    });
                }
                break;
            }
            case 'open-rustore': {
                const kiosk = nativeKiosk();
                if (kiosk && typeof kiosk.openRuStore === 'function') {
                    kiosk.openRuStore(function () {}, function () {
                        showToast('RuStore не установлен');
                    });
                }
                break;
            }
            case 'back':
                popScreen();
                break;
            case 'pin-cancel':
                popScreen();
                break;
            case 'cam-flash':
                showToast('Вспышка: авто');
                break;
            case 'cam-timer':
                showToast('Таймер съёмки: 3 секунды');
                break;
            case 'cam-gallery':
                showToast('Галерея снимков');
                break;
            case 'cam-flip':
                state.frontCamera = !state.frontCamera;
                save();
                showToast(state.frontCamera ? 'Фронтальная камера' : 'Основная камера');
                break;
            case 'disable-dev':
                state.devMode = false;
                save();
                popScreen();
                renderScreen();
                showToast('Режим разработчика отключён');
                break;
            default:
                break;
        }
    }

    /* ------------------------------------------------------------
       PIN
       ------------------------------------------------------------ */

    function updatePinDots() {
        $$('#pinDots .pin-dot').forEach((dot, i) => {
            dot.classList.toggle('filled', i < pinBuffer.length);
        });
    }

    function addPinDigit(digit) {
        if (currentName() !== 'pin') return;
        if (pinBuffer.length >= 4) return;
        pinBuffer += digit;
        updatePinDots();
        if (pinBuffer.length === 4) {
            setTimeout(checkPin, 120);
        }
    }

    function checkPin() {
        if (currentName() !== 'pin') return;
        if (pinBuffer === '0234') {
            pinBuffer = '';
            stack[stack.length - 1] = 'developer';
            renderScreen();
            showToast('Доступ разрешён');
        } else {
            const wrap = $('#pinWrap');
            const err = $('#pinError');
            if (wrap) wrap.classList.add('shake');
            if (err) err.classList.add('show');
            pinErrorTimer = setTimeout(() => {
                pinBuffer = '';
                updatePinDots();
                if (wrap) wrap.classList.remove('shake');
                if (err) err.classList.remove('show');
            }, 480);
        }
    }

    document.addEventListener('keydown', (e) => {
        if (currentName() !== 'pin') return;
        if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            addPinDigit(e.key);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            popScreen();
        }
    });

    /* ------------------------------------------------------------
       Жесты
       ------------------------------------------------------------ */

    let edgeStartY = 0;
    let edgeStartX = 0;
    let edgeTracking = false;

    document.addEventListener('touchstart', (e) => {
        if (qsOpen) return;
        const t = e.touches[0];
        if (!t) return;
        if (t.clientY <= 60) {
            edgeStartY = t.clientY;
            edgeStartX = t.clientX;
            edgeTracking = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!edgeTracking || qsOpen) return;
        const t = e.touches[0];
        if (!t) return;
        const dy = t.clientY - edgeStartY;
        const dx = Math.abs(t.clientX - edgeStartX);
        if (dy > 70 && dx < 80) {
            edgeTracking = false;
            openQS();
        }
    }, { passive: true });

    document.addEventListener('touchend', () => { edgeTracking = false; }, { passive: true });

    let qsStartY = 0;
    function bindQsSwipe(el) {
        if (!el) return;
        el.addEventListener('touchstart', (e) => {
            qsStartY = e.touches[0] ? e.touches[0].clientY : 0;
        }, { passive: true });
        el.addEventListener('touchmove', (e) => {
            if (!e.touches[0]) return;
            if (qsStartY - e.touches[0].clientY > 60) closeQS();
        }, { passive: true });
    }
    bindQsSwipe($('#qsGrabber'));
    bindQsSwipe($('.qs-head'));

    const scrim = $('#qsScrim');
    if (scrim) scrim.addEventListener('click', closeQS);

    /* ------------------------------------------------------------
       Слайдер яркости
       ------------------------------------------------------------ */

    const brightness = $('#brightnessSlider');
    if (brightness) {
        brightness.addEventListener('input', () => {
            state.brightness = Number(brightness.value);
            applyBrightness();
            save();
            clearTimeout(brightnessTimer);
            brightnessTimer = setTimeout(() => setSystemBrightness(state.brightness), 60);
        });
        brightness.addEventListener('change', () => {
            setSystemBrightness(state.brightness);
        });
    }

    /* ------------------------------------------------------------
       Кнопка «Назад» Android
       ------------------------------------------------------------ */

    document.addEventListener('backbutton', (e) => {
        if (qsOpen) {
            closeQS();
            if (e && e.preventDefault) e.preventDefault();
            return;
        }
        if (stack.length) {
            popScreen();
            if (e && e.preventDefault) e.preventDefault();
            return;
        }
        // На главном экране кнопку «Назад» не перехватываем.
    }, false);

    /* ------------------------------------------------------------
       Инициализация
       ------------------------------------------------------------ */

    function init() {
        state.saver = true;
        tick();
        setInterval(tick, 1000);
        applyBrightness();
        updateToggles();
        applyStatus();

        $('#carrier').textContent = state.carrier;
        $('#network').textContent = state.network;

        const startNative = () => {
            refreshSystemState(function () {
                applySystemDefaults();
                if (!state.canWrite) {
                    promptWriteSettings(false);
                }
            });
        };

        if (window.cordova) {
            document.addEventListener('deviceready', startNative, false);
        } else {
            setTimeout(startNative, 0);
        }

        document.addEventListener('resume', function () {
            refreshSystemState(function () {
                applySystemDefaults();
            });
        }, false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
