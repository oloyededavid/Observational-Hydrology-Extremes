/* Study page: fills every number, chart and map from docs/data/*.json. No result is typed in here. */
(function () {
    'use strict';
    const H = window.HX;
    const { $, $$, isNum, num, signed, pct, upct, median, mean, listing, MON, MONTH, AREA, SCEN, COL, el, svgFrame, yAxis, path, band, key, niceTicks, seg } = H;
    const D = {};
    const TS = [2, 5, 10, 25, 50, 100];            // reliability return periods
    const TR = ['2', '10', '25', '50', '100'];       // results return periods
    const C4 = { vh: '#1f56b0', dual: '#0f766e', change: '#c2410c', grey: '#9a9a93' };

    // ---------- small helpers ----------
    const setLen = p => { try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1); } catch (e) { /* not rendered */ } return p; };
    const lineP = (s, pts, attrs) => setLen(s.appendChild(el('path', Object.assign({ d: path(pts), fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'draw' }, attrs))));
    const fill = (k, v) => $$(`[data-v="${k}"]`).forEach(e => { e.innerHTML = v; });
    const share = v => pct(v, 0);
    const r10 = v => num(Math.round(v / 10) * 10);
    const r100 = v => num(Math.round(v / 100) * 100);
    const monthsText = ms => listing(ms.map(m => MONTH[m - 1]));
    function tip(box) {
        box.style.position = 'relative';
        const t = document.createElement('div'); t.className = 'ctip'; t.hidden = true; box.append(t);
        return {
            show(html, x, y) { t.innerHTML = html; t.hidden = false; const bw = box.clientWidth, tw = t.offsetWidth; t.style.left = Math.max(0, Math.min(bw - tw, x + 14)) + 'px'; t.style.top = Math.max(0, y - t.offsetHeight - 10) + 'px'; },
            hide() { t.hidden = true; },
        };
    }
    function whenNear(node, fn) {
        if (!node) return;
        if (!('IntersectionObserver' in window)) { fn(); return; }
        const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: '600px 0px' });
        io.observe(node);
    }
    const onResize = (node, fn) => { let w = node.clientWidth; new ResizeObserver(() => { if (Math.abs(node.clientWidth - w) > 4) { w = node.clientWidth; fn(); } }).observe(node); };
    function xLabels(s, W, H0, xs, labels, every = 1) { labels.forEach((t, i) => { if (i % every === 0) s.append(el('text', { x: xs(i), y: H0, 'text-anchor': 'middle', class: 'tick' }, t)); }); }
    function linreg(x, y) { const mx = mean(x), my = mean(y); let a = 0, b = 0; x.forEach((v, i) => { a += (v - mx) * (y[i] - my); b += (v - mx) ** 2; }); const sl = a / b; return { sl, ic: my - sl * mx }; }
    const detrend = (x, y) => { const { sl, ic } = linreg(x, y); return y.map((v, i) => v - (ic + sl * x[i])); };
    const zs = a => { const m = mean(a), sd = Math.sqrt(a.reduce((p, v) => p + (v - m) ** 2, 0) / (a.length - 1)); return a.map(v => (v - m) / sd); };
    const corr = (a, b) => { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; a.forEach((v, i) => { n += (v - ma) * (b[i] - mb); da += (v - ma) ** 2; db += (b[i] - mb) ** 2; }); return n / Math.sqrt(da * db); };

    // ---------- numbers in the text ----------
    function texts() {
        const A = D.a, B = D.b, C = D.c, R = C.results.areas, REL = C.reliability.areas;
        const mm = (rows, k, mo) => mean(rows.filter(r => r.month === mo).map(r => r[k]));
        const years = [...new Set(A.vh.monthly.map(r => r.year))];
        const peak = (rows, k) => years.map(y => { const r = rows.filter(q => q.year === y); return r.reduce((p, q) => q[k] > p[k] ? q : p).month; });
        const peaks = [...new Set([...peak(A.vh.monthly, 'flood_floodplain_km2'), ...peak(A.dualpol.monthly, 'dual_inside_km2'), ...peak(A.change.monthly, 'extension_km2')])].sort((a, b) => a - b);
        fill('aPeakMonths', monthsText(peaks)); fill('aPeakMonths2', monthsText(peaks));
        const dualPk = peak(A.dualpol.monthly, 'dual_km2'), dryPk = years.filter((y, i) => dualPk[i] < 6);
        fill('aDualDry', dryPk.length ? `, although across the whole reach it still peaked in the dry season in ${listing(dryPk.map(String))}` : '');
        fill('aPeakShort', peaks.map(m => MON[m - 1]).join('–'));
        const dw = A.dualpol.sentinel2_check.wet_2022_10_11, dd = A.dualpol.sentinel2_check.dry_2022_02;
        ['aWetPrec', 'aWetPrec2', 'aWetPrec3'].forEach(k => fill(k, share(dw.s1_confirmed_by_s2)));
        ['aDryPrec', 'aDryPrec2'].forEach(k => fill(k, share(dd.s1_confirmed_by_s2)));
        fill('aWetRec', share(dw.s2_found_by_s1));
        fill('aScenes', num(A.vh.monthly.reduce((p, r) => p + r.n_images, 0)));
        const base = Math.min(...[1, 2, 3, 4, 5].map(mo => mm(A.vh.monthly, 'flood_floodplain_km2', mo)));
        fill('aVhBase', r10(base)); fill('aVhOct', r10(mm(A.vh.monthly, 'flood_floodplain_km2', 10)));
        fill('aDualOct', r10(mm(A.dualpol.monthly, 'dual_km2', 10))); fill('aChgOct', r10(mm(A.change.monthly, 'extension_km2', 10)));
        const o = A.robustness.otsu_summary; fill('aOtsu', `a median of ${num(o.median_db, 1)} dB (monthly range ${num(o.min_db, 1)} to ${num(o.max_db, 1)} dB)`);
        const iou = mo => A.robustness.vv_vs_vh.filter(r => r.month === mo).map(r => r.agreement_iou);
        const rng = v => `${num(Math.min(...v), 2)}–${num(Math.max(...v), 2)}`;
        fill('aIouFeb', rng(iou(2))); fill('aIouOct', rng(iou(10)));
        const doms = Object.fromEntries(D.domains.features.map(f => [f.properties.id, f.properties]));
        fill('nbArea', r10(doms.niger_benue.area_km2)); fill('srArea', r100(doms.sokoto_rima.area_km2));
        fill('nbCells', num(D.cells.niger_benue.cells.length)); fill('srCells', num(D.cells.sokoto_rima.cells.length));

        const Dr = B.drought, rain = B.rain;
        fill('bWetShare', share(Dr.climatology.wet_season_share)); fill('bWetShare2', share(Dr.climatology.wet_season_share));
        fill('bMean', num(rain.mean_mm, 0)); fill('bCv', num(rain.cv * 100, 0)); fill('bTrend', num(rain.trend_mm_per_decade, 0));
        fill('bTau', num(rain.kendall_tau, 2)); fill('bTauP', num(rain.kendall_p, 3));
        const ev = Dr.events_basin['12'], longest = ev.reduce((p, q) => q.months > p.months ? q : p);
        fill('bEv12', num(ev.length)); fill('bMax12', num(longest.months)); fill('b80s', `${longest.months} months`);
        const [ly, lm] = longest.start.split('-').map(Number); fill('b80sStart', `${MONTH[lm - 1]} ${ly}`);
        const T = Dr.terraclimate;
        fill('bTcR', num(T.spi12_dec_corr.r, 2)); fill('bTcR2', num(T.spi12_dec_corr.r, 2)); fill('bTcAnn', num(T.annual_ppt_corr_with_chirps.r, 2));
        const both = T.drought_years_chirps.filter(y => T.drought_years_terraclimate.includes(y));
        fill('bBoth', listing(both.map(String)));
        fill('bChOnly', listing(T.drought_years_chirps.filter(y => !both.includes(y)).map(String)));
        fill('bTcOnly', listing(T.drought_years_terraclimate.filter(y => !both.includes(y)).map(String)));
        fill('bSoilYears', listing(T.soil_moisture_dry_years.map(String)));
        fill('bNdviDet', num(B.ndvi.detrended.pearson_r, 2)); fill('bNdviDet2', num(B.ndvi.detrended.pearson_r, 2)); fill('bNdviDiff', num(B.ndvi.differenced.pearson_r, 2));
        const P = D.bcells.ndvi_p_detrended.filter(isNum), sig = P.filter(p => p < 0.05).length / P.length;
        fill('bCellsSig', share(sig)); fill('bCellsSig2', share(sig));
        // previous year's rain against this year's greenness, both detrended
        const ny = Object.keys(B.ndvi.ndvi_growing_season).map(Number), rainBy = Object.fromEntries(rain.years.map(r => [r.year, r.rain_mm]));
        const yy = ny.filter(y => isNum(rainBy[y - 1])), nd = detrend(yy, yy.map(y => B.ndvi.ndvi_growing_season[y])), rp = detrend(yy, yy.map(y => rainBy[y - 1]));
        const rn = detrend(yy, yy.map(y => rainBy[y]));
        // remove this year's rain from both before testing last year's (partial correlation)
        const res = (y, x) => { const { sl, ic } = linreg(x, y); return y.map((v, i) => v - (ic + sl * x[i])); };
        fill('bLag', num(corr(res(nd, rn), res(rp, rn)), 2));

        const U = (a, s, t) => R[a].ensemble[s].uplift[t];
        fill('cHeadline', `${upct(U('niger_benue', 'ssp585', '50').models_median)} on the Lower Niger–Benue and ${upct(U('sokoto_rima', 'ssp585', '50').models_median)} in the Sokoto–Rima basin`);
        fill('cConcl', `${upct(U('niger_benue', 'ssp585', '50').models_median)} and ${upct(U('sokoto_rima', 'ssp585', '50').models_median)}`);
        fill('cNbUp', upct(U('niger_benue', 'ssp585', '50').models_median)); fill('cSrUp', upct(U('sokoto_rima', 'ssp585', '50').models_median));
        const nM = C.results.settings.models.length;
        fill('cNbAgree', `${U('niger_benue', 'ssp585', '50').models_above_1} of ${nM}`); fill('cSrAgree', `${U('sokoto_rima', 'ssp585', '50').models_above_1} of ${nM}`);
        fill('cNb245', upct(U('niger_benue', 'ssp245', '50').models_median)); fill('cNb585', upct(U('niger_benue', 'ssp585', '50').models_median));
        fill('cSr245', upct(U('sokoto_rima', 'ssp245', '50').models_median)); fill('cSr585', upct(U('sokoto_rima', 'ssp585', '50').models_median));
        const i50 = TS.indexOf(50), fam = a => REL[a].ensemble.ssp585.gev_family_weighted[i50];
        fill('cFam', `${upct(fam('niger_benue'))} and ${upct(fam('sokoto_rima'))}`);
        const E = (a, s) => R[a].ensemble[s];
        fill('cRxNb', upct(E('niger_benue', 'ssp585').rx1day_mean_ratio.models_median)); fill('cRxSr', upct(E('sokoto_rima', 'ssp585').rx1day_mean_ratio.models_median));
        fill('cTotNb', upct(E('niger_benue', 'ssp585').total_ratio.models_median)); fill('cTotSr', upct(E('sokoto_rima', 'ssp585').total_ratio.models_median));
        const dc = a => REL[a].decomposition['50'];
        const sh = v => share(v);
        fill('cSampNb', sh(dc('niger_benue').sampling)); fill('cSampSr', sh(dc('sokoto_rima').sampling));
        fill('cModNb', sh(dc('niger_benue').model)); fill('cModSr', sh(dc('sokoto_rima').model));
        const s1 = [dc('niger_benue').sampling, dc('sokoto_rima').sampling].map(v => Math.round(v * 100)).sort((a, b) => a - b);
        fill('cSampShare', `${s1[0]}–${s1[1]}%`);
        const perf = a => Object.values(REL[a].performance);
        fill('cSeason', num(median([...perf('niger_benue'), ...perf('sokoto_rima')].map(p => p.season_r)), 2));
        fill('cNbBias', num(median(perf('niger_benue').map(p => p.rl25_ratio)), 2)); fill('cSrBias', num(median(perf('sokoto_rima').map(p => p.rl25_ratio)), 2));
        fill('cGauge', num(median(Object.values(R.sokoto_rima.models).flatMap(m => Object.values(m.gauge_check || {}).map(g => g.rl25_ratio))), 2));
        const gaugeRx = Object.values(C.gauges).flatMap(g => Object.values(g.rx1day));
        fill('cGaugeMm', num(median(gaugeRx), 0)); fill('cChirpsMm', num(R.sokoto_rima.chirps.return_levels['2'].median_cells, 0));
        const bl = REL.niger_benue.baseline; fill('cBaseNb', upct(bl['1995-2024']['50'] / bl['1985-2014']['50']));
        const dry = s => R.sokoto_rima.ensemble[s];
        const dr = (s, k) => (dry(s)[k] || {}).models_median;
        fill('cDry50', signed(dr('ssp585', 'dry50'), 1)); fill('cDry90', signed(dr('ssp585', 'dry90'), 1));
        fill('cDryBias', signed(median(perf('sokoto_rima').map(p => p.dry_median_diff)), 0));
    }

    // ---------- Plate 1: framework ----------
    function framework() {
        const box = $('#framework-diagram');
        const rows = [
            ['A', 'var(--A)', 'Floods', 'Sentinel-1 radar, 2018–2023', 'Water thresholds, dual polarisation, change detection', 'Sentinel-2 optical water, 2022', 'When and how far the reach floods'],
            ['B', 'var(--B)', 'Drought', 'CHIRPS rainfall 1981–2024; MODIS NDVI', 'SPI-3/6/12, run theory, detrended correlation', 'TerraClimate rainfall and soil moisture', 'Drought history and vegetation response'],
            ['C', 'var(--C)', 'Future rainfall', 'NEX-GDDP-CMIP6, 23 models; CHIRPS', 'GEV by L-moments, uplift factors, bootstrap', 'Two GHCN gauges; null test; Gumbel; model families', 'Design rainfall for 2041–2070, with its uncertainty'],
        ];
        const head = ['', 'Record', 'Method', 'Independent check', 'Use'];
        box.innerHTML = `<div class="fw" role="table" aria-label="Research framework">
            <div class="fw-row fw-head" role="row">${head.map(h => `<div role="columnheader">${h}</div>`).join('')}</div>
            ${rows.map((r, i) => `<div class="fw-row" role="row" style="--accent:${r[1]};--d:${i * 0.12}s">
                <div class="fw-part" role="rowheader"><span class="fw-badge">${r[0]}</span>${r[2]}</div>
                ${r.slice(3).map((c, j) => `<div class="fw-cell fade${j === 2 ? ' fw-check' : ''}" role="cell" style="transition-delay:calc(var(--d) + ${j * 0.08}s)">${c}</div>`).join('')}</div>`).join('')}
            <div class="fw-foot fade" style="transition-delay:.6s">One question: how far can open satellite and model evidence stand in for missing gauges?</div></div>`;
    }

    // ---------- maps ----------
    const BOX = () => { const b = D.a.vh.settings.box; return [[b[1], b[0]], [b[3], b[2]]]; };
    function newMap(id, opts = {}) {
        const map = L.map(id, Object.assign({ scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true }, opts));
        return map;
    }
    function hero() {
        const map = newMap('hero-map', { zoomControl: false, dragging: !L.Browser.mobile, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false });
        map.fitBounds(BOX(), { padding: [6, 6] });
        H.basemap(map, 'satellite');
        L.imageOverlay('data/part_a/dual_frequency.png', BOX(), { className: 'px', interactive: false, alt: 'Sentinel-1 water extent on the Lower Niger–Benue reach' }).addTo(map);
        L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 120 }).addTo(map);
        onResize($('#hero-map'), () => { map.invalidateSize(); map.fitBounds(BOX(), { padding: [6, 6] }); });
    }
    function studyMap() {
        const map = newMap('study-map');
        map.fitBounds([[4.2, 2.6], [16.6, 14.7]]);
        H.basemap(map, 'canvas'); H.cartography(map, 2);
        const col = { sokoto_rima: COL.B, niger_benue: COL.A };
        L.geoJSON(D.domains, { style: f => ({ color: col[f.properties.id], weight: 2, fillOpacity: 0.06, fillColor: col[f.properties.id] }), interactive: false }).addTo(map);
        ['niger_benue', 'sokoto_rima'].forEach(a => {
            D.cells[a].cells.forEach(([lo, la]) => L.rectangle([[la - .125, lo - .125], [la + .125, lo + .125]], { color: col[a], weight: .5, opacity: .45, fill: false, interactive: false }).addTo(map));
        });
        const lab = (ll, t, cls, dir = 'right') => L.marker(ll, { opacity: 0, keyboard: false, interactive: false, icon: L.divIcon({ className: '', iconSize: [0, 0] }) }).addTo(map).bindTooltip(t, { permanent: true, direction: dir, className: 'map-label ' + cls, offset: [6, 0] });
        lab([15.9, 9.9], 'Sokoto–Rima basin', 'area');
        lab([7.0, 7.45], 'Lower Niger–Benue reach', 'area');
        Object.values(D.c.gauges).forEach(g => {
            L.marker([g.lat, g.lon], { icon: L.divIcon({ className: 'gauge-dot', iconSize: [10, 10] }), keyboard: false }).addTo(map).bindTooltip(`${g.name} rain gauge (GHCN-Daily, ${Math.min(...Object.keys(g.rx1day).map(Number))}–${Math.max(...Object.keys(g.rx1day).map(Number))})`, { direction: 'top' });
        });
        [[7.80, 6.74, 'Lokoja'], [13.06, 5.24, 'Sokoto'], [9.06, 7.49, 'Abuja'], [6.13, 6.79, 'Onitsha']].forEach(([la, lo, n]) => {
            L.circleMarker([la, lo], { radius: 2.5, color: '#111', weight: 1, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(map);
            lab([la, lo], n, 'town');
        });
        onResize($('#study-map'), () => map.invalidateSize());
    }

    // Plate A·2
    function floodMap() {
        const bounds = BOX(), map = newMap('flood-map');
        map.fitBounds(bounds, { padding: [8, 8] });
        let tiles = H.basemap(map, 'canvas'); H.cartography(map, 0.5);
        L.rectangle(bounds, { color: '#111', weight: 1.1, fill: false, interactive: false }).addTo(map);
        const plain = L.imageOverlay('data/part_a/floodplain.png', bounds, { className: 'px', interactive: false });
        const FREQ = [[0, 0, '#deebf7', '1–10% of images'], [0, 0, '#9ecae1', '10–25%'], [0, 0, '#4292c6', '25–50%'], [0, 0, '#08519c', '50–75%'], [0, 0, '#08306b', '75–100%']];
        const FP = [0, 0, 'rgba(120,120,112,0.35)', 'Floodplain (JRC, 1984–2020)'];
        const WATER = [[0, 0, '#1f56b0', 'Water'], [0, 0, '#111', 'Permanent water (JRC ≥ 90%)'], FP];
        const L_ = {
            dual: ['data/part_a/dual_frequency.png', 'How often water, Aug–Nov', 'Share of images, 2018–2023, VH < −17.8 and VV < −12.7 dB', FREQ, false],
            feb: ['data/part_a/dual_water_2022-02.png', 'Water, February 2022 (dry)', 'Median image, both polarisations', WATER, true],
            oct: ['data/part_a/dual_water_2022-10.png', 'Water, October 2022 (flood)', 'Median image, both polarisations', WATER, true],
            ext: ['data/part_a/flood_extension_2022-10.png', 'Flood extension, October 2022', 'Water in October not seen in February–March 2022', [[0, 0, '#1f56b0', 'New water: flood extension'], [0, 0, 'rgba(120,120,112,0.65)', 'Water in both seasons'], FP], true],
            vh: ['data/part_a/frequency.png', 'How often water, Aug–Nov (VH only)', 'Share of images, 2018–2023, VH < −18 dB; includes dark dry ground', FREQ, false],
            cov: ['data/part_a/coverage.png', 'Wet-season images per cell', `Aug–Nov 2018–2023; median ${num(D.a.robustness.coverage.median)}`, [[0, 0, '#ededE9', 'under 70'], [0, 0, '#c7c7c0', '70–120'], [0, 0, '#96968d', '120–180'], [0, 0, '#5c5c55', '180 or more']], false],
        };
        let cur = 'dual', ov = null;
        const draw = () => {
            const [u, t, sub, cls, withPlain] = L_[cur];
            const next = L.imageOverlay(u, bounds, { className: 'px', interactive: false, opacity: 0 }).addTo(map);
            const old = ov; ov = next;
            next.on('load', () => { if (ov !== next) return; next.setOpacity(1); if (old) setTimeout(() => old.remove(), 300); $('#fm-legend').innerHTML = H.legendHtml(t, sub, cls); });
            next.on('error', () => { next.remove(); if (ov === next) ov = null; });
            if (withPlain) plain.addTo(map); else plain.remove();
        };
        seg($('#fm-layer'), [['dual', 'Flood frequency'], ['feb', 'Feb 2022'], ['oct', 'Oct 2022'], ['ext', 'Flood extension'], ['vh', 'VH only'], ['cov', 'Coverage']], cur, v => { cur = v; draw(); });
        const bm = document.createElement('div'); bm.className = 'seg'; bm.setAttribute('role', 'group'); bm.setAttribute('aria-label', 'Basemap'); $('#fm-layer').after(bm);
        seg(bm, [['canvas', 'Map'], ['satellite', 'Satellite']], 'canvas', v => { tiles.remove(); tiles = H.basemap(map, v); tiles.bringToBack(); });
        draw();
        onResize($('#flood-map'), () => map.invalidateSize());
    }

    // ---------- Part A charts ----------
    const FC = { year: 'all' };
    function floodCurve() {
        const box = $('#floodchart'), A = D.a, years = [...new Set(A.vh.monthly.map(r => r.year))];
        const { s, W } = svgFrame(box, 340, 'Monthly flood area by three methods'), m = { l: 54, r: 16, t: 26, b: 34 }, Hh = 340;
        const pick = rows => FC.year === 'all' ? rows : rows.filter(r => r.year === +FC.year);
        const avg = (rows, k, mo) => mean(pick(rows).filter(r => r.month === mo).map(r => r[k]));
        const S = [
            ['VH inside the floodplain', C4.vh, A.vh.monthly, 'flood_floodplain_km2', ''],
            ['Both polarisations, whole reach', C4.dual, A.dualpol.monthly, 'dual_km2', ''],
            ['Change detection (flood extension)', C4.change, A.change.monthly, 'extension_km2', ''],
            ['VH: dark ground outside the floodplain', C4.grey, A.vh.monthly, 'dark_outside_floodplain_km2', '5 4'],
        ];
        const vals = S.map(z => MON.map((_, i) => avg(z[2], z[3], i + 1)));
        const hi = niceTicks(0, Math.max(...A.vh.monthly.map(r => r.dark_outside_floodplain_km2), ...A.dualpol.monthly.map(r => r.dual_km2)) * 1.02, 5).slice(-1)[0];
        const x = i => m.l + (i + 0.5) / 12 * (W - m.l - m.r);
        const y = yAxis(s, m.l, W - m.r, m.t, Hh - m.b, 0, hi, v => num(v), 5, 'km²');
        xLabels(s, W, Hh - 12, x, MON.map(n => W < 560 ? n[0] : n));
        if (FC.year === 'all') {
            const lo = MON.map((_, i) => Math.min(...A.vh.monthly.filter(r => r.month === i + 1).map(r => r.flood_floodplain_km2)));
            const up = MON.map((_, i) => Math.max(...A.vh.monthly.filter(r => r.month === i + 1).map(r => r.flood_floodplain_km2)));
            s.append(el('path', { d: band(lo.map((v, i) => [x(i), y(v)]), up.map((v, i) => [x(i), y(v)])), fill: C4.vh, 'fill-opacity': .12, class: 'fade' }));
        }
        S.forEach((z, k) => lineP(s, vals[k].map((v, i) => [x(i), y(v)]), { stroke: z[1], 'stroke-dasharray': z[4] || null, class: z[4] ? 'fade' : 'draw' }));
        S.slice(0, 3).forEach((z, k) => vals[k].forEach((v, i) => s.append(el('circle', { cx: x(i), cy: y(v), r: 3, fill: z[1], stroke: 'var(--panel)', 'stroke-width': 1.5, class: 'fade' }))));
        const cross = el('line', { y1: m.t, y2: Hh - m.b, class: 'ref', opacity: 0 }); s.append(cross);
        const tp = tip(box), hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Hh - m.t - m.b, fill: 'transparent' }); s.append(hit);
        hit.addEventListener('mousemove', e => {
            const bx = s.getBoundingClientRect(), px = (e.clientX - bx.left) * W / bx.width, i = Math.max(0, Math.min(11, Math.floor((px - m.l) / ((W - m.l - m.r) / 12))));
            cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1);
            tp.show(`<b>${MONTH[i]}${FC.year === 'all' ? ', mean 2018–2023' : ' ' + FC.year}</b>${S.map((z, k) => `<div><i style="background:${z[1]}"></i>${z[0]}: ${num(vals[k][i], 0)} km²</div>`).join('')}`, x(i), m.t + 30);
        });
        hit.addEventListener('mouseleave', () => { tp.hide(); cross.setAttribute('opacity', 0); });
        key($('#fc-key'), S.map(z => [z[1], z[0], z[4] ? 'dash' : 'line']).concat(FC.year === 'all' ? [[C4.vh + '33', 'VH floodplain, range of years']] : []));
        $('#fc-key li:nth-child(4) i').style.color = C4.grey;
        if (!$('#fc-year').childElementCount) seg($('#fc-year'), [['all', 'Mean 2018–2023'], ...years.map(y => [String(y), String(y)])], 'all', v => { FC.year = v; floodCurve(); });
    }

    function s2Chart() {
        const box = $('#s2chart'), A = D.a, R = A.robustness.sentinel2_check, Dp = A.dualpol.sentinel2_check, Ch = A.change.sentinel2_check_2022;
        const rows = [
            ['VH, −18 dB', R.dry_2022_02.minus18, R.wet_2022_10_11.minus18],
            ['VH, Otsu', R.dry_2022_02.otsu, R.wet_2022_10_11.otsu],
            ['Both polarisations', Dp.dry_2022_02, Dp.wet_2022_10_11],
            ['Change detection', null, Ch],
        ];
        const narrow = box.clientWidth < 640;
        const Hh = narrow ? 470 : 250, { s, W } = svgFrame(box, Hh, 'Share of radar water confirmed by Sentinel-2, and share of Sentinel-2 water found by radar');
        const groups = [['February 2022 · dry season', 1], ['Late Oct–Nov 2022 · flood', 2]];
        const lw = narrow ? 120 : 132, gw = narrow ? W - lw - 10 : (W - lw - 40) / 2, rowH = 44;
        groups.forEach(([g, gi], k) => {
            const ox = narrow ? lw : lw + k * (gw + 40), oy = narrow ? 26 + k * (rows.length * rowH + 44) : 26;
            const xs = v => ox + v * gw;
            s.append(el('text', { x: ox, y: oy - 10, class: 'lab', 'font-weight': 700 }, g));
            [0, .5, 1].forEach(v => { s.append(el('line', { x1: xs(v), x2: xs(v), y1: oy, y2: oy + rows.length * rowH, class: v ? 'grid' : 'ax0' })); s.append(el('text', { x: xs(v), y: oy + rows.length * rowH + 14, 'text-anchor': v === 0 ? 'start' : v === 1 ? 'end' : 'middle', class: 'tick' }, pct(v))); });
            rows.forEach(([n, ...ck], r) => {
                const c = ck[gi - 1], y0 = oy + r * rowH + 6;
                if (k === 0 || narrow) s.append(el('text', { x: lw - 10, y: y0 + 15, 'text-anchor': 'end', class: 'lab' }, n));
                if (!c) { s.append(el('text', { x: ox + 4, y: y0 + 15, class: 'sub' }, 'needs a dry-season reference')); return; }
                [['s1_confirmed_by_s2', COL.A, 'precision'], ['s2_found_by_s1', '#9cc0ee', 'recall']].forEach(([f, col, lbl], q) => {
                    const v = c[f], yy = y0 + q * 15;
                    const b = el('rect', { x: ox, y: yy, width: Math.max(1, xs(v) - ox), height: 12, rx: 2, fill: col, class: 'grow' }); s.append(b);
                    s.append(el('text', { x: xs(v) + 5, y: yy + 10, class: 'tick' }, pct(v)));
                    b.append(el('title', {}, `${n}, ${g}: ${lbl} ${pct(v)}`));
                });
            });
        });
        key($('#s2-key'), [[COL.A, 'Precision: radar water that Sentinel-2 confirms'], ['#9cc0ee', 'Recall: Sentinel-2 water that the radar finds']]);
    }

    const XS = { i: 1 };
    function sections() {
        const box = $('#xschart'), S = D.a.robustness.sections, z = S[XS.i];
        const Hh = 380, { s, W } = svgFrame(box, Hh, `Cross-section at ${z.lat}° N: elevation and flood frequency`), m = { l: 54, r: 16, t: 22, b: 40 };
        const split = m.t + 190, gap = 34;
        const lo = Math.min(...z.lon), hiL = Math.max(...z.lon), x = v => m.l + (v - lo) / (hiL - lo) * (W - m.l - m.r);
        const el0 = Math.floor(Math.min(...z.elev_m) / 10) * 10, el1 = Math.ceil(Math.max(...z.elev_m) / 10) * 10;
        // floodplain shading
        let st = null; z.plain.concat([false]).forEach((p, i) => { if (p && st === null) st = i; if (!p && st !== null) { s.append(el('rect', { x: x(z.lon[st]), y: m.t, width: x(z.lon[i - 1]) - x(z.lon[st]), height: Hh - m.b - m.t, fill: 'rgba(120,120,112,0.13)' })); st = null; } });
        const ye = yAxis(s, m.l, W - m.r, m.t, split, el0, el1, v => num(v), 4, 'm');
        const pts = z.lon.map((v, i) => [x(v), ye(z.elev_m[i])]);
        s.append(el('path', { d: path(pts) + `L${x(hiL)},${split}L${x(lo)},${split}Z`, fill: '#d6d3cc', class: 'fade' }));
        lineP(s, pts, { stroke: '#6b6760', 'stroke-width': 1.4 });
        const yf = yAxis(s, m.l, W - m.r, split + gap, Hh - m.b, 0, 100, v => num(v), 2, '%');
        const bw = Math.max(1, (W - m.l - m.r) / z.lon.length);
        z.freq_pct.forEach((v, i) => { if (v > 0) s.append(el('rect', { x: x(z.lon[i]) - bw / 2, y: yf(v), width: bw + .3, height: yf(0) - yf(v), fill: COL.A, class: 'grow v' })); });
        niceTicks(lo, hiL, 5).forEach(v => { if (v >= lo && v <= hiL) s.append(el('text', { x: x(v), y: Hh - m.b + 18, 'text-anchor': 'middle', class: 'tick' }, `${num(v, 1)}° E`)); });
        s.append(el('text', { x: m.l, y: split + gap - 12, class: 'sub' }, 'How often water, Aug–Nov 2018–2023 (VH)'));
        s.append(el('text', { x: m.l + 4, y: m.t + 12, class: 'sub halo' }, 'Ground elevation, Copernicus DEM'));
        const tp = tip(box), hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Hh - m.t - m.b, fill: 'transparent' }); s.append(hit);
        hit.addEventListener('mousemove', e => { const bx = s.getBoundingClientRect(), px = (e.clientX - bx.left) * W / bx.width, i = Math.max(0, Math.min(z.lon.length - 1, Math.round((px - m.l) / (W - m.l - m.r) * (z.lon.length - 1)))); tp.show(`<b>${num(z.lon[i], 3)}° E</b><div>Elevation ${num(z.elev_m[i])} m</div><div>Water in ${num(z.freq_pct[i])}% of images</div>${z.plain[i] ? '<div>JRC floodplain</div>' : ''}`, x(z.lon[i]), m.t + 20); });
        hit.addEventListener('mouseleave', () => tp.hide());
        key($('#xs-key'), [['#d6d3cc', 'Ground elevation'], [COL.A, 'How often water'], ['rgba(120,120,112,0.3)', 'JRC floodplain']]);
        if (!$('#xs-pick').childElementCount) seg($('#xs-pick'), S.map((q, k) => [String(k), `${num(q.lat, 2)}° N`]), String(XS.i), v => { XS.i = +v; sections(); });
    }

    // ---------- Part B ----------
    function climChart() {
        const box = $('#climchart'), C = D.b.drought.climatology, Hh = 300;
        const { s, W } = svgFrame(box, Hh, 'Mean monthly rainfall of the Sokoto–Rima basin with the 10th–90th percentile range'), m = { l: 50, r: 14, t: 24, b: 32 };
        const x = i => m.l + (i + 0.5) / 12 * (W - m.l - m.r), bw = (W - m.l - m.r) / 12 * 0.56;
        const y = yAxis(s, m.l, W - m.r, m.t, Hh - m.b, 0, niceTicks(0, Math.max(...C.p90), 5).slice(-1)[0], v => num(v), 5, 'mm');
        const tp = tip(box);
        C.mean.forEach((v, i) => {
            const b = el('rect', { x: x(i) - bw / 2, y: y(v), width: bw, height: y(0) - y(v), rx: 3, fill: COL.B, 'fill-opacity': .85, class: 'grow v' }); s.append(b);
            s.append(el('line', { x1: x(i), x2: x(i), y1: y(C.p10[i]), y2: y(C.p90[i]), stroke: '#111', 'stroke-width': 1.3, class: 'fade' }));
            [C.p10[i], C.p90[i]].forEach(q => s.append(el('line', { x1: x(i) - 5, x2: x(i) + 5, y1: y(q), y2: y(q), stroke: '#111', 'stroke-width': 1.3, class: 'fade' })));
            const h = el('rect', { x: x(i) - (W - m.l - m.r) / 24, y: m.t, width: (W - m.l - m.r) / 12, height: Hh - m.t - m.b, fill: 'transparent' }); s.append(h);
            h.addEventListener('mousemove', () => tp.show(`<b>${MONTH[i]}</b><div>Mean ${num(v, 0)} mm</div><div>Driest 10% of years ≤ ${num(C.p10[i], 0)} mm</div><div>Wettest 10% ≥ ${num(C.p90[i], 0)} mm</div>`, x(i), y(C.p90[i])));
            h.addEventListener('mouseleave', () => tp.hide());
        });
        xLabels(s, W, Hh - 10, x, MON.map(n => W < 560 ? n[0] : n));
    }

    const SP = { k: '12' };
    function spiChart() {
        const box = $('#spichart'), Dr = D.b.drought, v = Dr.spi_basin[SP.k], Hh = 300, y0 = Dr.years[0];
        const { s, W } = svgFrame(box, Hh, `SPI-${SP.k} of the Sokoto–Rima basin, monthly, ${Dr.years[0]}–${Dr.years[1]}`), m = { l: 40, r: 12, t: 20, b: 32 };
        const n = v.length, x = i => m.l + (i + 0.5) / n * (W - m.l - m.r), bw = Math.max(1, (W - m.l - m.r) / n);
        const y = yAxis(s, m.l, W - m.r, m.t, Hh - m.b, -3, 3, q => signed(q), 6);
        s.append(el('rect', { x: m.l, y: y(-1), width: W - m.l - m.r, height: y(-3) - y(-1), fill: COL.B, opacity: .06 }));
        Dr.events_basin[SP.k].forEach(e => { const [yy, mo] = e.start.split('-').map(Number), i = (yy - y0) * 12 + mo - 1; s.append(el('rect', { x: x(i) - bw / 2, y: m.t - 8, width: Math.max(2, e.months * bw), height: 4, rx: 2, fill: COL.B, class: 'fade' })); });
        const colr = q => q <= -1 ? '#965b14' : q < 0 ? '#e5bf86' : q < 1 ? '#a9c6ec' : '#2459ab';
        const parts = {};
        v.forEach((q, i) => { if (!isNum(q)) return; const c = colr(q), c0 = Math.max(-3, Math.min(3, q)); (parts[c] = parts[c] || []).push(`M${(x(i) - bw / 2).toFixed(1)},${y(0).toFixed(1)}h${(bw * .9).toFixed(2)}V${y(c0).toFixed(1)}h${(-bw * .9).toFixed(2)}Z`); });
        Object.entries(parts).forEach(([c, d]) => s.append(el('path', { d: d.join(''), fill: c, class: 'grow v' })));
        for (let yy = y0; yy <= Dr.years[1]; yy++) if ((yy - y0) % (W < 600 ? 10 : 5) === 0 || yy === y0) s.append(el('text', { x: x((yy - y0) * 12 + 6), y: Hh - 10, 'text-anchor': 'middle', class: 'tick' }, yy));
        const tp = tip(box), hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Hh - m.t - m.b, fill: 'transparent' }); s.append(hit);
        hit.addEventListener('mousemove', e => { const bx = s.getBoundingClientRect(), px = (e.clientX - bx.left) * W / bx.width, i = Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / bw))); tp.show(`<b>${MON[i % 12]} ${y0 + Math.floor(i / 12)}</b><div>SPI-${SP.k}: ${isNum(v[i]) ? signed(v[i], 2) : 'not defined'}</div>`, x(i), m.t + 30); });
        hit.addEventListener('mouseleave', () => tp.hide());
        key($('#spi-key'), [['#965b14', 'Drought (≤ −1)'], ['#e5bf86', 'Drier than normal'], ['#a9c6ec', 'Wetter than normal'], ['#2459ab', 'Wet (≥ 1)'], [COL.B, `Drought events (SPI-${SP.k} run ≤ −1)`, 'line']]);
        if (!$('#spi-k').childElementCount) seg($('#spi-k'), [['3', 'SPI-3'], ['6', 'SPI-6'], ['12', 'SPI-12']], SP.k, k => { SP.k = k; spiChart(); });
    }

    function yearControl(prefix, years, start, onYear) {
        const r = $(`#${prefix}-year`), out = $(`#${prefix}-year-out`), play = $(`#${prefix}-play`);
        r.min = 0; r.max = years.length - 1; r.step = 1; r.value = years.indexOf(start); out.textContent = start;
        const set = i => { r.value = i; out.textContent = years[i]; onYear(years[i]); };
        r.addEventListener('input', () => { stop(); set(+r.value); });
        let timer = null;
        const stop = () => { if (timer) { clearInterval(timer); timer = null; play.textContent = '▶'; play.setAttribute('aria-label', 'Play through the years'); } };
        play.addEventListener('click', () => {
            if (timer) { stop(); return; }
            play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause');
            let i = +r.value; if (i >= years.length - 1) i = -1;
            timer = setInterval(() => { i++; if (i >= years.length) { stop(); return; } set(i); }, H.reduced ? 1200 : 700);
        });
        return { enable(on) { r.disabled = !on; play.disabled = !on; $(`#${prefix}-year-ctl`).style.opacity = on ? 1 : .35; if (!on) stop(); } };
    }

    function basinOutline(map) { L.geoJSON(D.domains.features.find(f => f.properties.id === 'sokoto_rima'), { style: { color: '#111', weight: 1.4, fill: false }, interactive: false }).addTo(map); }

    function droughtMap() {
        const B = D.bcells, map = newMap('drought-map'); map.fitBounds([[11, 3.6], [16.3, 9.6]]);
        H.basemap(map, 'canvas'); H.cartography(map, 1); basinOutline(map);
        let layer = null, cur = 'spi', year = B.years[B.years.length - 1];
        const ev = B.events['12'];
        const L_ = {
            spi: () => [B.spi12[B.years.indexOf(year)], H.SPI_CLASSES, `SPI-12, ${year}`, 'Calendar-year rainfall against 1991–2020', v => `SPI-12 ${signed(v, 2)}`],
            mean: () => [B.mean_mm, H.seqClasses(B.mean_mm, H.RAMP.blue, ' mm', 0), 'Mean annual rainfall', 'CHIRPS, 1981–2024', v => `${num(v)} mm a year`],
            cv: () => [B.cv_pct, H.seqClasses(B.cv_pct, H.RAMP.ochre, '%', 0), 'Year-to-year variability', 'Coefficient of variation of annual rainfall', v => `CV ${num(v, 1)}%`],
            events: () => [ev.events, H.seqClasses(ev.events, H.RAMP.ochre, '', 0), 'Drought events, SPI-12', 'Runs of months with SPI-12 ≤ −1, 1981–2024', v => `${num(v)} events`],
            dur: () => [ev.mean_duration, H.seqClasses(ev.mean_duration, H.RAMP.ochre, ' months', 0), 'Mean drought duration, SPI-12', 'Months per event, 1981–2024', v => `${num(v, 1)} months on average`],
        };
        const yc = yearControl('dm', B.years, year, y => { year = y; draw(); });
        const draw = () => {
            const [vals, cls, t, sub, f] = L_[cur]();
            layer = H.cellLayer(map, B.cells, vals, cls, (v, i) => `<b>${num(B.cells[i][1], 3)}° N, ${num(B.cells[i][0], 3)}° E</b><br>${isNum(v) ? f(v) : 'no value'}`, null, -1, layer);
            $('#dm-legend').innerHTML = H.legendHtml(t, sub, cls);
            yc.enable(cur === 'spi');
        };
        seg($('#dm-layer'), [['spi', 'SPI-12 by year'], ['mean', 'Mean rainfall'], ['cv', 'Variability'], ['events', 'Drought events'], ['dur', 'Duration']], cur, v => { cur = v; draw(); });
        draw(); onResize($('#drought-map'), () => map.invalidateSize());
    }

    function tcChart() {
        const box = $('#tcchart'), T = D.b.drought.terraclimate, Dr = D.b.drought, Hh = 320;
        const yrs = []; for (let y = T.period[0]; y <= T.period[1]; y++) yrs.push(y);
        const ch = yrs.map((_, i) => Dr.spi_basin['12'][i * 12 + 11]);
        const { s, W } = svgFrame(box, Hh, 'SPI-12 at December from CHIRPS and TerraClimate, and soil-moisture standard scores'), m = { l: 40, r: 12, t: 20, b: 32 };
        const x = i => m.l + (i + 0.5) / yrs.length * (W - m.l - m.r), bw = (W - m.l - m.r) / yrs.length * .6;
        const y = yAxis(s, m.l, W - m.r, m.t, Hh - m.b, -3, 3, q => signed(q), 6);
        T.soil_z.forEach((v, i) => s.append(el('rect', { x: x(i) - bw / 2, y: Math.min(y(v), y(0)), width: bw, height: Math.abs(y(v) - y(0)), rx: 1.5, fill: v < 0 ? '#c9c2b5' : '#dcd8cf', class: v < 0 ? 'grow vn' : 'grow v' })));
        s.append(el('line', { x1: m.l, x2: W - m.r, y1: y(-1), y2: y(-1), class: 'ref', opacity: .5 }));
        lineP(s, ch.map((v, i) => [x(i), y(v)]), { stroke: COL.B });
        lineP(s, T.spi12_terraclimate_dec.map((v, i) => [x(i), y(v)]), { stroke: '#111', 'stroke-dasharray': '5 3', class: 'fade' });
        yrs.forEach((yy, i) => { if (yy % (W < 600 ? 10 : 5) === 0) s.append(el('text', { x: x(i), y: Hh - 10, 'text-anchor': 'middle', class: 'tick' }, yy)); });
        const tp = tip(box), hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Hh - m.t - m.b, fill: 'transparent' }); s.append(hit);
        hit.addEventListener('mousemove', e => { const bx = s.getBoundingClientRect(), px = (e.clientX - bx.left) * W / bx.width, i = Math.max(0, Math.min(yrs.length - 1, Math.floor((px - m.l) / ((W - m.l - m.r) / yrs.length)))); tp.show(`<b>${yrs[i]}</b><div>SPI-12, CHIRPS: ${signed(ch[i], 2)}</div><div>SPI-12, TerraClimate: ${signed(T.spi12_terraclimate_dec[i], 2)}</div><div>Soil moisture, Jul–Oct: ${signed(T.soil_z[i], 2)}</div>`, x(i), m.t + 30); });
        hit.addEventListener('mouseleave', () => tp.hide());
        key($('#tc-key'), [[COL.B, 'SPI-12, CHIRPS', 'line'], ['#111', 'SPI-12, TerraClimate', 'dash'], ['#c9c2b5', 'Soil moisture (standard score, Jul–Oct)']]);
        $('#tc-key i.dash').style.color = '#111';
    }

    const ND = { mode: 'series' };
    function ndviChart() {
        const box = $('#ndvichart'), B = D.b, Hh = 320;
        const yrs = Object.keys(B.ndvi.ndvi_growing_season).map(Number), rainBy = Object.fromEntries(B.rain.years.map(r => [r.year, r.rain_mm]));
        const nv = yrs.map(y => B.ndvi.ndvi_growing_season[y]), rv = yrs.map(y => rainBy[y]);
        const det = ND.mode !== 'series';
        const nz = zs(det ? detrend(yrs, nv) : nv), rz = zs(det ? detrend(yrs, rv) : rv);
        const lab = det ? 'detrended' : 'as measured', r = det ? B.ndvi.detrended.pearson_r : B.ndvi.raw.pearson_r;
        const { s, W } = svgFrame(box, Hh, `Growing-season NDVI and annual rainfall, ${lab}`), m = { l: 44, r: 16, t: 24, b: 40 };
        const tp = tip(box);
        if (ND.mode === 'scatter') {
            const lim = 2.6, x = v => m.l + (v + lim) / (2 * lim) * (W - m.l - m.r);
            const y = yAxis(s, m.l, W - m.r, m.t, Hh - m.b, -lim, lim, q => signed(q), 4);
            niceTicks(-lim, lim, 4).forEach(v => { if (Math.abs(v) <= lim) s.append(el('text', { x: x(v), y: Hh - m.b + 16, 'text-anchor': 'middle', class: 'tick' }, signed(v))); });
            s.append(el('line', { x1: x(0), x2: x(0), y1: m.t, y2: Hh - m.b, class: 'ax0' }));
            const { sl, ic } = linreg(rz, nz);
            s.append(el('line', { x1: x(-lim), x2: x(lim), y1: y(ic - sl * lim), y2: y(ic + sl * lim), stroke: COL.B, 'stroke-width': 1.5, 'stroke-opacity': .6, class: 'fade' }));
            rz.forEach((v, i) => { const c = el('circle', { cx: x(v), cy: y(nz[i]), r: 5, fill: '#2e7d32', stroke: '#fff', 'stroke-width': 1.5, class: 'fade' }); s.append(c); c.addEventListener('mousemove', () => tp.show(`<b>${yrs[i]}</b><div>Rainfall ${num(rv[i])} mm</div><div>NDVI ${num(nv[i], 3)}</div>`, x(v), y(nz[i]))); c.addEventListener('mouseleave', () => tp.hide()); });
            s.append(el('text', { x: (m.l + W - m.r) / 2, y: Hh - 6, 'text-anchor': 'middle', class: 'axlab' }, 'Annual rainfall, detrended standard score'));
            s.append(el('text', { x: m.l + 6, y: m.t + 4, class: 'axlab halo' }, 'NDVI, detrended standard score'));
            s.append(el('text', { x: W - m.r, y: Hh - m.b - 10, 'text-anchor': 'end', class: 'lab halo' }, `r = ${num(r, 2)}, n = ${yrs.length}`));
            key($('#nd-key'), [['#2e7d32', 'One growing season, 2001–2024', 'dot'], [COL.B, 'Least-squares line', 'line']]);
            return;
        }
        const x = i => m.l + (i + 0.5) / yrs.length * (W - m.l - m.r), bw = (W - m.l - m.r) / yrs.length * .55;
        const y = yAxis(s, m.l, W - m.r, m.t, Hh - m.b, -3, 3, q => signed(q), 6);
        rz.forEach((v, i) => s.append(el('rect', { x: x(i) - bw / 2, y: Math.min(y(v), y(0)), width: bw, height: Math.abs(y(v) - y(0)), rx: 1.5, fill: v < 0 ? '#e5bf86' : '#a9c6ec', class: v < 0 ? 'grow vn' : 'grow v' })));
        lineP(s, nz.map((v, i) => [x(i), y(v)]), { stroke: '#2e7d32' });
        nz.forEach((v, i) => s.append(el('circle', { cx: x(i), cy: y(v), r: 3, fill: '#2e7d32', class: 'fade' })));
        yrs.forEach((yy, i) => { if (yy % (W < 600 ? 5 : 2) === 1) s.append(el('text', { x: x(i), y: Hh - m.b + 16, 'text-anchor': 'middle', class: 'tick' }, yy)); });
        s.append(el('text', { x: m.l + 8, y: m.t + 4, class: 'lab halo' }, `r = ${num(r, 2)}`));
        const hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Hh - m.t - m.b, fill: 'transparent' }); s.append(hit);
        hit.addEventListener('mousemove', e => { const bx = s.getBoundingClientRect(), px = (e.clientX - bx.left) * W / bx.width, i = Math.max(0, Math.min(yrs.length - 1, Math.floor((px - m.l) / ((W - m.l - m.r) / yrs.length)))); tp.show(`<b>${yrs[i]}</b><div>Rainfall ${num(rv[i])} mm (${signed(rz[i], 2)})</div><div>NDVI ${num(nv[i], 3)} (${signed(nz[i], 2)})</div>`, x(i), m.t + 30); });
        hit.addEventListener('mouseleave', () => tp.hide());
        key($('#nd-key'), [['#2e7d32', `Growing-season NDVI (Jul–Oct), ${lab}`, 'line'], ['#a9c6ec', 'Wetter year'], ['#e5bf86', 'Drier year']]);
        if (!$('#nd-mode').childElementCount) seg($('#nd-mode'), [['series', 'As measured'], ['detr', 'Trends removed'], ['scatter', 'Against each other']], ND.mode, v => { ND.mode = v; ndviChart(); });
    }

    function ndviMap() {
        const B = D.bcells, map = newMap('ndvi-map'); map.fitBounds([[11, 3.6], [16.3, 9.6]]);
        H.basemap(map, 'canvas'); H.cartography(map, 1); basinOutline(map);
        let layer = null, cur = 'anom', year = B.ndvi_years[B.ndvi_years.length - 1];
        const yc = yearControl('nm', B.ndvi_years, year, y => { year = y; draw(); });
        const draw = () => {
            let vals, cls, t, sub, f;
            if (cur === 'anom') { vals = B.ndvi_anomaly[B.ndvi_years.indexOf(year)]; cls = H.NDVI_A_CLASSES; t = `NDVI anomaly, ${year}`; sub = 'July–October, against 2001–2024'; f = v => `NDVI anomaly ${signed(v, 3)}`; }
            else if (cur === 'r') { vals = B.ndvi_r_detrended; cls = H.R_CLASSES; t = 'Rainfall–NDVI correlation'; sub = 'Detrended, 2001–2024, each cell with its own rain'; f = (v, i) => `r = ${num(v, 2)}, p = ${num(B.ndvi_p_detrended[i], 3)}`; }
            else { vals = B.ndvi_mean; cls = H.seqClasses(B.ndvi_mean, ['#f2f5ea', '#d6e6bf', '#aed08f', '#7fb76a', '#4f9447', '#2e7d32', '#1d5b22'], '', 2); t = 'Mean growing-season NDVI'; sub = 'July–October, 2001–2024'; f = v => `NDVI ${num(v, 3)}`; }
            layer = H.cellLayer(map, B.cells, vals, cls, (v, i) => `<b>${num(B.cells[i][1], 3)}° N, ${num(B.cells[i][0], 3)}° E</b><br>${isNum(v) ? f(v, i) : 'not enough clear images'}`, null, -1, layer);
            $('#nm-legend').innerHTML = H.legendHtml(t, sub, cls);
            yc.enable(cur === 'anom');
        };
        seg($('#nm-layer'), [['anom', 'Anomaly by year'], ['r', 'Correlation with rain'], ['mean', 'Mean NDVI']], cur, v => { cur = v; draw(); });
        draw(); onResize($('#ndvi-map'), () => map.invalidateSize());
    }

    // ---------- Part C ----------
    const areaSeg = (id, st, fn) => seg($(id), [['niger_benue', AREA.niger_benue], ['sokoto_rima', AREA.sokoto_rima]], st.area, v => { st.area = v; fn(); });
    const PF = { area: 'sokoto_rima' };
    function perfChart() {
        const box = $('#perfchart'), P = D.c.reliability.areas[PF.area].performance, models = Object.keys(P);
        const cols = [['rl25_ratio', '25-year rainfall', 'r'], ['rx_mean_ratio', 'Mean annual max', 'r'], ['total_ratio', 'Annual total', 'r'], ['season_r', 'Seasonal cycle r', 'c'], ['pattern_r', 'Spatial pattern r', 'c']];
        if (PF.area === 'sokoto_rima') cols.push(['dry_median_diff', 'Dry spell, days', 'd']);
        const narrow = box.clientWidth < 640, lw = narrow ? 112 : 150, rh = 21, Hh = 46 + models.length * rh;
        const { s, W } = svgFrame(box, Hh, `Model performance against CHIRPS, ${AREA[PF.area]}`), cw = (W - lw) / cols.length;
        const dep = (v, t) => t === 'r' ? Math.log(v) / Math.log(2) : t === 'c' ? (v - 1) * 1.5 : v / 8;
        const colr = d => { const a = Math.min(1, Math.abs(d)); if (a < 0.08) return '#ecebe7'; const lo = [236, 235, 231], hi = d < 0 ? [150, 91, 20] : [36, 89, 171]; const k = Math.pow(a, .8); return `rgb(${lo.map((c, i) => Math.round(c + (hi[i] - c) * k)).join(',')})`; };
        cols.forEach(([, t], j) => s.append(el('text', { x: lw + j * cw + cw / 2, y: 30, 'text-anchor': 'middle', class: 'sub' }, narrow ? t.replace('Mean annual max', 'Mean max').replace('25-year rainfall', '25-yr').replace('Seasonal cycle r', 'Season r').replace('Spatial pattern r', 'Pattern r').replace('Annual total', 'Total').replace('Dry spell, days', 'Dry days') : t)));
        const tp = tip(box);
        models.forEach((mo, i) => {
            const y0 = 40 + i * rh;
            s.append(el('text', { x: lw - 8, y: y0 + 14, 'text-anchor': 'end', class: 'tick', fill: '#111' }, mo));
            cols.forEach(([k, t, ty], j) => {
                const v = P[mo][k]; if (!isNum(v)) return;
                const d = dep(v, ty), c = colr(d);
                const r = el('rect', { x: lw + j * cw + 1, y: y0, width: cw - 2, height: rh - 2, rx: 3, fill: c, class: 'fade', style: `transition-delay:${(i * 0.012).toFixed(3)}s` }); s.append(r);
                s.append(el('text', { x: lw + j * cw + cw / 2, y: y0 + 13.5, 'text-anchor': 'middle', class: 'tick', fill: Math.abs(d) > .55 ? '#fff' : '#333' }, ty === 'd' ? signed(v, 1) : num(v, 2)));
                r.addEventListener('mousemove', () => tp.show(`<b>${mo}</b><div>${t}: ${ty === 'd' ? signed(v, 1) + ' days vs CHIRPS' : num(v, 2)}</div>`, lw + j * cw + cw / 2, y0));
                r.addEventListener('mouseleave', () => tp.hide());
            });
        });
        key($('#pf-key'), [['rgb(150,91,20)', 'Below CHIRPS / lower agreement'], ['#ecebe7', 'Close to agreement'], ['rgb(36,89,171)', 'Above CHIRPS']]);
        if (!$('#pf-area').childElementCount) areaSeg('#pf-area', PF, perfChart);
    }

    const RL = { area: 'niger_benue' };
    function rlChart() {
        const box = $('#rlchart'), A = D.c.reliability.areas[RL.area], Hh = 360;
        const { s, W } = svgFrame(box, Hh, `Return-level curves, ${AREA[RL.area]}`), m = { l: 50, r: 18, t: 22, b: 44 };
        const T0 = 1, T1 = 200, x = t => m.l + Math.log(t / T0) / Math.log(T1 / T0) * (W - m.l - m.r);
        const M = A.rl_curves_models, Cc = A.rl_curve_chirps;
        const hi = niceTicks(0, Math.max(...M.ssp585.p90, ...Cc.p95, ...A.rl_points_chirps.mm) * 1.02, 5).slice(-1)[0];
        const lo = Math.floor(Math.min(...Cc.p05, ...M.historical.p10, ...A.rl_points_chirps.mm) / 10) * 10;
        const y = yAxis(s, m.l, W - m.r, m.t, Hh - m.b, lo, hi, v => num(v), 5, 'mm');
        [1, 2, 5, 10, 25, 50, 100, 200].forEach(t => { s.append(el('line', { x1: x(t), x2: x(t), y1: m.t, y2: Hh - m.b, class: 'grid', opacity: .6 })); s.append(el('text', { x: x(t), y: Hh - m.b + 16, 'text-anchor': 'middle', class: 'tick' }, t)); });
        s.append(el('text', { x: (m.l + W - m.r) / 2, y: Hh - 6, 'text-anchor': 'middle', class: 'axlab' }, 'Return period, years (logarithmic)'));
        const S = [['historical', '#8a8a83', 'Models, 1985–2014'], ['ssp245', COL.ssp245, 'Models, SSP2-4.5, 2041–2070'], ['ssp585', COL.ssp585, 'Models, SSP5-8.5, 2041–2070']];
        S.forEach(([k, c]) => s.append(el('path', { d: band(M[k].T.map((t, i) => [x(t), y(M[k].p10[i])]), M[k].T.map((t, i) => [x(t), y(M[k].p90[i])])), fill: c, 'fill-opacity': .1, class: 'fade' })));
        s.append(el('path', { d: band(Cc.T.map((t, i) => [x(t), y(Cc.p05[i])]), Cc.T.map((t, i) => [x(t), y(Cc.p95[i])])), fill: '#111', 'fill-opacity': .1, class: 'fade' }));
        S.forEach(([k, c]) => lineP(s, M[k].T.map((t, i) => [x(t), y(M[k].median[i])]), { stroke: c }));
        lineP(s, Cc.T.map((t, i) => [x(t), y(Cc.median[i])]), { stroke: '#111' });
        const tp = tip(box);
        A.rl_points_chirps.T.forEach((t, i) => { if (t < T0) return; const c = el('circle', { cx: x(t), cy: y(A.rl_points_chirps.mm[i]), r: 3.4, fill: '#fff', stroke: '#111', 'stroke-width': 1.3, class: 'fade' }); s.append(c); c.addEventListener('mousemove', () => tp.show(`<b>CHIRPS annual maximum</b><div>${num(A.rl_points_chirps.mm[i], 1)} mm, plotted at ${num(t, 1)} years</div>`, x(t), y(A.rl_points_chirps.mm[i]))); c.addEventListener('mouseleave', () => tp.hide()); });
        const hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Hh - m.t - m.b, fill: 'transparent', 'pointer-events': 'none' }); s.append(hit);
        box.onmousemove = e => {
            if (e.target.tagName === 'circle') return;
            const bx = s.getBoundingClientRect(), px = (e.clientX - bx.left) * W / bx.width; if (px < m.l || px > W - m.r) { tp.hide(); return; }
            let j = 0; Cc.T.forEach((t, k) => { if (Math.abs(x(t) - px) < Math.abs(x(Cc.T[j]) - px)) j = k; });
            const t = Cc.T[j];
            tp.show(`<b>${num(t, t < 2 ? 1 : 0)}-year daily rainfall</b><div>CHIRPS ${num(Cc.median[j], 1)} mm (${num(Cc.p05[j], 0)}–${num(Cc.p95[j], 0)})</div>${S.map(([k, c, n]) => `<div><i style="background:${c}"></i>${n.replace('Models, ', '')}: ${num(M[k].median[M[k].T.indexOf(t)], 1)} mm</div>`).join('')}`, x(t), m.t + 40);
        };
        box.onmouseleave = () => tp.hide();
        key($('#rl-key'), [['#111', 'CHIRPS 1985–2014, GEV (band 90%)', 'line'], ['#111', 'CHIRPS annual maxima', 'dot'], ...S.map(([, c, n]) => [c, n, 'line'])]);
        $('#rl-key li:nth-child(2) i').style.cssText = 'background:#fff;border:1.5px solid #111';
        if (!$('#rl-area').childElementCount) areaSeg('#rl-area', RL, rlChart);
    }

    // strip chart: rows of per-model dots with a band and marks
    function strip(box, rows, opt) {
        const narrow = box.clientWidth < 640, lw = narrow ? 92 : 128, rh = opt.rowH || 64, Hh = 30 + rows.length * rh + 34;
        const { s, W } = svgFrame(box, Hh, opt.label), m = { l: lw, r: 18, t: 20 };
        const vals = rows.flatMap(r => [...r.dots.map(d => d[1]), ...(r.band || [])]).filter(isNum);
        const lo = Math.min(opt.ref, ...vals), hi = Math.max(opt.ref, ...vals), pad = (hi - lo) * .06;
        const ticks = niceTicks(lo - pad, hi + pad, narrow ? 4 : 7), a = ticks[0], b = ticks[ticks.length - 1];
        const x = v => m.l + (v - a) / (b - a) * (W - m.l - m.r), bottom = m.t + rows.length * rh;
        ticks.forEach(v => { s.append(el('line', { x1: x(v), x2: x(v), y1: m.t, y2: bottom, class: 'grid' })); s.append(el('text', { x: x(v), y: bottom + 16, 'text-anchor': 'middle', class: 'tick' }, opt.fmt(v))); });
        s.append(el('line', { x1: x(opt.ref), x2: x(opt.ref), y1: m.t - 4, y2: bottom, class: 'ax0' }));
        s.append(el('text', { x: (m.l + W - m.r) / 2, y: Hh - 4, 'text-anchor': 'middle', class: 'axlab' }, opt.axis));
        const tp = tip(box);
        rows.forEach((r, i) => {
            const yc = m.t + i * rh + rh / 2;
            s.append(el('text', { x: lw - 10, y: yc + 4, 'text-anchor': 'end', class: 'lab', 'font-weight': 700 }, r.name));
            if (r.band) s.append(el('rect', { x: x(r.band[0]), y: yc - 15, width: Math.max(1, x(r.band[1]) - x(r.band[0])), height: 30, rx: 6, fill: r.color, 'fill-opacity': .1, class: 'grow' }));
            // beeswarm-lite: jitter by rank to avoid overlap
            const ds = r.dots.slice().sort((p, q) => p[1] - q[1]); let lastX = -99, lane = 0;
            ds.forEach(([n, v]) => {
                if (!isNum(v)) return;
                const cx = x(v); lane = cx - lastX < 7 ? (lane + 1) % 4 : 0; lastX = cx;
                const cy = yc + [0, -7, 7, -14][lane];
                const c = el('circle', { cx, cy, r: 4.2, fill: r.color, stroke: 'var(--panel)', 'stroke-width': 1.2, 'fill-opacity': .85, class: 'fade' }); s.append(c);
                c.addEventListener('mousemove', () => tp.show(`<b>${n}</b><div>${r.name}: ${opt.fmtTip(v)}</div>`, cx, cy));
                c.addEventListener('mouseleave', () => tp.hide());
            });
            (r.marks || []).forEach(([v, shape, label]) => {
                if (!isNum(v)) return;
                const cx = x(v);
                if (shape === 'bar') s.append(el('line', { x1: cx, x2: cx, y1: yc - 19, y2: yc + 19, stroke: '#111', 'stroke-width': 2.4 }));
                else if (shape === 'tick') s.append(el('line', { x1: cx, x2: cx, y1: yc - 16, y2: yc + 16, stroke: '#111', 'stroke-width': 1.4, 'stroke-dasharray': '3 2' }));
                else s.append(el('path', { d: `M${cx},${yc - 21}l5,-7h-10z`, fill: '#111' }));
                const h = el('rect', { x: cx - 5, y: yc - 26, width: 10, height: 50, fill: 'transparent' }); s.append(h);
                h.addEventListener('mousemove', () => tp.show(`<b>${label}</b><div>${opt.fmtTip(v)}</div>`, cx, yc - 20));
                h.addEventListener('mouseleave', () => tp.hide());
            });
        });
    }

    const UP = { area: 'niger_benue', T: '50' };
    function upChart() {
        const REL = D.c.reliability.areas[UP.area], R = D.c.results.areas[UP.area], ti = TS.indexOf(+UP.T);
        const rows = ['ssp245', 'ssp585'].map(sc => {
            const ens = REL.ensemble[sc], comb = (R.ensemble[sc].uplift[UP.T] || {}).combined;
            return { name: SCEN[sc], color: COL[sc], dots: Object.entries(REL.uplift_gev[sc]).map(([n, v]) => [n, v[ti]]), band: comb ? [comb.p05, comb.p95] : null,
                marks: [[ens.gev_median[ti], 'bar', 'GEV median'], [ens.gumbel_median[ti], 'tick', 'Gumbel median'], [ens.gev_family_weighted[ti], 'tri', 'Family-weighted median']] };
        });
        strip($('#upchart'), rows, { ref: 1, label: `Uplift factor for the ${UP.T}-year daily rainfall, ${AREA[UP.area]}`, fmt: v => num(v, 1), fmtTip: v => `${num(v, 2)} (${upct(v)})`, axis: `Uplift factor, ${UP.T}-year daily rainfall (2041–2070 ÷ 1985–2014)` });
        key($('#up-key'), [[COL.ssp245, 'Model, SSP2-4.5', 'dot'], [COL.ssp585, 'Model, SSP5-8.5', 'dot'], ['#111', 'GEV median', 'line'], ['#111', 'Gumbel median', 'dash'], ['#11111122', '5–95% incl. sampling']]);
        $$('#up-key i.dash').forEach(i => { i.style.color = '#111'; });
        const li = document.createElement('li'); li.innerHTML = '<svg width="12" height="10" aria-hidden="true"><path d="M1,1h10l-5,7z" fill="#111"/></svg><span>Family-weighted median</span>'; $('#up-key').append(li);
        if (!$('#up-area').childElementCount) {
            areaSeg('#up-area', UP, upChart);
            seg($('#up-t'), TS.map(t => [String(t), `${t}-year`]), UP.T, v => { UP.T = v; upChart(); });
        }
    }

    function upliftMap() {
        const map = newMap('uplift-map'); H.basemap(map, 'canvas');
        const st = { area: 'niger_benue', layer: 'uplift', scen: 'ssp585', T: '50' };
        let layer = null, carto = false, outline = null;
        const fit = () => { const c = D.cells[st.area].cells, la = c.map(q => q[1]), lo = c.map(q => q[0]); map.fitBounds([[Math.min(...la) - .2, Math.min(...lo) - .2], [Math.max(...la) + .2, Math.max(...lo) + .2]]); };
        const draw = (refit) => {
            const Cc = D.cells[st.area], cells = Cc.cells;
            if (refit) {
                if (layer) { layer.remove(); layer = null; }
                if (outline) outline.remove();
                outline = L.geoJSON(D.domains.features.find(f => f.properties.id === st.area), { style: { color: '#111', weight: 1.3, fill: false }, interactive: false }).addTo(map);
                fit(); if (!carto) { H.cartography(map, st.area === 'sokoto_rima' ? 1 : 0.5); carto = true; }
            }
            const U = Cc.uplift[st.scen][st.T], models = Object.keys(U);
            let vals, cls, t, sub, f;
            if (st.layer === 'today') { vals = Cc.chirps_rl[st.T]; cls = H.seqClasses(vals, H.RAMP.blue, ' mm', 0); t = `${st.T}-year daily rainfall today`; sub = 'CHIRPS, 1985–2014, GEV'; f = v => `${num(v, 1)} mm`; }
            else if (st.layer === 'uplift') { vals = cells.map((_, i) => median(models.map(mo => U[mo][i]))); cls = H.UP_CLASSES; t = `Median uplift, ${st.T}-year`; sub = `${SCEN[st.scen]}, 2041–2070 against 1985–2014, ${models.length} models`; f = v => `${num(v, 2)} (${upct(v)})`; }
            else { vals = cells.map((_, i) => models.filter(mo => U[mo][i] > 1).length); cls = [[-Infinity, 12, '#dfc27d', 'under 12 (no majority)'], [12, 16, '#e8e6e1', '12–15'], [16, 19, '#c6dbef', '16–18'], [19, 22, '#6a9fe2', '19–21'], [22, Infinity, '#1f56b0', '22–23']]; t = 'Models projecting an increase'; sub = `${st.T}-year, ${SCEN[st.scen]}, out of ${models.length}`; f = v => `${v} of ${models.length} models`; }
            layer = H.cellLayer(map, cells, vals, cls, (v, i) => `<b>${num(cells[i][1], 3)}° N, ${num(cells[i][0], 3)}° E</b><br>${isNum(v) ? f(v) : '—'}`, null, -1, layer);
            $('#um-legend').innerHTML = H.legendHtml(t, sub, cls);
            $$('#um-scen button').forEach(b => { b.disabled = st.layer === 'today'; });
        };
        seg($('#um-area'), [['niger_benue', AREA.niger_benue], ['sokoto_rima', AREA.sokoto_rima]], st.area, v => { st.area = v; draw(true); });
        seg($('#um-layer'), [['today', 'Today'], ['uplift', 'Uplift'], ['agree', 'Model agreement']], st.layer, v => { st.layer = v; draw(); });
        seg($('#um-scen'), [['ssp245', 'SSP2-4.5'], ['ssp585', 'SSP5-8.5']], st.scen, v => { st.scen = v; draw(); });
        seg($('#um-t'), TR.map(t => [t, `${t}-yr`]), st.T, v => { st.T = v; draw(); });
        draw(true); onResize($('#uplift-map'), () => map.invalidateSize());
    }

    const DC = { area: 'niger_benue' };
    function decChart() {
        const box = $('#decchart'), Dd = D.c.reliability.areas[DC.area].decomposition;
        const src = [['sampling', 'Sampling (30-year records)', '#5f519e'], ['model', 'Climate models', '#bdb4e0'], ['scenario', 'Scenario', COL.ssp585], ['distribution', 'Distribution (GEV or Gumbel)', '#9a9a93']];
        const narrow = box.clientWidth < 640, lw = narrow ? 66 : 90, rh = 38, Hh = 34 + TS.length * rh + 24;
        const { s, W } = svgFrame(box, Hh, `Sources of uncertainty in the uplift factor, ${AREA[DC.area]}`), m = { r: 60 };
        const x = v => lw + v * (W - lw - m.r);
        [0, .25, .5, .75, 1].forEach(v => { s.append(el('line', { x1: x(v), x2: x(v), y1: 16, y2: 24 + TS.length * rh, class: 'grid' })); s.append(el('text', { x: x(v), y: 34 + TS.length * rh, 'text-anchor': 'middle', class: 'tick' }, pct(v))); });
        s.append(el('text', { x: W - 2, y: 12, 'text-anchor': 'end', class: 'sub' }, 'total SD'));
        const tp = tip(box);
        TS.forEach((t, i) => {
            const d = Dd[String(t)], y0 = 22 + i * rh; let acc = 0;
            s.append(el('text', { x: lw - 10, y: y0 + 17, 'text-anchor': 'end', class: 'lab' }, `${t}-year`));
            src.forEach(([k, n, c], j) => {
                const v = d[k], r = el('rect', { x: x(acc) + (acc ? 1 : 0), y: y0 + 2, width: Math.max(0, x(acc + v) - x(acc) - (acc ? 1 : 0)), height: rh - 12, fill: c, class: 'grow', style: `transition-delay:${(j * .1).toFixed(2)}s` });
                s.append(r);
                if (v > .09) s.append(el('text', { x: x(acc + v / 2), y: y0 + 19, 'text-anchor': 'middle', class: 'tick', fill: j < 1 || j === 2 ? '#fff' : '#222' }, pct(v)));
                r.addEventListener('mousemove', () => tp.show(`<b>${t}-year</b><div>${n}: ${pct(v, 1)}</div>`, x(acc + v / 2), y0));
                r.addEventListener('mouseleave', () => tp.hide());
                acc += v;
            });
            s.append(el('text', { x: W - 2, y: y0 + 17, 'text-anchor': 'end', class: 'tick' }, num(d.total_sd, 2)));
        });
        key($('#dc-key'), src.map(([, n, c]) => [c, n]));
        if (!$('#dc-area').childElementCount) areaSeg('#dc-area', DC, decChart);
    }

    const DS = { v: 'niger_benue:rx' };
    function designTable() {
        const R = D.c.results.areas, REL = D.c.reliability.areas, tb = $('#design-table tbody');
        const f = (d, s) => `${num(d[s].future_mm_median, 0)} <span class="sub">${num(d[s].future_mm_p05, 0)}–${num(d[s].future_mm_p95, 0)}</span>`;
        tb.innerHTML = ['niger_benue', 'sokoto_rima'].flatMap(a => TR.map((t, i) => {
            const d = { ssp245: R[a].ensemble.ssp245.design_rainfall[t], ssp585: R[a].ensemble.ssp585.design_rainfall[t] };
            return `<tr${i === 0 ? ' class="grp"' : ''}><td class="l">${i === 0 ? AREA[a] : ''}</td><td>${t}-year</td><td>${num(d.ssp245.baseline_mm, 0)}</td><td>${num(REL[a].baseline['1995-2024'][t], 0)}</td><td>${f(d, 'ssp245')}</td><td>${f(d, 'ssp585')}</td></tr>`;
        })).join('');
    }

    function dryMap() {
        const Cc = D.cells.sokoto_rima, map = newMap('dry-map'); map.fitBounds([[11, 3.6], [16.3, 9.6]]);
        H.basemap(map, 'canvas'); H.cartography(map, 1); basinOutline(map);
        const st = { kind: 'median', scen: 'ssp585' }; let layer = null;
        const draw = () => {
            const M = Cc.dry_change[st.scen][st.kind], models = Object.keys(M);
            const vals = Cc.cells.map((_, i) => median(models.map(mo => M[mo][i])));
            const up = i => models.filter(mo => M[mo][i] > 0).length, dn = i => models.filter(mo => M[mo][i] < 0).length;
            layer = H.cellLayer(map, Cc.cells, vals, H.DRY_CLASSES, (v, i) => `<b>${num(Cc.cells[i][1], 3)}° N, ${num(Cc.cells[i][0], 3)}° E</b><br>Median change ${signed(v, 1)} days<br>${up(i)} models longer, ${dn(i)} shorter`, null, -1, layer);
            $('#dsm-legend').innerHTML = H.legendHtml(`Change in longest dry spell, ${st.kind === 'median' ? 'typical year' : '1-in-10 dry year'}`, `June–September, ${SCEN[st.scen]}, median of ${models.length} models`, H.DRY_CLASSES);
        };
        seg($('#dsm-kind'), [['median', 'Typical year'], ['p90', '1-in-10 dry year']], st.kind, v => { st.kind = v; draw(); });
        seg($('#dsm-scen'), [['ssp245', 'SSP2-4.5'], ['ssp585', 'SSP5-8.5']], st.scen, v => { st.scen = v; draw(); });
        draw(); onResize($('#dry-map'), () => map.invalidateSize());
    }

    function dryChart() {
        const R = D.c.results.areas.sokoto_rima, models = Object.keys(R.models);
        const rows = [];
        [['dry_spell_median_change', 'dry50', 'Typical'], ['dry_spell_p90_change', 'dry90', '1-in-10']].forEach(([k, e, n]) => ['ssp245', 'ssp585'].forEach(sc => {
            const comb = (R.ensemble[sc][e] || {}).combined;
            rows.push({ name: `${n}, ${SCEN[sc]}`, color: COL[sc], dots: models.map(mo => [mo, R.models[mo][sc][k]]), band: comb ? [comb.p05, comb.p95] : null, marks: [[(R.ensemble[sc][e] || {}).models_median, 'bar', 'Median of models']] });
        }));
        strip($('#drychart'), rows, { ref: 0, rowH: 54, label: 'Change in the longest June–September dry spell by model', fmt: v => signed(v, 0), fmtTip: v => `${signed(v, 1)} days`, axis: 'Change in longest June–September dry spell, days (2041–2070 against 1985–2014)' });
        key($('#dry-key'), [[COL.ssp245, 'Model, SSP2-4.5', 'dot'], [COL.ssp585, 'Model, SSP5-8.5', 'dot'], ['#111', 'Median of models', 'line'], ['#11111122', '5–95% incl. sampling']]);
    }


    // ---------- small multiples: the same map repeated for several years or return periods ----------
    function multiples(box, tiles) {
        (box._maps || []).forEach(m => m.remove());
        box._maps = [];
        box.innerHTML = '';
        tiles.forEach(t => {
            const cell = document.createElement('div'); cell.className = 'mcell';
            cell.innerHTML = `<p class="mtitle">${t.title}</p><div class="map h240" role="img" aria-label="${t.title}"></div>`;
            box.append(cell);
            const m = L.map(cell.querySelector('.map'), { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, attributionControl: false });
            box._maps.push(m);
            t.fit(m);
            H.basemap(m, 'canvas');
            t.draw(m);
        });
    }
    const basinFit = m => { const c = D.cells.sokoto_rima.cells, la = c.map(q => q[1]), lo = c.map(q => q[0]); m.fitBounds([[Math.min(...la) - .2, Math.min(...lo) - .2], [Math.max(...la) + .2, Math.max(...lo) + .2]]); };
    function multiA() {
        const items = [['How often radar saw water, 2018–2023', 'data/part_a/dual_frequency.png', H.RAMP && null],
                       ['Water, February 2022 (dry season)', 'data/part_a/dual_water_2022-02.png'],
                       ['Water, October 2022 (flood)', 'data/part_a/dual_water_2022-10.png'],
                       ['New water, October 2022', 'data/part_a/flood_extension_2022-10.png']];
        multiples($('#multi-a'), items.map(([title, url]) => ({ title, fit: m => m.fitBounds(BOX(), { padding: [4, 4] }), draw: m => L.imageOverlay(url, BOX(), { className: 'px', interactive: false, alt: title }).addTo(m) })));
        H.key($('#multi-a-key'), [[COL.A, 'Water (both polarisations)'], ['#08306b', 'Often water (50–100% of images)'], ['#deebf7', 'Seldom water (1–10%)'], ['rgba(120,120,112,0.35)', 'Floodplain (JRC, 1984–2020)']]);
    }
    function multiB() {
        const B = D.bcells;
        const years = [1983, 1984, 1987, 2009];
        multiples($('#multi-b'), years.map(y => ({ title: String(y), fit: basinFit, draw: m => H.cellLayer(m, B.cells, B.spi12[B.years.indexOf(y)], H.SPI_CLASSES, () => '', null, -1, null) })));
        H.key($('#multi-b-key'), [['#965b14', 'Drought (≤ −1)'], ['#e5bf86', 'Drier than normal'], ['#a9c6ec', 'Wetter than normal'], ['#2459ab', 'Wet (≥ 1)']]);
    }
    function multiC() {
        const C = D.cells.sokoto_rima, U = C.uplift.ssp585, models = Object.keys(U['2']);
        const ts = ['2', '10', '50', '100'];
        multiples($('#multi-c'), ts.map(t => {
            const vals = C.cells.map((_, i) => median(models.map(mo => U[t][mo][i])));
            return { title: `${t}-year rainfall`, fit: basinFit, draw: m => H.cellLayer(m, C.cells, vals, H.UP_CLASSES, () => '', null, -1, null) };
        }));
        H.key($('#multi-c-key'), [['#8c510a', '< 0.90 (lower)'], ['#e8e6e1', '1.00–1.10'], ['#9fc5e8', '1.20–1.30'], ['#1f56b0', '≥ 1.50 (higher)']]);
    }

    // ---------- start ----------
    const RENDER = [['#framework-diagram', framework], ['#floodchart', floodCurve], ['#s2chart', s2Chart], ['#xschart', sections], ['#climchart', climChart], ['#spichart', spiChart], ['#tcchart', tcChart], ['#ndvichart', ndviChart], ['#perfchart', perfChart], ['#rlchart', rlChart], ['#upchart', upChart], ['#decchart', decChart], ['#drychart', dryChart]];
    const MAPS = [['#hero-map', hero], ['#study-map', studyMap], ['#flood-map', floodMap], ['#drought-map', droughtMap], ['#ndvi-map', ndviMap], ['#uplift-map', upliftMap], ['#dry-map', dryMap], ['#multi-a', multiA], ['#multi-b', multiB], ['#multi-c', multiC]];
    function safe(fn, node) { try { fn(); } catch (e) { console.error(e); if (node) node.innerHTML = '<p class="load-error">This figure could not be drawn.</p>'; } }

    H.chrome();
    addEventListener('hashchange', () => { const x = document.getElementById(location.hash.slice(1)); if (x) { if (!x.hasAttribute('tabindex')) x.setAttribute('tabindex', '-1'); x.focus({ preventScroll: true }); } });
    H.reactions();
    const cb = $('#copy-cite'); if (cb) cb.addEventListener('click', () => H.copy($('#cite-text').textContent, 'Citation copied'));
    Promise.all(['a', 'b', 'c', 'b_cells', 'cells'].map(f => H.get(`data/${f}.json`)).concat([H.get('data/domains.geojson')]))
        .then(([a, b, c, bcells, cells, domains]) => {
            Object.assign(D, { a, b, c, bcells, cells, domains });
            safe(texts); safe(designTable);
            RENDER.forEach(([sel, fn]) => { const n = $(sel); safe(fn, n); if (n && fn !== framework) onResize(n, () => safe(fn, n)); });
            MAPS.forEach(([sel, fn]) => whenNear($(sel), () => safe(fn, $(sel))));
            document.documentElement.dataset.ready = '1';
        })
        .catch(e => { console.error(e); $$('.chart, .map').forEach(n => { n.innerHTML = '<p class="load-error">The data could not be loaded. Please reload the page.</p>'; }); });
})();
