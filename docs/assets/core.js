/* Shared code for the study page and the explorer: formatting, SVG charts, map helpers, page chrome.
   Nothing here holds a result; every value comes from docs/data/*.json. */
(function (G) {
    'use strict';
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const isNum = v => v !== null && v !== undefined && Number.isFinite(Number(v));
    const num = (v, d = 0) => {
        if (!isNum(v)) return '—';
        const r = Math.round(Number(v) * 10 ** d) / 10 ** d;
        return (r === 0 ? 0 : r).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−');
    };
    const signed = (v, d = 0) => (Math.round(v * 10 ** d) > 0 ? '+' : '') + num(v, d);
    const pct = (v, d = 0) => num(v * 100, d) + '%';
    const upct = u => signed((u - 1) * 100, 0) + '%';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const median = a => { const s = a.filter(isNum).map(Number).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
    const mean = a => { const s = a.filter(isNum).map(Number); return s.reduce((p, q) => p + q, 0) / s.length; };
    const listing = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const AREA = { niger_benue: 'Lower Niger–Benue', sokoto_rima: 'Sokoto–Rima' };
    const SCEN = { ssp245: 'SSP2-4.5', ssp585: 'SSP5-8.5' };
    const COL = { A: '#1f56b0', B: '#a86a16', C: '#5b4b8a', ssp245: '#2f6fd6', ssp585: '#c2410c', grey: '#9a9a93', ink: '#111' };
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); });

    // ---------- SVG ----------
    const NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; }
    function width(node, min = 300, max = 1120) { return Math.max(min, Math.min(max, Math.round(node.getBoundingClientRect().width || 720))); }
    function niceTicks(a, b, n = 5) {
        if (a === b) { a -= 1; b += 1; }
        const s0 = (b - a) / n, p = 10 ** Math.floor(Math.log10(s0)), st = [1, 2, 2.5, 5, 10].map(k => k * p).find(k => k >= s0);
        const out = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(Math.round(v / st) * st);
        return out;
    }
    function svgFrame(box, H, label) {
        const W = width(box);
        const s = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': label, class: 'chart-svg' });
        box.innerHTML = ''; box.append(s);
        return { s, W, H };
    }
    // y axis with grid; returns scale
    function yAxis(s, x0, x1, y0, y1, lo, hi, fmt = v => num(v, 0), n = 5, unit) {
        const y = v => y1 - (v - lo) / (hi - lo) * (y1 - y0);
        niceTicks(lo, hi, n).forEach(v => {
            if (v < lo - 1e-9 || v > hi + 1e-9) return;
            s.append(el('line', { x1: x0, x2: x1, y1: y(v), y2: y(v), class: v === 0 && lo < 0 ? 'ax0' : 'grid' }));
            s.append(el('text', { x: x0 - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, fmt(v)));
        });
        if (unit) s.append(el('text', { x: x0 - 8, y: y0 - 10, 'text-anchor': 'end', class: 'tick unit' }, unit));
        return y;
    }
    function path(pts) { return pts.filter(p => isNum(p[1])).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(''); }
    function band(lo, hi) { return path(lo) + hi.slice().reverse().map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + 'Z'; }
    function key(box, items) {
        box.innerHTML = items.map(([c, t, shape]) => `<li><i class="${shape || ''}" style="background:${c}"></i><span>${t}</span></li>`).join('');
    }

    // ---------- maps ----------
    const BASEMAPS = {
        canvas: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', 'Basemap © Esri'],
        satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Imagery © Esri'],
        topo: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', 'Basemap © Esri'],
    };
    function basemap(map, kind = 'canvas') {
        const [u, a] = BASEMAPS[kind];
        const t = L.tileLayer(u, { maxZoom: 13, attribution: a }); t.addTo(map); return t;
    }
    function cartography(map, step) {
        L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 130 }).addTo(map);
        const North = L.Control.extend({ options: { position: 'topright' }, onAdd() { const d = L.DomUtil.create('div', 'north-arrow'); d.setAttribute('aria-hidden', 'true'); d.innerHTML = '<svg width="20" height="30" viewBox="0 0 20 30"><text x="10" y="9" text-anchor="middle" font-size="10" font-weight="700">N</text><path d="M10 12 L15.5 28 L10 23.5 L4.5 28 Z" fill="#111"/></svg>'; return d; } });
        map.addControl(new North());
        const lines = L.layerGroup().addTo(map), labels = L.layerGroup().addTo(map);
        for (let la = -10; la <= 30; la += step) lines.addLayer(L.polyline([[la, -20], [la, 30]], { color: '#8a8a86', weight: .6, opacity: .5, dashArray: '2 4', interactive: false }));
        for (let lo = -20; lo <= 30; lo += step) lines.addLayer(L.polyline([[-10, lo], [30, lo]], { color: '#8a8a86', weight: .6, opacity: .5, dashArray: '2 4', interactive: false }));
        const lab = (ll, t, c) => labels.addLayer(L.marker(ll, { icon: L.divIcon({ className: 'grat ' + c, html: t, iconSize: null }), interactive: false, keyboard: false }));
        const deg = (v, p, n) => `${num(Math.abs(v), step < 1 ? 1 : 0)}°${v >= 0 ? p : n}`;
        const place = () => {
            labels.clearLayers(); const b = map.getBounds(), dy = (b.getNorth() - b.getSouth()) * .012, dx = (b.getEast() - b.getWest()) * .006;
            for (let la = Math.ceil(b.getSouth() / step) * step; la <= b.getNorth(); la += step) lab([la, b.getWest() + dx], deg(la, ' N', ' S'), 'lat');
            for (let lo = Math.ceil(b.getWest() / step) * step; lo <= b.getEast(); lo += step) lab([b.getSouth() + dy, lo], deg(lo, ' E', ' W'), 'lon');
        };
        map.on('moveend zoomend resize', place); place();
    }
    const classOf = (v, classes) => isNum(v) ? (classes.find(c => v >= c[0] && v < c[1]) || classes[classes.length - 1])[2] : 'transparent';
    function cellLayer(map, cells, values, classes, tip, onClick, selected, prev) {
        if (prev && prev._cells === cells && map.hasLayer(prev)) {
            let k = 0;
            prev.eachLayer(r => { const i = k++; r.setStyle({ color: i === selected ? '#111' : '#fff', weight: i === selected ? 2 : .4, fillColor: classOf(values[i], classes), fillOpacity: isNum(values[i]) ? .88 : 0 }); r.setTooltipContent(tip(values[i], i)); r._pick = onClick; });
            return prev;
        }
        if (prev) prev.remove();
        const g = L.layerGroup(cells.map(([lon, lat], i) => {
            const r = L.rectangle([[lat - .125, lon - .125], [lat + .125, lon + .125]], { className: 'cell', color: i === selected ? '#111' : '#fff', weight: i === selected ? 2 : .4, fillColor: classOf(values[i], classes), fillOpacity: isNum(values[i]) ? .88 : 0 });
            r.bindTooltip(tip(values[i], i), { sticky: true }); r._pick = onClick; r.on('click', () => r._pick && r._pick(i));
            return r;
        })).addTo(map);
        g._cells = cells; return g;
    }
    function legendHtml(title, sub, classes) {
        return `<div class="lg-t">${title}</div>${sub ? `<div class="lg-s">${sub}</div>` : ''}<ul class="lg-c">${classes.map(c => `<li><i style="background:${c[2]}"></i>${c[3]}</li>`).join('')}</ul>`;
    }
    function seqClasses(vals, ramp, unit, d = 0) {
        const ok = vals.filter(isNum).map(Number), lo = Math.min(...ok), hi = Math.max(...ok);
        const t = niceTicks(lo, hi, ramp.length), st = (t[1] - t[0]) || 1, start = Math.floor(lo / st) * st, out = [];
        for (let k = 0; start + k * st <= hi && k < 12; k++) out.push([start + k * st, start + (k + 1) * st, null, `${num(start + k * st, d)}–${num(start + (k + 1) * st, d)}${unit}`]);
        out.forEach((c, k) => { c[2] = ramp[Math.round(k * (ramp.length - 1) / Math.max(1, out.length - 1))]; });
        out[0][0] = -Infinity; out[out.length - 1][1] = Infinity;
        return out;
    }
    const RAMP = {
        blue: ['#eef4fd', '#c9dcf6', '#9cc0ee', '#6a9fe2', '#3f7dd2', '#2459ab', '#173b78'],
        ochre: ['#fdf6e9', '#f6dfb3', '#eec27c', '#dc9d48', '#bf7a24', '#965b14', '#6b400c'],
        violet: ['#f1effa', '#d9d4ef', '#bdb4e0', '#9d91cd', '#7d6fb8', '#5f519e', '#433779'],
    };
    const SPI_CLASSES = [[-Infinity, -2, '#7f2704', '≤ −2 extreme'], [-2, -1.5, '#c2410c', '−2 to −1.5 severe'], [-1.5, -1, '#f59e0b', '−1.5 to −1 moderate'], [-1, 1, '#e8e6e1', '−1 to 1 near normal'], [1, 1.5, '#9fc5e8', '1 to 1.5'], [1.5, 2, '#4a8fd1', '1.5 to 2'], [2, Infinity, '#1f56b0', '≥ 2 very wet']];
    const UP_CLASSES = [[-Infinity, .9, '#8c510a', '< 0.90'], [.9, 1, '#dfc27d', '0.90–1.00'], [1, 1.1, '#e8e6e1', '1.00–1.10'], [1.1, 1.2, '#c6dbef', '1.10–1.20'], [1.2, 1.3, '#9fc5e8', '1.20–1.30'], [1.3, 1.5, '#4a8fd1', '1.30–1.50'], [1.5, Infinity, '#1f56b0', '≥ 1.50']];
    const DRY_CLASSES = [[-Infinity, -4, '#1f56b0', '≤ −4 days (shorter)'], [-4, -2, '#4a8fd1', '−4 to −2'], [-2, -.5, '#9fc5e8', '−2 to −0.5'], [-.5, .5, '#e8e6e1', '−0.5 to +0.5'], [.5, 2, '#dfc27d', '+0.5 to +2'], [2, 4, '#bf812d', '+2 to +4'], [4, Infinity, '#8c510a', '≥ +4 days (longer)']];
    const R_CLASSES = [[-Infinity, 0, '#e8e6e1', 'below 0'], [0, .2, '#e5f0dd', '0–0.2'], [.2, .4, '#b9d8a6', '0.2–0.4'], [.4, .6, '#7fb76a', '0.4–0.6'], [.6, .8, '#3f8a3a', '0.6–0.8'], [.8, Infinity, '#1d5b22', '≥ 0.8']];
    const NDVI_A_CLASSES = [[-Infinity, -.06, '#8c510a', '≤ −0.06 browner'], [-.06, -.03, '#bf812d', '−0.06 to −0.03'], [-.03, -.01, '#dfc27d', '−0.03 to −0.01'], [-.01, .01, '#e8e6e1', '−0.01 to 0.01'], [.01, .03, '#b9d8a6', '0.01 to 0.03'], [.03, .06, '#7fb76a', '0.03 to 0.06'], [.06, Infinity, '#2e7d32', '≥ 0.06 greener']];

    // ---------- controls ----------
    function seg(node, options, current, onPick) {
        node.innerHTML = '';
        options.forEach(([val, label, disabled]) => {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.val = val; b.disabled = !!disabled;
            b.setAttribute('aria-pressed', String(val === current));
            b.addEventListener('click', () => { $$('button', node).forEach(x => x.setAttribute('aria-pressed', String(x === b))); onPick(val); });
            node.append(b);
        });
    }

    // ---------- chrome: header progress, current section, reveal, back to top ----------
    function chrome() {
        const links = $$('.toc a').filter(a => a.getAttribute('href').startsWith('#'));
        const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
        const bar = $('#progress'), top = $('#to-top');
        let queued = false, cur = null;
        const update = () => {
            queued = false;
            const max = document.documentElement.scrollHeight - innerHeight;
            if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
            if (top) top.hidden = scrollY < innerHeight * 1.5;
            let i = -1; targets.forEach((t, j) => { if (t && t.getBoundingClientRect().top <= innerHeight * .3) i = j; });
            if (i !== cur) { cur = i; links.forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
        };
        addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
        addEventListener('resize', update); update();
        if (top) top.addEventListener('click', () => { scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); const s = $('.site-id'); if (s) s.focus({ preventScroll: true }); });
        const items = $$('[data-reveal]');
        if (reduced || !('IntersectionObserver' in window)) { items.forEach(x => x.classList.add('in')); return; }
        document.documentElement.classList.add('js-reveal');
        const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
        items.forEach(x => io.observe(x));
    }
    function snack(msg) { const s = document.createElement('div'); s.className = 'snack'; s.setAttribute('role', 'status'); s.textContent = msg; document.body.append(s); setTimeout(() => s.remove(), 2200); }
    function copy(text, ok) { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => snack(ok), () => window.prompt('Copy:', text)); else window.prompt('Copy:', text); }

    // ---------- reactions and counts (public Abacus counter, live site only) ----------
    const COUNTER = 'https://abacus.jasoncameron.dev', NSP = 'oloyededavid-hydro-extremes-v1';
    const LIVE = location.hostname === 'oloyededavid.github.io' && !navigator.webdriver;
    const REACT = { 'Useful': 'useful', 'Interesting': 'interesting', 'Needs clarity': 'clarity' }, RSTORE = 'hx-reaction';
    const store = { get: (k, t = sessionStorage) => { try { return t.getItem(k); } catch (e) { return null; } }, set: (k, v, t = sessionStorage) => { try { t.setItem(k, v); } catch (e) {} } };
    const count = (op, k) => fetch(`${COUNTER}/${op}/${NSP}/${k}`).then(r => r.ok ? r.json() : (r.status === 404 ? { value: 0 } : Promise.reject(r.status))).then(j => Number(j.value) || 0);
    function reactions() {
        const status = $('#react-status'); if (!status) return;
        const show = (l, n) => { const e = $(`.react[data-react="${l}"] .rc`); if (e) e.textContent = n ? num(n) : ''; };
        let r = store.get(RSTORE, localStorage) || '';
        const mark = () => $$('.react').forEach(x => { x.setAttribute('aria-pressed', String(x.dataset.react === r)); x.classList.toggle('is-other', !!r && x.dataset.react !== r); });
        mark(); if (r) status.textContent = 'Thanks, your reaction is counted.';
        $$('.react').forEach(b => b.addEventListener('click', () => {
            if (r) { status.textContent = r === b.dataset.react ? 'Thanks, your reaction is counted.' : 'You have already reacted from this browser.'; return; }
            r = b.dataset.react; store.set(RSTORE, r, localStorage); mark(); status.textContent = 'Thank you! Counted.';
            const rc = $('.rc', b); rc.textContent = num((Number((rc.textContent || '0').replace(/,/g, '')) || 0) + 1); b.classList.add('pop');
            if (LIVE) count('hit', REACT[r]).then(n => show(r, n)).catch(() => {});
        }));
        if (!LIVE) return;
        const v = $('#views');
        if (v) { const seen = store.get('hx-viewed'); count(seen ? 'get' : 'hit', 'views').then(n => { if (!seen) store.set('hx-viewed', '1'); if (n) { v.textContent = `${num(n)} page views`; v.hidden = false; } }).catch(() => {}); }
        Object.entries(REACT).forEach(([l, k]) => count('get', k).then(n => show(l, n)).catch(() => {}));
    }

    G.HX = { $, $$, isNum, num, signed, pct, upct, esc, median, mean, listing, reduced, MON, MONTH, AREA, SCEN, COL, get, el, width, niceTicks, svgFrame, yAxis, path, band, key,
        basemap, cartography, classOf, cellLayer, legendHtml, seqClasses, RAMP, SPI_CLASSES, UP_CLASSES, DRY_CLASSES, R_CLASSES, NDVI_A_CLASSES, seg, chrome, snack, copy, reactions, BASEMAPS };
})(window);
