/*
 * EkSamadhan AI website chat (13 October 2026).
 *
 * A business adds one tag to its own website:
 *   <script src="https://<this app>/widget.js" data-key="wk_..." async></script>
 *
 * The chat box then appears in the corner. What a visitor writes becomes a conversation in the
 * business's inbox, answered by the AI from the business's own knowledge or by its staff, like
 * Messenger and Instagram. The server answers only when the page is on a website the business
 * listed (see WidgetService), so the same tag pasted anywhere else shows nothing.
 *
 * Two steps: the visitor gives a first and last name, and only then sees the message box.
 *
 * Plain JavaScript with no dependencies, drawn inside a shadow root so the website's styles
 * cannot reach it and its styles cannot reach the website.
 */
(function () {
    'use strict';

    var script = document.currentScript;
    if (!script || window.__eksamadhanChat) return;
    window.__eksamadhanChat = true;

    var KEY = script.getAttribute('data-key');
    if (!KEY) { console.warn('EkSamadhan chat: the script tag needs data-key.'); return; }
    var API = (script.getAttribute('data-api') || new URL(script.src, location.href).origin).replace(/\/+$/, '');
    var BASE = API + '/api/widget/' + encodeURIComponent(KEY);
    var STORE = 'eksamadhan-chat:' + KEY;
    var WAIT_FOR_REPLY_MS = 60000;

    // ----- Saved on this browser: the visitor code and their name -----
    function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
    function save() { try { localStorage.setItem(STORE, JSON.stringify(state.saved)); } catch (e) { /* private mode */ } }

    var state = {
        saved: load(),
        look: null,
        open: false,
        messages: [],      // as the server sent them, oldest first
        seen: {},          // ids already shown
        waitingSince: 0,   // when the visitor last sent, until an answer comes
        convId: null,      // the conversation shown; a new one (after staff resolve) clears the box
        ended: false,      // staff resolved it: the next message starts a new conversation
        unread: 0,
        timer: null,
        busy: false,
    };

    function request(method, path, body) {
        var headers = { 'Content-Type': 'application/json' };
        if (state.saved.visitor) headers['X-Visitor'] = state.saved.visitor;
        return fetch(BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, credentials: 'omit' })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (data) {
                    if (!r.ok) { var e = new Error(data.error || 'Could not reach the chat.'); e.status = r.status; throw e; }
                    return data;
                });
            });
    }

    // ----- Drawing -----
    var host = document.createElement('div');
    host.setAttribute('data-eksamadhan-chat', '');
    var root = host.attachShadow({ mode: 'open' });

    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        for (var k in attrs || {}) {
            if (k === 'text') node.textContent = attrs[k];
            else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), attrs[k]);
            else node.setAttribute(k, attrs[k]);
        }
        (children || []).forEach(function (c) { if (c) node.appendChild(c); });
        return node;
    }

    function svg(path, size) {
        var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 22); s.setAttribute('height', size || 22);
        s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
        s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
        s.innerHTML = path;
        return s;
    }
    var ICON_CHAT = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';
    var ICON_DOWN = '<path d="m6 9 6 6 6-6"/>';
    var ICON_CLOSE = '<path d="M18 6 6 18M6 6l12 12"/>';
    var ICON_SEND = '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>';
    var ICON_CLIP = '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>';
    var ICON_MIC = '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>';
    var ICON_STOP = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
    var ICON_TRASH = '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>';

    var CSS = [
        ':host{all:initial}',
        '[hidden]{display:none!important}',
        '*{box-sizing:border-box;margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Arial,sans-serif}',
        'button{font:inherit}',
        ':focus-visible{outline:3px solid color-mix(in srgb,var(--c) 45%,#fff);outline-offset:2px}',
        // The button in the corner: rounded square, not a pill; it turns into a chevron when open.
        '.launch{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:58px;height:58px;border:0;border-radius:18px;',
        '  background:var(--c);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 26px color-mix(in srgb,var(--c) 40%,transparent);transition:transform .15s ease}',
        '.launch:hover{transform:translateY(-2px)}',
        '.launch.on .ic-chat{display:none}.launch:not(.on) .ic-down{display:none}',
        '.dot{position:absolute;top:-6px;right:-6px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#e5484d;color:#fff;',
        '  font-size:12px;font-weight:700;display:grid;place-items:center;border:2px solid #fff}',
        // The panel: white card, big round corners, soft shadow.
        '.panel{position:fixed;right:20px;bottom:92px;z-index:2147483000;width:370px;height:600px;max-height:calc(100vh - 116px);',
        '  background:#fff;color:#1f2937;border-radius:22px;box-shadow:0 24px 64px rgba(15,23,42,.18),0 0 0 1px rgba(15,23,42,.05);',
        '  display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(12px) scale(.98);transform-origin:bottom right;',
        '  pointer-events:none;transition:opacity .2s ease,transform .2s ease}',
        '.panel.on{opacity:1;transform:none;pointer-events:auto}',
        // The header: brand colour with a wavy bottom edge, lighter waves behind it.
        '.head{position:relative;flex:none;padding:18px 16px 46px 18px;color:#fff;',
        '  background:linear-gradient(135deg,color-mix(in srgb,var(--c) 82%,#fff),var(--c))}',
        '.head .waves{position:absolute;left:0;right:0;bottom:-1px;width:100%;height:56px;display:block}',
        '.bar{position:relative;z-index:1;display:flex;align-items:center;gap:12px}',
        '.face{width:46px;height:46px;border-radius:50%;background:#fff;flex:none;display:grid;place-items:center;overflow:hidden;',
        '  box-shadow:0 0 0 3px rgba(255,255,255,.35)}',
        '.face img{width:100%;height:100%;object-fit:cover}',
        '.face b{font-size:19px;color:var(--c)}',
        '.title{flex:1;min-width:0}',
        '.title strong{display:block;font-size:17px;font-weight:650;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.title small{display:block;margin-top:3px;font-size:13px;opacity:.9}',
        '.x{width:38px;height:38px;border:0;border-radius:12px;background:rgba(255,255,255,.18);color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}',
        '.x:hover{background:rgba(255,255,255,.28)}',
        // Messages: a sender label over each run, grey bubbles for the shop, brand colour for the visitor.
        '.list{flex:1;overflow-y:auto;padding:6px 18px 14px;display:flex;flex-direction:column;gap:6px;background:#fff}',
        '.who{font-size:12.5px;color:#9ca3af;margin:14px 2px 2px}',
        '.who.you{text-align:right}',
        '.row{display:flex;max-width:100%}',
        '.row.you{justify-content:flex-end}',
        '.msg{max-width:80%;padding:11px 16px;border-radius:20px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}',
        '.them .msg{background:#f1f3f6;color:#1f2937}',
        '.you .msg{background:var(--c);color:#fff}',
        '.msg img{display:block;max-width:100%;border-radius:12px}',
        '.msg audio{display:block;max-width:220px}',
        '.typing{display:flex;gap:4px;padding:14px 16px;background:#f1f3f6;border-radius:20px}',
        '.typing i{width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:b 1s infinite ease-in-out}',
        '.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}',
        '@keyframes b{0%,80%,100%{opacity:.35;transform:none}40%{opacity:1;transform:translateY(-3px)}}',
        // Step one: the name form, in place of the message bar.
        '.card{background:#f7f8fa;border-radius:20px;padding:16px;display:grid;gap:12px;margin-top:14px}',
        '.card h2{font-size:15px;font-weight:650;color:#1f2937}',
        '.card p{font-size:13px;line-height:1.45;color:#6b7280;margin-top:-6px}',
        '.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
        'label{display:grid;gap:5px;font-size:12.5px;font-weight:600;color:#4b5563}',
        'input{width:100%;height:42px;padding:0 13px;border:1px solid #e5e7eb;border-radius:12px;font-size:14px;color:#1f2937;background:#fff}',
        'input:focus{outline:none;border-color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 16%,transparent)}',
        'input[aria-invalid=true]{border-color:#e5484d}',
        '.start{height:44px;border:0;border-radius:12px;background:var(--c);color:#fff;font-size:14.5px;font-weight:600;cursor:pointer}',
        '.start:hover{filter:brightness(1.07)}',
        '.err{font-size:12.5px;color:#c62a2f;margin-top:6px}',
        '.card .err{margin-top:-4px}',
        // Step two: a flat message bar under a thin line, like the reference.
        '.foot{flex:none;display:flex;align-items:flex-end;gap:8px;padding:10px 12px 12px 20px;border-top:1px solid #eef0f3;background:#fff}',
        '.foot .grow{flex:1;min-width:0}',
        'textarea{display:block;width:100%;min-height:40px;max-height:120px;resize:none;padding:10px 0;border:0;outline:none;font-size:14.5px;line-height:1.4;color:#1f2937;background:transparent}',
        'textarea::placeholder{color:#b6bcc6}',
        'textarea:focus-visible{outline:none}',
        '.send{width:40px;height:40px;border:0;border-radius:12px;background:transparent;color:#b6bcc6;cursor:pointer;display:grid;place-items:center;flex:none;transition:color .15s,background .15s}',
        '.send:not(:disabled){color:var(--c)}',
        '.send:not(:disabled):hover{background:color-mix(in srgb,var(--c) 10%,#fff)}',
        '.send:disabled{cursor:default}',
        '.tool{width:36px;height:40px;border:0;border-radius:10px;background:transparent;color:#9aa1ad;cursor:pointer;display:grid;place-items:center;flex:none}',
        '.tool:hover:not(:disabled){color:var(--c);background:color-mix(in srgb,var(--c) 8%,#fff)}',
        '.tool:disabled{opacity:.45;cursor:default}',
        '.tool.rec{color:#fff;background:#e5484d}',
        '.recbar{display:flex;align-items:center;gap:10px;height:40px;font-size:14px;color:#1f2937}',
        '.recbar i{width:9px;height:9px;border-radius:50%;background:#e5484d;animation:p 1s infinite ease-in-out}',
        '@keyframes p{50%{opacity:.3}}',
        '.status{font-size:12.5px;color:#6b7280;margin-top:6px}',
        '.ended{display:grid;gap:3px;text-align:center;margin:18px 6px 4px;padding:14px 12px 0;border-top:1px solid #eef0f3}',
        '.ended strong{font-size:13px;font-weight:600;color:#4b5563}',
        '.ended span{font-size:12.5px;color:#9ca3af}',
        '.msg.pic{padding:4px;background:transparent!important}',
        '.voice{display:flex;align-items:center;gap:10px;width:220px;max-width:100%}',
        '.vbtn{flex:none;width:34px;height:34px;border:0;border-radius:11px;cursor:pointer;display:grid;place-items:center;background:var(--c);color:#fff}',
        '.you .vbtn{background:#fff;color:var(--c)}',
        '.wave{flex:1;min-width:0;height:28px;display:flex;align-items:center;gap:2px;cursor:pointer}',
        '.wave i{flex:1;min-width:2px;border-radius:2px;background:currentColor;opacity:.28}',
        '.wave i.on{opacity:1}',
        '.them .wave i.on{background:var(--c)}',
        '.vtime{flex:none;min-width:30px;font-size:12px;opacity:.8;font-variant-numeric:tabular-nums}',
        '.msg.pic img{max-height:240px;cursor:zoom-in}',
        '.msg.pic + .cap{margin-top:4px}',
        '@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;height:100%;max-height:none;border-radius:0}.launch{right:16px;bottom:16px}.panel.on ~ .launch{display:none}}',
        '@media (prefers-reduced-motion:reduce){.panel,.launch{transition:none}.typing i{animation:none}}',
    ].join('\n');

    var ui = {};

    function face(look, cls) {
        var box = el('span', { class: cls });
        if (look.logo) box.appendChild(el('img', { src: look.logo, alt: '' }));
        else box.appendChild(el('b', { text: (look.name || '?').trim().charAt(0).toUpperCase() }));
        return box;
    }

    function build(look) {
        root.appendChild(el('style', { text: CSS }));
        host.style.setProperty('--c', look.color || '#2453c9');

        ui.dot = el('span', { class: 'dot', hidden: '' });
        var chatIcon = svg(ICON_CHAT, 26); chatIcon.setAttribute('class', 'ic-chat');
        var downIcon = svg(ICON_DOWN, 26); downIcon.setAttribute('class', 'ic-down');
        ui.launch = el('button', { class: 'launch', type: 'button', 'aria-label': 'Chat with ' + look.name, 'aria-expanded': 'false', onclick: toggle },
            [chatIcon, downIcon, ui.dot]);

        var title = el('span', { class: 'title' }, [el('strong', { text: look.name }), el('small', { text: 'Here to help' })]);
        var close = el('button', { class: 'x', type: 'button', 'aria-label': 'Close the chat', onclick: toggle }, [svg(ICON_CLOSE, 18)]);
        // The wavy bottom edge: two lighter waves behind, the white one in front meets the messages.
        var waves = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        waves.setAttribute('class', 'waves'); waves.setAttribute('viewBox', '0 0 370 56');
        waves.setAttribute('preserveAspectRatio', 'none'); waves.setAttribute('aria-hidden', 'true');
        waves.innerHTML =
            '<path d="M0 22 C60 4 120 40 190 24 S310 6 370 20 V56 H0Z" fill="#fff" fill-opacity=".14"/>' +
            '<path d="M0 34 C70 18 130 48 200 34 S320 20 370 30 V56 H0Z" fill="#fff" fill-opacity=".22"/>' +
            '<path d="M0 44 C80 30 150 58 220 44 S330 34 370 42 V56 H0Z" fill="#fff"/>';

        ui.list = el('div', { class: 'list', role: 'log', 'aria-live': 'polite' });

        // Step one: first and last name.
        ui.first = el('input', { type: 'text', maxlength: '30', autocomplete: 'given-name', required: '' });
        ui.last = el('input', { type: 'text', maxlength: '30', autocomplete: 'family-name', required: '' });
        ui.introError = el('p', { class: 'err', role: 'alert', hidden: '' });
        ui.startBtn = el('button', { class: 'start', type: 'submit', text: 'Start chat' });
        ui.intro = el('form', { class: 'card', novalidate: '', onsubmit: function (e) { e.preventDefault(); start(); } }, [
            el('h2', { text: 'Before we start' }),
            el('p', { text: 'Tell us your name so we know who we are talking to.' }),
            el('div', { class: 'pair' }, [
                el('label', {}, [document.createTextNode('First name'), ui.first]),
                el('label', {}, [document.createTextNode('Last name'), ui.last]),
            ]),
            ui.startBtn,
            ui.introError,
        ]);

        // Step two: the message box.
        ui.text = el('textarea', { rows: '1', maxlength: '1000', placeholder: 'Your message...', 'aria-label': 'Message' });
        ui.send = el('button', { class: 'send', type: 'submit', 'aria-label': 'Send', disabled: '' }, [svg(ICON_SEND, 18)]);
        ui.error = el('p', { class: 'err', role: 'alert', hidden: '' });
        // A photo from the device, or a voice note recorded here.
        ui.file = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/gif,image/webp', hidden: '' });
        ui.file.addEventListener('change', function () { if (ui.file.files[0]) upload(ui.file.files[0]); ui.file.value = ''; });
        ui.clip = el('button', { class: 'tool', type: 'button', 'aria-label': 'Send a photo', title: 'Send a photo', onclick: function () { ui.file.click(); } }, [svg(ICON_CLIP, 20)]);
        ui.mic = el('button', { class: 'tool', type: 'button', 'aria-label': 'Record a voice note', title: 'Record a voice note', onclick: toggleRecording }, [svg(ICON_MIC, 20)]);
        // Recording needs a secure page (https or localhost) and a browser that can record.
        if (!(window.isSecureContext && navigator.mediaDevices && window.MediaRecorder)) ui.mic.hidden = true;
        ui.recbar = el('div', { class: 'recbar', hidden: '' }, [el('i'), ui.recTime = el('span', { text: 'Recording 0:00' }),
            el('button', { class: 'tool', type: 'button', 'aria-label': 'Discard the recording', title: 'Discard', onclick: function () { stopRecording(false); } }, [svg(ICON_TRASH, 18)])]);
        ui.status = el('p', { class: 'status', role: 'status', hidden: '' });
        ui.foot = el('form', { class: 'foot', onsubmit: function (e) { e.preventDefault(); send(); } },
            [el('div', { class: 'grow' }, [ui.text, ui.recbar, ui.status, ui.error]), ui.file, ui.clip, ui.mic, ui.send]);
        // A photo pasted into the message box is sent like a chosen one.
        ui.text.addEventListener('paste', function (e) {
            var item = [].slice.call((e.clipboardData || {}).items || []).find(function (i) { return i.type.indexOf('image/') === 0; });
            if (item) { e.preventDefault(); upload(item.getAsFile()); }
        });

        ui.text.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
        ui.text.addEventListener('input', function () {
            ui.text.style.height = 'auto';
            ui.text.style.height = Math.min(ui.text.scrollHeight, 120) + 'px';
            ui.send.disabled = !ui.text.value.trim();
        });

        ui.panel = el('div', { class: 'panel', role: 'dialog', 'aria-label': 'Chat with ' + look.name },
            [el('div', { class: 'head' }, [el('div', { class: 'bar' }, [face(look, 'face'), title, close]), waves]), ui.list, ui.foot]);
        root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) toggle(); });

        root.appendChild(ui.panel);
        root.appendChild(ui.launch);
        document.body.appendChild(host);
        render();
    }

    function named() { return Boolean(state.saved.name); }

    function time(iso) {
        try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
    }

    function bubble(m) {
        var pic = m.attachmentType === 'image' && m.attachmentUrl && !m.text;
        var box = el('div', { class: 'msg' + (pic ? ' pic' : '') });
        if (m.attachmentType === 'image' && m.attachmentUrl) {
            var src = API + m.attachmentUrl;
            box.appendChild(el('img', { src: src, alt: 'Photo', onclick: function () { window.open(src, '_blank', 'noopener'); } }));
        } else if (m.attachmentType === 'audio' && m.attachmentUrl) {
            box.appendChild(voiceNote(API + m.attachmentUrl));
        }
        if (m.text) box.appendChild(document.createTextNode(m.text));
        return box;
    }

    function line(m) {
        var row = el('div', { class: 'row ' + (m.from === 'you' ? 'you' : 'them') });
        var b = bubble(m);
        if (m.at) b.title = time(m.at);
        row.appendChild(b);
        return row;
    }

    // ----- Voice notes as a waveform: the recording's own shape, filling in as it plays -----
    var ICON_PLAY = '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none"/>';
    var ICON_PAUSE = '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>';
    var BARS = 32;
    var shapes = {};   // url -> promise of { peaks, duration }, so a re-render does not fetch again
    var players = {};  // url -> the player, kept across re-renders so playback is not cut off

    function shapeOf(url) {
        if (!shapes[url]) {
            shapes[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(); return r.arrayBuffer(); })
                .then(function (data) {
                    var ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
                    return ctx.decodeAudioData(data);
                })
                .then(function (audio) {
                    var d = audio.getChannelData(0), size = Math.max(1, Math.floor(d.length / BARS)), peaks = [];
                    for (var i = 0; i < BARS; i++) {
                        var max = 0, end = Math.min(d.length, (i + 1) * size);
                        for (var j = i * size; j < end; j += 16) max = Math.max(max, Math.abs(d[j]));
                        peaks.push(max);
                    }
                    var top = Math.max.apply(null, peaks) || 1;
                    return { peaks: peaks.map(function (p) { return Math.max(0.08, p / top); }), duration: audio.duration };
                })
                .catch(function () { return { peaks: null, duration: 0 }; });
        }
        return shapes[url];
    }

    function clock(sec) {
        var s = Math.max(0, Math.round(sec || 0));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    function voiceNote(url) {
        if (players[url]) return players[url].node;
        var audio = new Audio(); audio.preload = 'metadata'; audio.src = url;
        var btn = el('button', { class: 'vbtn', type: 'button', 'aria-label': 'Play voice note' }, [svg(ICON_PLAY, 14)]);
        var wave = el('div', { class: 'wave' });
        var bars = [];
        for (var i = 0; i < BARS; i++) { var bar = el('i'); bar.style.height = '35%'; bars.push(bar); wave.appendChild(bar); }
        var label = el('span', { class: 'vtime', text: '0:00' });
        var node = el('div', { class: 'voice' }, [btn, wave, label]);
        var length = 0;
        function paint() {
            var at = audio.currentTime || 0, frac = length ? at / length : 0;
            bars.forEach(function (b, k) { b.classList.toggle('on', k / BARS < frac); });
            label.textContent = clock(!audio.paused || at ? at : length);
        }
        function icon(play) { btn.textContent = ''; btn.appendChild(svg(play ? ICON_PLAY : ICON_PAUSE, 14)); btn.setAttribute('aria-label', play ? 'Play voice note' : 'Pause voice note'); }
        btn.addEventListener('click', function () { if (audio.paused) audio.play().catch(function () {}); else audio.pause(); });
        wave.addEventListener('click', function (e) {
            if (!length) return;
            var box = wave.getBoundingClientRect();
            audio.currentTime = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * length;
            paint();
        });
        audio.addEventListener('loadedmetadata', function () { if (!length && isFinite(audio.duration)) { length = audio.duration; paint(); } });
        audio.addEventListener('timeupdate', paint);
        audio.addEventListener('play', function () { icon(false); });
        audio.addEventListener('pause', function () { icon(true); paint(); });
        audio.addEventListener('ended', function () { audio.currentTime = 0; icon(true); paint(); });
        shapeOf(url).then(function (s) {
            if (s.peaks) s.peaks.forEach(function (h, k) { bars[k].style.height = Math.round(h * 100) + '%'; });
            if (s.duration) { length = s.duration; paint(); }
        });
        players[url] = { node: node };
        return node;
    }

    /** Who a message is from, as the label over its run: "You", the staff member, or the shop. */
    function sender(m) {
        if (m.from === 'you') return 'You';
        if (m.from === 'staff' && m.author) return m.author;
        return state.look.name;
    }

    function render(toBottom) {
        if (!ui.list) return;
        // Stay where the visitor is: follow new messages only when they were already at the
        // bottom, or have just sent something. Every poll redraws, and always jumping down made
        // scrolling up to read an earlier message impossible.
        var list = ui.list;
        var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
        var keepTop = list.scrollTop;
        list.textContent = '';
        var greeting = { from: 'them', text: state.look.greeting };
        var all = [greeting].concat(state.messages);
        var lastLabel = null;
        all.forEach(function (m) {
            // A label over each run of messages from one sender; a staff member's name shows
            // the visitor that a person took over.
            var label = sender(m);
            if (label !== lastLabel) {
                ui.list.appendChild(el('div', { class: 'who ' + (m.from === 'you' ? 'you' : 'them'), text: label }));
                lastLabel = label;
            }
            ui.list.appendChild(line(m));
        });
        if (!named()) {
            ui.list.appendChild(ui.intro);
        } else if (state.ended) {
            ui.list.appendChild(el('div', { class: 'ended', role: 'status' }, [
                el('strong', { text: 'This conversation has ended' }),
                el('span', { text: 'Send a message to start a new one.' }),
            ]));
        } else if (waiting()) {
            if (lastLabel === 'You') ui.list.appendChild(el('div', { class: 'who them', text: state.look.name }));
            ui.list.appendChild(el('div', { class: 'row them' },
                [el('div', { class: 'typing', 'aria-label': 'Writing a reply' }, [el('i'), el('i'), el('i')])]));
        }
        ui.foot.hidden = !named();
        list.scrollTop = toBottom || atBottom ? list.scrollHeight : keepTop;
        ui.dot.textContent = String(state.unread);
        if (state.unread > 0 && !state.open) ui.dot.removeAttribute('hidden'); else ui.dot.setAttribute('hidden', '');
    }

    function waiting() {
        return state.waitingSince && Date.now() - state.waitingSince < WAIT_FOR_REPLY_MS;
    }

    function showError(node, text) {
        if (text) { node.textContent = text; node.removeAttribute('hidden'); }
        else node.setAttribute('hidden', '');
    }

    // ----- Talking to the server -----
    function take(lines) {
        var fresh = 0;
        (lines || []).forEach(function (m) {
            if (state.seen[m.id]) return;
            state.seen[m.id] = true;
            state.messages.push(m);
            if (m.from !== 'you') { fresh++; state.waitingSince = 0; }
        });
        if (fresh && !state.open) state.unread += fresh;
        return fresh;
    }

    function last() {
        return state.messages.length ? state.messages[state.messages.length - 1].at : null;
    }

    function poll() {
        if (!state.saved.visitor) return Promise.resolve();
        var after = last();
        return request('GET', '/messages' + (after ? '?after=' + encodeURIComponent(after) : ''))
            .then(function (data) {
                // A different conversation from the one on screen: start the box afresh with it.
                if (state.convId && data.conversationId && data.conversationId !== state.convId) {
                    state.convId = data.conversationId; state.messages = []; state.seen = {};
                    return poll();
                }
                if (data.conversationId) state.convId = data.conversationId;
                var wasEnded = state.ended;
                state.ended = Boolean(data.ended);
                if (state.ended) state.waitingSince = 0;
                if (take(data.messages) || wasEnded !== state.ended) render();
            })
            .catch(function (e) {
                // The code no longer matches (the chat box was set up again): start afresh, same name.
                if (e.status === 401) {
                    state.saved = { name: state.saved.name }; save();
                    state.messages = []; state.seen = {}; render();
                }
            });
    }

    function schedule() {
        clearTimeout(state.timer);
        if (!state.saved.visitor) return;
        var every = state.open || waiting() ? 2500 : 20000;
        state.timer = setTimeout(function () { poll().then(schedule); }, every);
    }

    function ensureVisitor() {
        if (state.saved.visitor) return Promise.resolve();
        return request('POST', '/visitors').then(function (v) {
            state.saved.visitor = v.visitorId + '.' + v.token;
            save();
        });
    }

    /** Step one done: both names given, so the message box appears. */
    function start() {
        var first = ui.first.value.trim();
        var lastName = ui.last.value.trim();
        ui.first.setAttribute('aria-invalid', String(!first));
        ui.last.setAttribute('aria-invalid', String(!lastName));
        if (!first || !lastName) {
            showError(ui.introError, !first && !lastName ? 'Please enter your first and last name.'
                : !first ? 'Please enter your first name.' : 'Please enter your last name.');
            (!first ? ui.first : ui.last).focus();
            return;
        }
        showError(ui.introError, '');
        state.saved.name = first + ' ' + lastName;
        save();
        render();
        setTimeout(function () { ui.text.focus(); }, 30);
    }

    /** The first message after staff resolved it opens a new conversation: clear the old one. */
    function freshIfEnded() {
        if (!state.ended) return;
        state.ended = false; state.convId = null; state.messages = []; state.seen = {};
    }

    function setStatus(text) {
        if (text) { ui.status.textContent = text; ui.status.removeAttribute('hidden'); }
        else ui.status.setAttribute('hidden', '');
    }

    /** Sends a photo or a recording; the server stores it and the AI reads it. */
    function upload(blob, filename) {
        if (!blob || state.busy || !named()) return;
        if (blob.size > 10 * 1024 * 1024) { showError(ui.error, 'That file is too large. Up to 10 MB.'); return; }
        var voice = blob.type.indexOf('image/') !== 0;
        state.busy = true; ui.clip.disabled = true; ui.mic.disabled = true; showError(ui.error, '');
        setStatus(voice ? 'Sending voice note...' : 'Sending photo...');
        ensureVisitor()
            .then(function () {
                var form = new FormData();
                form.append('file', blob, filename || blob.name || (voice ? 'voice.webm' : 'photo.jpg'));
                form.append('name', state.saved.name);
                return fetch(BASE + '/attachments', { method: 'POST', headers: { 'X-Visitor': state.saved.visitor }, body: form, credentials: 'omit' })
                    .then(function (r) {
                        return r.json().catch(function () { return {}; }).then(function (data) {
                            if (!r.ok) throw new Error(data.error || 'That could not be sent.');
                            return data;
                        });
                    });
            })
            .then(function (line) {
                freshIfEnded();
                take([line]);
                state.waitingSince = Date.now();
                render(true);
                schedule();
            })
            .catch(function (e) { showError(ui.error, e.message); })
            .then(function () { state.busy = false; ui.clip.disabled = false; ui.mic.disabled = false; setStatus(''); });
    }

    var rec = null;
    function toggleRecording() {
        if (rec) { stopRecording(true); return; }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            var chunks = [];
            var recorder = new MediaRecorder(stream);
            rec = { recorder: recorder, stream: stream, keep: true, started: Date.now() };
            recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
            recorder.onstop = function () {
                stream.getTracks().forEach(function (t) { t.stop(); });
                var keep = rec && rec.keep;
                clearInterval(rec && rec.tick);
                rec = null;
                recordingUi(false);
                if (keep && chunks.length) {
                    var type = chunks[0].type || 'audio/webm';
                    upload(new Blob(chunks, { type: type }), type.indexOf('mp4') > -1 ? 'voice.mp4' : 'voice.webm');
                }
            };
            recorder.start();
            rec.tick = setInterval(function () {
                var s = Math.floor((Date.now() - rec.started) / 1000);
                ui.recTime.textContent = 'Recording ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
                if (s >= 120) stopRecording(true);   // two minutes is a long voice note
            }, 250);
            recordingUi(true);
        }).catch(function () {
            showError(ui.error, 'Allow the microphone to send a voice note.');
        });
    }

    function stopRecording(keep) {
        if (!rec) return;
        rec.keep = keep;
        rec.recorder.stop();
    }

    function recordingUi(on) {
        ui.text.hidden = on;
        ui.recbar.hidden = !on;
        ui.clip.hidden = on;
        ui.send.hidden = on;
        ui.mic.classList.toggle('rec', on);
        ui.mic.setAttribute('aria-label', on ? 'Stop and send the voice note' : 'Record a voice note');
        ui.mic.title = on ? 'Stop and send' : 'Record a voice note';
        ui.mic.textContent = '';
        ui.mic.appendChild(svg(on ? ICON_STOP : ICON_MIC, on ? 16 : 20));
        if (on) ui.recTime.textContent = 'Recording 0:00';
    }

    function send() {
        var text = ui.text.value.trim();
        if (!text || state.busy || !named()) return;
        state.busy = true; ui.send.disabled = true; showError(ui.error, '');
        ensureVisitor()
            .then(function () { return request('POST', '/messages', { text: text, name: state.saved.name }); })
            .then(function (line) {
                ui.text.value = ''; ui.text.style.height = 'auto';
                freshIfEnded();
                take([line]);
                state.waitingSince = Date.now();
                render(true);
                schedule();
            })
            .catch(function (e) { showError(ui.error, e.message); })
            .then(function () { state.busy = false; ui.send.disabled = !ui.text.value.trim(); ui.text.focus(); });
    }

    function toggle() {
        state.open = !state.open;
        ui.panel.classList.toggle('on', state.open);
        ui.launch.classList.toggle('on', state.open);
        ui.launch.setAttribute('aria-expanded', String(state.open));
        if (state.open) {
            state.unread = 0;
            setTimeout(function () { (named() ? ui.text : ui.first).focus(); }, 60);
            poll().then(schedule);
        } else {
            ui.launch.focus();
            schedule();
        }
        render(state.open);   // opening shows the latest message
    }

    // ----- Start: only when the server says this website may use this chat box -----
    request('GET', '')
        .then(function (look) {
            state.look = look;
            var begin = function () {
                build(look);
                if (state.saved.visitor) poll().then(function () { state.unread = 0; render(true); schedule(); });
            };
            if (document.body) begin(); else document.addEventListener('DOMContentLoaded', begin);
        })
        .catch(function (e) {
            console.warn('EkSamadhan chat: ' + e.message);
        });
})();
