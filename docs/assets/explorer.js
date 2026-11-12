/* Explorer: one map, one panel. Every value is read from docs/data/*.json; nothing is typed in here. */
(function () {
    'use strict';
    const H = window.HX;
    const { $, $$, isNum, num, signed, pct, upct, median, mean, listing, MON, MONTH, AREA, SCEN, COL, el, svgFrame, yAxis, path, niceTicks, seg } = H;
    const D = {};
    const TRC = ['2', '10', '25', '50', '100'];   // return periods in cells.json (no 5-year level)
    const TRR = ['2', '5', '10', '25', '50', '100']; // return periods in the reliability results
    const BOX_AREA = 'niger_benue', BASIN = 'sokoto_rima';

    const FREQ = [[0, 0, '#deebf7', '1–10% of images'], [0, 0, '#9ecae1', '10–25%'], [0, 0, '#4292c6', '25–50%'], [0, 0, '#08519c', '50–75%'], [0, 0, '#08306b', '75–100%']];
    const FP = [0, 0, 'rgba(120,120,112,0.35)', 'Floodplain (JRC, 1984–2020)'];
    const WATER = [[0, 0, '#1f56b0', 'Water'], [0, 0, '#111111', 'Permanent water (JRC ≥ 90%)'], FP];
    const COVER = [[0, 0, '#ededE9', 'under 70 images'], [0, 0, '#c7c7c0', '70–120'], [0, 0, '#96968d', '120–180'], [0, 0, '#5c5c55', '180 or more']];
    const EXT = [[0, 0, '#1f56b0', 'New water: flood extension'], [0, 0, 'rgba(120,120,112,0.65)', 'Water in both seasons'], FP];
    const AGREE = [[-Infinity, 12, '#dfc27d', 'under 12 models (no majority)'], [12, 16, '#e8e6e1', '12–15'], [16, 19, '#c6dbef', '16–18'], [19, 22, '#6a9fe2', '19–21'], [22, Infinity, '#1f56b0', '22–23']];
    const NDVI_MEAN = ['#f2f5ea', '#d6e6bf', '#aed08f', '#7fb76a', '#4f9447', '#2e7d32', '#1d5b22'];

    // layer groups and layers
    const GROUPS = {
        floods: { label: 'Floods', area: BOX_AREA, def: 'flood-dual', layers: [['flood-dual', 'Frequency'], ['flood-feb', 'Feb 2022'], ['flood-oct', 'Oct 2022'], ['flood-ext', 'Flood extension'], ['flood-cov', 'Coverage']] },
        drought: { label: 'Drought', area: BASIN, def: 'spi', layers: [['spi', 'SPI-12 by year'], ['rain', 'Mean rainfall'], ['cv', 'Variability'], ['events', 'Drought events'], ['dur', 'Event duration']] },
        future: { label: 'Future rainfall', area: null, def: 'uplift', layers: [['uplift', 'Uplift'], ['today', 'Design rainfall today'], ['agree', 'Models agreeing'], ['dry', 'Dry spells']] },
    };
    const FLOOD_LAYERS = {
        'flood-dual': { url: 'data/part_a/dual_frequency.png', t: 'How often water, Aug–Nov', sub: 'Share of Sentinel-1 images, 2018–2023, both polarisations', cls: FREQ },
        'flood-feb': { url: 'data/part_a/dual_water_2022-02.png', t: 'Water, February 2022 (dry)', sub: 'Median image, both polarisations', cls: WATER },
        'flood-oct': { url: 'data/part_a/dual_water_2022-10.png', t: 'Water, October 2022 (flood)', sub: 'Median image, both polarisations', cls: WATER },
        'flood-ext': { url: 'data/part_a/flood_extension_2022-10.png', t: 'Flood extension, October 2022', sub: 'Water in October not seen in February–March 2022', cls: EXT },
        'flood-cov': { url: 'data/part_a/coverage.png', t: 'Wet-season images per cell', sub: 'August–November 2018–2023', cls: COVER },
    };

    const S = { group: 'floods', layer: 'flood-dual', area: BOX_AREA, year: 2024, scen: 'ssp585', T: '50', kind: 'median', cell: null, tab: 'overview', basemap: 'canvas', scale: '12', flood: 'all', series: 'monthly' };

    let map, tiles = null, overlay = null, cellGroup = null, cartoDone = false;

    // ---------- helpers ----------
    const share = v => pct(v, 0);
    const r10 = v => num(Math.round(v / 10) * 10);
    const r100 = v => num(Math.round(v / 100) * 100);
    const BOX = () => { const b = D.a.vh.settings.box; return [[b[1], b[0]], [b[3], b[2]]]; };
    const yearsA = () => [...new Set(D.a.vh.monthly.map(r => r.year))];
    const layerGroup = l => Object.keys(GROUPS).find(g => GROUPS[g].layers.some(x => x[0] === l));
    const cellsOf = () => S.group === 'drought' ? D.bcells.cells : D.cells[S.area].cells;
    const mAt = (rows, mo, k, y) => mean(rows.filter(r => r.month === mo && (y === 'all' || r.year === +y)).map(r => r[k]));
    function table(head, rows) {
        return `<div class="tablewrap"><table><thead><tr>${head.map((h, i) => `<th class="${i ? '' : 'l'}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? '' : 'l'}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    function tile(k, v, s) { return `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`; }

    // ---------- derived numbers ----------
    function summary() {
        const A = D.a, B = D.b, Dr = B.drought, C = D.c, R = C.results.areas, REL = C.reliability.areas;
        const years = yearsA();
        const peakMonths = years.map(y => { const rows = A.vh.monthly.filter(r => r.year === y); return rows.reduce((p, q) => q.flood_floodplain_km2 > p.flood_floodplain_km2 ? q : p).month; });
        const pk = [...new Set(peakMonths)].sort((a, b) => a - b);
        const dw = A.dualpol.sentinel2_check.wet_2022_10_11, dd = A.dualpol.sentinel2_check.dry_2022_02;
        const ev = Dr.events_basin['12'], longest = ev.reduce((p, q) => q.months > p.months ? q : p);
        const [ly, lm] = longest.start.split('-').map(Number);
        const sig = D.bcells.ndvi_p_detrended.filter(isNum), sigShare = sig.filter(p => p < 0.05).length / sig.length;
        const U = (a, s, t) => R[a].ensemble[s].uplift[t];
        const i50 = TRR.indexOf('50');
        return {
            pk, peakShort: pk.map(m => MON[m - 1]).join('–'),
            dwPrec: share(dw.s1_confirmed_by_s2), dwRec: share(dw.s2_found_by_s1), ddPrec: share(dd.s1_confirmed_by_s2),
            octFlood: r10(mAt(A.vh.monthly, 10, 'flood_floodplain_km2', 'all')), octDual: r10(mAt(A.dualpol.monthly, 10, 'dual_km2', 'all')), octChg: r10(mAt(A.change.monthly, 10, 'extension_km2', 'all')),
            longest: longest.months, longestStart: `${MONTH[lm - 1]} ${ly}`, meanRain: num(B.rain.mean_mm), cv: num(B.rain.cv * 100, 0),
            tcR: num(Dr.terraclimate.spi12_dec_corr.r, 2), ndviDet: num(B.ndvi.detrended.pearson_r, 2), sigShare: share(sigShare),
            upNb: upct(U('niger_benue', 'ssp585', '50').models_median), upSr: upct(U('sokoto_rima', 'ssp585', '50').models_median),
            agreeNb: U('niger_benue', 'ssp585', '50').models_above_1, agreeSr: U('sokoto_rima', 'ssp585', '50').models_above_1, nModels: C.results.settings.models.length,
            sampSh: share(REL.niger_benue.decomposition['50'].sampling), rxNb: upct(R.niger_benue.ensemble.ssp585.rx1day_mean_ratio.models_median),
            i50,
        };
    }

    // ---------- map ----------
    function fitArea() {
        if (S.area === BOX_AREA) { map.fitBounds(BOX(), { padding: [18, 18] }); return; }
        const c = D.cells[BASIN].cells, la = c.map(q => q[1]), lo = c.map(q => q[0]);
        map.fitBounds([[Math.min(...la) - .3, Math.min(...lo) - .3], [Math.max(...la) + .3, Math.max(...lo) + .3]], { padding: [18, 18] });
    }
    function setBasemap(kind) {
        if (tiles) tiles.remove();
        tiles = H.basemap(map, kind); tiles.bringToBack();
    }
    function showOverlay(url, legend) {
        if (overlay && overlay._url === url) { $('#legend').innerHTML = legend; return; }
        const next = L.imageOverlay(url, BOX(), { className: 'px', interactive: false, opacity: 0, alt: 'Sentinel-1 water extent on the Lower Niger–Benue reach' }).addTo(map);
        next._url = url;
        const old = overlay; overlay = next;
        next.on('load', () => { if (overlay !== next) return; next.setOpacity(1); if (old) old.remove(); $('#legend').innerHTML = legend; });
        next.on('error', () => { next.remove(); if (overlay === next) overlay = null; if (old) old.setOpacity(0); fail('A radar image could not be loaded. Try another layer.'); });
    }
    function hideOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
    function hideCells() { if (cellGroup) { cellGroup.remove(); cellGroup = null; } }

    // the value and class set for the current cell layer
    function cellSpec() {
        const B = D.bcells, Cs = D.cells[BASIN];
        if (S.group === 'drought') {
            const yi = B.years.indexOf(+S.year), ev = B.events['12'];
            switch (S.layer) {
                case 'spi': return { vals: B.spi12[yi], cls: H.SPI_CLASSES, t: `SPI-12, ${S.year}`, sub: 'Calendar-year rainfall against 1991–2020', f: v => `SPI-12 ${signed(v, 2)}` };
                case 'rain': return { vals: B.mean_mm, cls: H.seqClasses(B.mean_mm, H.RAMP.blue, ' mm', 0), t: 'Mean annual rainfall', sub: 'CHIRPS, 1981–2024', f: v => `${num(v)} mm a year` };
                case 'cv': return { vals: B.cv_pct, cls: H.seqClasses(B.cv_pct, H.RAMP.ochre, '%', 0), t: 'Year-to-year variability', sub: 'Coefficient of variation of annual rainfall', f: v => `CV ${num(v, 1)}%` };
                case 'events': return { vals: ev.events, cls: H.seqClasses(ev.events, H.RAMP.ochre, '', 0), t: 'Drought events, SPI-12', sub: 'Runs of months with SPI-12 ≤ −1, 1981–2024', f: v => `${num(v)} events` };
                case 'dur': return { vals: ev.mean_duration, cls: H.seqClasses(ev.mean_duration, H.RAMP.ochre, ' months', 0), t: 'Mean drought duration, SPI-12', sub: 'Months per event, 1981–2024', f: v => `${num(v, 1)} months on average` };
            }
        }
        // future rainfall
        const C = D.cells[S.area], U = C.uplift[S.scen][S.T], models = Object.keys(U);
        switch (S.layer) {
            case 'uplift': {
                const vals = C.cells.map((_, i) => median(models.map(m => U[m][i])));
                return { vals, cls: H.UP_CLASSES, t: `Median uplift, ${S.T}-year`, sub: `${SCEN[S.scen]}, 2041–2070 against 1985–2014, ${models.length} models`, f: v => `${num(v, 2)} (${upct(v)})` };
            }
            case 'today': {
                const vals = C.chirps_rl[S.T];
                return { vals, cls: H.seqClasses(vals, H.RAMP.blue, ' mm', 0), t: `${S.T}-year daily rainfall today`, sub: 'CHIRPS, 1985–2014, GEV', f: v => `${num(v, 1)} mm` };
            }
            case 'agree': {
                const vals = C.cells.map((_, i) => models.filter(m => U[m][i] > 1).length);
                return { vals, cls: AGREE, t: 'Models projecting an increase', sub: `${S.T}-year, ${SCEN[S.scen]}, out of ${models.length}`, f: v => `${v} of ${models.length} models` };
            }
            case 'dry': {
                const DC = Cs.dry_change[S.scen][S.kind], dm = Object.keys(DC);
                const vals = Cs.cells.map((_, i) => median(dm.map(m => DC[m][i])));
                return { vals, cls: H.DRY_CLASSES, t: `Change in longest dry spell, ${S.kind === 'median' ? 'typical year' : '1-in-10 dry year'}`, sub: `June–September, ${SCEN[S.scen]}, median of ${dm.length} models`, f: v => `${signed(v, 1)} days`, dry: DC };
            }
        }
    }

    function drawMap() {
        const g = layerGroup(S.layer);
        if (g === 'floods') {
            hideCells();
            const F = FLOOD_LAYERS[S.layer];
            showOverlay(F.url, H.legendHtml(F.t, F.sub, F.cls));
            return;
        }
        hideOverlay();
        const spec = cellSpec(), cells = cellsOf();
        const tip = (v, i) => `<b>${num(cells[i][1], 3)}° N, ${num(cells[i][0], 3)}° E</b><br>${isNum(v) ? spec.f(v, i) : 'no value'}`;
        const prev = cellGroup;
        cellGroup = H.cellLayer(map, cells, spec.vals, spec.cls, tip, i => pickCell(i), S.cell, prev);
        $('#legend').innerHTML = H.legendHtml(spec.t, spec.sub, spec.cls);
    }

    function pickCell(i) {
        S.cell = i; setTab('cell'); writeURL(); drawMap(); renderPanel();
    }

    // ---------- controls ----------
    function renderNav() {
        seg($('#seg-group'), Object.entries(GROUPS).map(([k, g]) => [k, g.label]), S.group, v => setGroup(v));
        seg($('#seg-layer'), GROUPS[S.group].layers, S.layer, v => setLayer(v));
        seg($('#area-chips'), [[BOX_AREA, AREA[BOX_AREA]], [BASIN, AREA[BASIN]]], S.area, v => setArea(v));
        $$('#area-chips button').forEach(b => b.classList.add('chip'));
        $('#area-label').textContent = S.group === 'floods' ? 'Study area for floods' : S.group === 'drought' ? 'Study area for drought' : 'Study area';
        $('#area-chips').setAttribute('aria-label', 'Study area');
        const future = S.group === 'future';
        $('#ctl-year').hidden = S.group !== 'drought';
        $('#ctl-future').hidden = !future;
        $('#ctl-flood').hidden = true;
        $('#ctl-note').textContent = S.group === 'floods'
            ? 'Radar composites for 2018–2023. Choose a year in Time series for the monthly curve.'
            : S.group === 'drought' ? 'Calendar years 1981–2024. Play steps through the years.' : '';
        if (future) {
            seg($('#seg-scen'), [['ssp245', 'SSP2-4.5'], ['ssp585', 'SSP5-8.5']], S.scen, v => { S.scen = v; refresh(); });
            if (S.layer === 'dry') seg($('#seg-t'), [['median', 'Typical year'], ['p90', '1-in-10 dry year']], S.kind, v => { S.kind = v; refresh(); });
            else seg($('#seg-t'), TRC.map(t => [t, `${t}-year`]), S.T, v => { S.T = v; refresh(); });
        }
        $('#year').min = 0; $('#year').max = B().years.length - 1;
        $('#year').value = B().years.indexOf(+S.year);
        $('#year-out').textContent = S.year;
        $('#basemap-select').value = S.basemap;
    }
    const B = () => D.bcells;

    function setGroup(g) {
        S.group = g; S.layer = GROUPS[g].def; if (GROUPS[g].area) S.area = GROUPS[g].area;
        S.cell = null; fitArea(); refresh();
    }
    function setLayer(l) {
        const g = layerGroup(l);
        if (g !== S.group) { S.group = g; S.cell = null; }
        S.layer = l;
        if (l === 'dry' && S.area !== BASIN) { S.area = BASIN; S.cell = null; fitArea(); }
        if (GROUPS[g].area && S.area !== GROUPS[g].area) { S.area = GROUPS[g].area; S.cell = null; fitArea(); }
        refresh();
    }
    function setArea(a) {
        if (a === S.area) return;
        S.area = a; S.cell = null;
        if (S.group === 'floods' && a !== BOX_AREA) { S.group = 'drought'; S.layer = 'spi'; }
        else if (S.group === 'drought' && a !== BASIN) { S.group = 'floods'; S.layer = 'flood-dual'; }
        else if (S.layer === 'dry' && a !== BASIN) S.layer = 'uplift';
        fitArea(); refresh();
    }
    function setTab(t) {
        S.tab = t;
        $$('[role="tab"]').forEach(b => { const on = b.dataset.tab === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
        $$('.tp').forEach(p => { p.hidden = p.dataset.tab !== t; });
        renderPanel();
    }

    function refresh() {
        renderNav(); drawMap(); renderPanel(); writeURL();
    }

    // ---------- panel ----------
    // only the open tab is drawn, so charts measure a visible element
    function renderPanel() {
        const f = { overview: renderOverview, cell: renderCell, series: renderSeries, stats: renderStats, compare: renderCompare }[S.tab];
        try { if (f) f(); } catch (e) { console.error(e); }
    }

    function renderOverview() {
        const x = summary(), g = S.group;
        const intro = `<dl>
            <dt>The place.</dt><dd>${g === 'floods' ? 'The Lower Niger–Benue reach, about 220 km in a straight line from the Niger–Benue confluence at Lokoja south to 5.8° N, in Nigeria.' : g === 'drought' ? 'The Sokoto–Rima basin, about 183,000 km², across north-west Nigeria and south-central Niger.' : 'Both study areas: the Lower Niger–Benue reach and the Sokoto–Rima basin.'}</dd>
            <dt>The question.</dt><dd>${g === 'floods' ? 'When and how far does the reach flood, and how much of the radar’s water does an independent sensor confirm?' : g === 'drought' ? 'How often, how long and how severe are droughts, do two rainfall records agree, and does vegetation follow?' : 'How much do 23 climate models raise the daily rainfall used in design, by 2041–2070?'}</dd>
            <dt>How.</dt><dd>${g === 'floods' ? 'Sentinel-1 radar, 2018–2023, checked against Sentinel-2 in 2022.' : g === 'drought' ? 'CHIRPS rainfall 1981–2024, SPI at three timescales, TerraClimate and MODIS NDVI as independent checks.' : 'NEX-GDDP-CMIP6 daily rainfall, GEV fitted per cell by L-moments, uplift as the ratio of future to past.'}</dd></dl>`;
        let tiles = '', warn = '';
        if (g === 'floods') {
            tiles = tile('Peak flood months', x.peakShort, 'Floodplain water, every year 2018–2023') +
                tile('Radar water confirmed, flood season', x.dwPrec, 'Sentinel-2 agrees, Oct–Nov 2022, both polarisations') +
                tile('Radar water confirmed, dry season', x.ddPrec, 'Feb 2022: most dark ground is not water') +
                tile('October floodplain water', `${x.octFlood} km²`, 'Mean of 2018–2023, VH inside the floodplain');
            warn = '<p class="note-warn">Radar water is indicative. Dry-season radar water is mostly bare ground, so the flood curve is read for timing.</p>';
        } else if (g === 'drought') {
            tiles = tile('Longest drought (SPI-12)', `${x.longest} months`, `From ${x.longestStart}`) +
                tile('Mean annual rainfall', `${x.meanRain} mm`, `Year-to-year variability ${x.cv}%`) +
                tile('CHIRPS and TerraClimate agree', `r = ${x.tcR}`, 'SPI-12 correlation, 1981–2021') +
                tile('Cells with rain-linked greenness', x.sigShare, 'Detrended NDVI–rain link, p < 0.05');
        } else {
            tiles = tile(`Median 50-year uplift, Niger–Benue`, x.upNb, `SSP5-8.5; ${x.agreeNb} of ${x.nModels} models agree`) +
                tile('Median 50-year uplift, Sokoto–Rima', x.upSr, `SSP5-8.5; ${x.agreeSr} of ${x.nModels} models agree`) +
                tile('Sampling share of the 50-year range', x.sampSh, 'Niger–Benue: 30-year records dominate') +
                tile('Heaviest-day change, Niger–Benue', x.rxNb, 'Mean of yearly wettest days, SSP5-8.5');
            warn = '<p class="note-warn">Each cell has a 30-year sample. Read patterns, not single cells.</p>';
        }
        $('#overview').innerHTML = `<section class="intro"><h2>The study in plain terms</h2>${intro}</section>
            <h2>What the data shows</h2><div class="tiles">${tiles}</div>${warn}
            <p class="sec-note">Open the Statistics tab for the full numbers, or pick a cell on the map for its record.</p>`;
    }

    function renderCell() {
        const el0 = $('#cell');
        if (S.group === 'floods') { el0.innerHTML = '<p class="mute">Flood layers are radar images, not cells. Use Time series and Statistics for flood numbers.</p>'; return; }
        if (S.cell == null) { el0.innerHTML = '<p class="mute">Click a cell on the map to see its record.</p>'; return; }
        const i = S.cell, cells = cellsOf(), [lo, la] = cells[i];
        let html = `<p class="sel-cell">Cell ${i + 1}: ${num(la, 3)}° N, ${num(lo, 3)}° E</p>`;
        if (S.group === 'drought') {
            const B = D.bcells, ev = B.events['12'];
            const series = B.spi12.map(r => r[i]);
            html += `<h2>SPI-12, every December</h2>${spark(series)}<p class="sec-note">Calendar-year SPI-12, 1981–2024. Below −1 is drought.</p>`;
            html += table(['Measure', 'Value'], [
                ['Mean annual rainfall', `${num(B.mean_mm[i])} mm`], ['Year-to-year variability', `${num(B.cv_pct[i], 1)}%`],
                ['Drought events (SPI-12)', num(ev.events[i])], ['Mean event duration', `${num(ev.mean_duration[i], 1)} months`],
                ['Greenness and rain (detrended r)', num(B.ndvi_r_detrended[i], 2)], ['p-value', num(B.ndvi_p_detrended[i], 3)],
            ]);
        } else {
            const C = D.cells[S.area], rows = TRC.map(t => {
                const cell = (sc) => { const U = C.uplift[sc][t], ms = Object.keys(U); return [median(ms.map(m => U[m][i])), ms.filter(m => U[m][i] > 1).length, ms.length]; };
                const a = cell('ssp245'), b2 = cell('ssp585');
                return [`${t}-year`, num(C.chirps_rl[t][i], 1), `${upct(a[0])} (${a[1]}/${a[2]})`, `${upct(b2[0])} (${b2[1]}/${b2[2]})`];
            });
            html += `<h2>Design rainfall, this cell</h2>${table(['Return period', 'Today, mm', 'SSP2-4.5 uplift', 'SSP5-8.5 uplift'], rows)}`;
            html += `<p class="sec-note">Uplift is 2041–2070 over 1985–2014. Brackets show models projecting an increase out of the total.</p>`;
            if (S.area === BASIN) {
                const DC = C.dry_change;
                const dm = (sc, k) => { const M = DC[sc][k], ms = Object.keys(M); return median(ms.map(m => M[m][i])); };
                html += table(['Dry spell change, days', 'SSP2-4.5', 'SSP5-8.5'], [['Typical year', signed(dm('ssp245', 'median'), 1), signed(dm('ssp585', 'median'), 1)], ['1-in-10 dry year', signed(dm('ssp245', 'p90'), 1), signed(dm('ssp585', 'p90'), 1)]]);
            }
        }
        $('#cell').innerHTML = html;
    }

    function spark(vals) {
        const box = document.createElement('div'); box.className = 'chart';
        const { s, W } = svgFrame(box, 150, 'SPI-12 by year for this cell'), m = { l: 36, r: 8, t: 10, b: 20 };
        const y = yAxis(s, m.l, W - m.r, m.t, 150 - m.b, -3, 3, v => signed(v), 6);
        const n = vals.length, x = i => m.l + (i + .5) / n * (W - m.l - m.r), bw = Math.max(1, (W - m.l - m.r) / n * .7);
        s.append(el('line', { x1: m.l, x2: W - m.r, y1: y(-1), y2: y(-1), class: 'ref', opacity: .5 }));
        vals.forEach((v, i) => { if (!isNum(v)) return; const c = v <= -1 ? '#965b14' : v < 0 ? '#e5bf86' : v < 1 ? '#a9c6ec' : '#2459ab'; s.append(el('rect', { x: x(i) - bw / 2, y: Math.min(y(v), y(0)), width: bw, height: Math.abs(y(v) - y(0)) || 1, fill: c, class: 'grow v' })); });
        [1981, 1990, 2000, 2010, 2024].forEach(yy => s.append(el('text', { x: x(yy - 1981), y: 146, 'text-anchor': 'middle', class: 'tick' }, yy)));
        return box.outerHTML;
    }

    function renderSeries() {
        const box = $('#series');
        if (S.group === 'floods') {
            const yrs = yearsA(), sel = S.flood;
            box.innerHTML = `<h2>Monthly flood area, ${sel === 'all' ? '2018–2023 mean' : sel}</h2><div class="seg seg-inline" id="flood-seg"></div><div class="chart" id="flood-chart"></div><ul class="keylist" id="flood-key"></ul>
              <p class="sec-note">Water inside the floodplain (VH) and across the whole reach (both polarisations). Flood extension is water in each month that was not water in the same year's February–March. Values are km².</p>
              <p class="note-warn">The whole-reach line peaks in the dry season too. That is dark, dry ground, not flood, so read flood timing from the floodplain line.</p>`;
            seg($('#flood-seg'), [['all', 'Mean 2018–2023'], ...yrs.map(y => [String(y), String(y)])], sel, v => { S.flood = v; renderSeries(); writeURL(); });
            const A = D.a, b2 = document.getElementById('flood-chart'), W = 0;
            const series = [['Inside floodplain (VH)', COL.A, A.vh.monthly, 'flood_floodplain_km2'], ['Both polarisations', '#0f766e', A.dualpol.monthly, 'dual_km2'], ['Flood extension', '#c2410c', A.change.monthly, 'extension_km2']];
            const vals = series.map(z => MON.map((_, i) => mAt(z[2], i + 1, z[3], sel)));
            const { s, W: w } = svgFrame(b2, 300, 'Monthly flood area by method'), m = { l: 54, r: 14, t: 14, b: 30 };
            const top = niceTicks(0, Math.max(...vals.flat()) * 1.05, 5).slice(-1)[0];
            const xi = i => m.l + (i + .5) / 12 * (w - m.l - m.r), y = yAxis(s, m.l, w - m.r, m.t, 300 - m.b, 0, top, v => num(v), 5, 'km²');
            MON.forEach((n, i) => s.append(el('text', { x: xi(i), y: 288, 'text-anchor': 'middle', class: 'tick' }, w < 560 ? n[0] : n)));
            series.forEach((z, k) => { const d = path(vals[k].map((v, i) => [xi(i), y(v)])); const p = el('path', { d, fill: 'none', stroke: z[1], 'stroke-width': 2, class: 'draw' }); s.append(p); p.style.setProperty('--len', 2000); });
            H.key($('#flood-key'), series.map(z => [z[1], z[0], 'line']));
            return;
        }
        if (S.group === 'drought') {
            const Dr = D.b.drought, v = Dr.spi_basin[S.scale], n = v.length, y0 = Dr.years[0];
            box.innerHTML = `<h2>Basin SPI, monthly</h2><div class="seg seg-inline" id="spi-seg"></div><div class="chart" id="spi-chart"></div><ul class="keylist" id="spi-key"></ul>
              <p class="sec-note">Gamma SPI for the basin, ${y0}–${Dr.years[1]}. Below −1 is drought; blank months are not defined.</p>`;
            seg($('#spi-seg'), [['3', 'SPI-3'], ['6', 'SPI-6'], ['12', 'SPI-12']], S.scale, k => { S.scale = k; renderSeries(); writeURL(); });
            const { s, W } = svgFrame($('#spi-chart'), 300, 'Basin SPI by month'), m = { l: 40, r: 12, t: 14, b: 30 };
            const x = i => m.l + (i + .5) / n * (W - m.l - m.r), bw = Math.max(1, (W - m.l - m.r) / n);
            const y = yAxis(s, m.l, W - m.r, m.t, 300 - m.b, -3, 3, q => signed(q), 6);
            v.forEach((q, i) => { if (!isNum(q)) return; const c = q <= -1 ? '#965b14' : q < 0 ? '#e5bf86' : q < 1 ? '#a9c6ec' : '#2459ab'; s.append(el('rect', { x: x(i) - bw / 2, y: Math.min(y(q), y(0)), width: bw, height: Math.abs(y(q) - y(0)) || 1, fill: c })); });
            for (let yy = y0; yy <= Dr.years[1]; yy += 5) s.append(el('text', { x: x((yy - y0) * 12 + 6), y: 292, 'text-anchor': 'middle', class: 'tick' }, yy));
            H.key($('#spi-key'), [['#965b14', 'Drought (≤ −1)'], ['#e5bf86', 'Drier than normal'], ['#a9c6ec', 'Wetter than normal'], ['#2459ab', 'Wet (≥ 1)']]);
            return;
        }
        // future: return-level curves for the area
        const RL = D.c.reliability.areas[S.area], M = RL.rl_curves_models;
        box.innerHTML = `<h2>Daily rainfall against return period</h2><div class="chart" id="rl-chart"></div><ul class="keylist" id="rl-key"></ul>
          <p class="sec-note">Area median. CHIRPS 1985–2014 (black), and the median of the 23 models for 1985–2014 and 2041–2070, with the 10th–90th percentile band for SSP5-8.5.</p>`;
        const { s, W } = svgFrame($('#rl-chart'), 300, 'Return-level curves'), m = { l: 50, r: 14, t: 14, b: 30 };
        const lx = t => m.l + Math.log(t) / Math.log(200) * (W - m.l - m.r);
        const C = RL.rl_curve_chirps;
        const hi = niceTicks(0, Math.max(...M.ssp585.p90, ...C.p95) * 1.02, 5).slice(-1)[0];
        const y = yAxis(s, m.l, W - m.r, m.t, 300 - m.b, Math.floor(Math.min(...C.p05, ...M.historical.p10) / 10) * 10, hi, v => num(v), 5, 'mm');
        [1, 2, 5, 10, 25, 50, 100, 200].forEach(t => s.append(el('text', { x: lx(t), y: 290, 'text-anchor': 'middle', class: 'tick' }, t)));
        const band = (k, c) => s.append(el('path', { d: path(M[k].T.map((t, i) => [lx(t), y(M[k].p10[i])])) + M[k].T.map((t, i) => [lx(t), y(M[k].p90[i])]).reverse().map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + 'Z', fill: c, 'fill-opacity': .12 }));
        band('ssp585', COL.ssp585);
        ['historical', 'ssp245', 'ssp585'].forEach(k => s.append(el('path', { d: path(M[k].T.map((t, i) => [lx(t), y(M[k].median[i])])), fill: 'none', stroke: k === 'historical' ? '#8a8a83' : COL[k], 'stroke-width': 2 })));
        s.append(el('path', { d: path(C.T.map((t, i) => [lx(t), y(C.median[i])])), fill: 'none', stroke: '#111', 'stroke-width': 2 }));
        H.key($('#rl-key'), [['#111', 'CHIRPS 1985–2014'], ['#8a8a83', 'Models, 1985–2014'], [COL.ssp245, 'Models, SSP2-4.5'], [COL.ssp585, 'Models, SSP5-8.5']]);
    }

    function renderStats() {
        const A = D.a, Dr = D.b.drought, Rn = D.b.rain, C = D.c, g = S.group;
        let html = '';
        if (g === 'floods') {
            const S2 = A.robustness.sentinel2_check, Dp = A.dualpol.sentinel2_check, Ch = A.change.sentinel2_check_2022;
            html += `<h2>Radar against Sentinel-2, 2022</h2>` + table(['Method', 'Dry, precision', 'Dry, recall', 'Flood, precision', 'Flood, recall'], [
                ['VH, −18 dB', share(S2.dry_2022_02.minus18.s1_confirmed_by_s2), share(S2.dry_2022_02.minus18.s2_found_by_s1), share(S2.wet_2022_10_11.minus18.s1_confirmed_by_s2), share(S2.wet_2022_10_11.minus18.s2_found_by_s1)],
                ['VH, Otsu', share(S2.dry_2022_02.otsu.s1_confirmed_by_s2), share(S2.dry_2022_02.otsu.s2_found_by_s1), share(S2.wet_2022_10_11.otsu.s1_confirmed_by_s2), share(S2.wet_2022_10_11.otsu.s2_found_by_s1)],
                ['Both polarisations', share(Dp.dry_2022_02.s1_confirmed_by_s2), share(Dp.dry_2022_02.s2_found_by_s1), share(Dp.wet_2022_10_11.s1_confirmed_by_s2), share(Dp.wet_2022_10_11.s2_found_by_s1)],
                ['Change detection', '—', '—', share(Ch.s1_confirmed_by_s2), share(Ch.s2_found_by_s1)],
            ]);
            html += `<p class="sec-note">Precision: radar water that Sentinel-2 confirms. Recall: Sentinel-2 water that radar finds. Sentinel-2 cannot see through cloud, so it is an independent check, not ground truth.</p>`;
            html += `<h2>Area of water</h2>` + table(['Measure', 'km²'], [
                ['Floodplain (JRC, 1984–2020)', r10(A.vh.settings.floodplain_km2)], ['Permanent water (JRC ≥ 90%)', r10(A.vh.permanent_water_km2)],
                ['Water at least once, 2018–2023', r10(A.vh.frequency.area_ever_km2)], ['Water at least half the time', r10(A.vh.frequency.area_water_half_the_time_km2)],
            ]);
        } else if (g === 'drought') {
            const ev = Dr.events_basin;
            html += `<h2>Rainfall</h2>` + table(['Measure', 'Value'], [
                ['Mean annual rainfall', `${num(Rn.mean_mm)} mm`], ['Year-to-year variability (CV)', `${num(Rn.cv * 100, 0)}%`],
                ['Trend (least-squares slope)', `${signed(Rn.trend_mm_per_decade, 0)} mm per decade`], ['Mann–Kendall τ and p', `${num(Rn.kendall_tau, 2)}, p = ${num(Rn.kendall_p, 3)}`],
                ['Share of rain, May–October', share(Dr.climatology.wet_season_share)],
            ]);
            html += `<h2>Drought events</h2>` + table(['Timescale', 'Events', 'Longest, months'], ['3', '6', '12'].map(k => [`SPI-${k}`, num(ev[k].length), num(Math.max(...ev[k].map(e => e.months)))]));
            html += `<h2>Agreement and vegetation</h2>` + table(['Measure', 'Value'], [
                ['CHIRPS and TerraClimate, annual rainfall r', num(Dr.terraclimate.annual_ppt_corr_with_chirps.r, 2)],
                ['CHIRPS and TerraClimate, SPI-12 r', num(Dr.terraclimate.spi12_dec_corr.r, 2)],
                ['Greenness and rain, raw r', num(D.b.ndvi.raw.pearson_r, 2)], ['Greenness and rain, trends removed r', num(D.b.ndvi.detrended.pearson_r, 2)],
                ['Cells with a significant detrended link', share(D.bcells.ndvi_p_detrended.filter(p => p < 0.05).length / D.bcells.ndvi_p_detrended.filter(isNum).length)],
            ]);
        } else {
            const R = C.results.areas[S.area], REL = C.reliability.areas[S.area], ens = R.ensemble;
            html += `<h2>Uplift, ${AREA[S.area]}</h2>` + table(['Return period', 'SSP2-4.5 median', 'SSP2-4.5 5–95%', 'SSP5-8.5 median', 'SSP5-8.5 5–95%'], TRC.map(t => {
                const a = ens.ssp245.uplift[t].combined, b2 = ens.ssp585.uplift[t].combined;
                return [`${t}-year`, upct(a.median), `${upct(a.p05)} to ${upct(a.p95)}`, upct(b2.median), `${upct(b2.p05)} to ${upct(b2.p95)}`];
            }));
            html += `<p class="sec-note">The 5–95% range includes sampling from 30-year records as well as the models.</p>`;
            html += `<h2>Where the uncertainty comes from</h2>` + table(['Return period', 'Sampling', 'Models', 'Scenario', 'Distribution'], TRR.map(t => {
                const d = REL.decomposition[t]; return [`${t}-year`, share(d.sampling), share(d.model), share(d.scenario), share(d.distribution)];
            }));
            html += `<h2>Other measures</h2>` + table(['Measure', 'SSP2-4.5', 'SSP5-8.5'], [
                ['Mean of yearly wettest days', upct(ens.ssp245.rx1day_mean_ratio.models_median), upct(ens.ssp585.rx1day_mean_ratio.models_median)],
                ['Annual rainfall total', upct(ens.ssp245.total_ratio.models_median), upct(ens.ssp585.total_ratio.models_median)],
                ['Family-weighted 50-year uplift', upct(REL.ensemble.ssp245.gev_family_weighted[TRR.indexOf('50')]), upct(REL.ensemble.ssp585.gev_family_weighted[TRR.indexOf('50')])],
            ]);
            if (S.area === BASIN) html += `<p class="sec-note">Longest June–September dry spell: median change ${signed(ens.ssp585.dry50.models_median, 1)} days in a typical year under SSP5-8.5.</p>`;
        }
        $('#stats').innerHTML = html;
    }

    function renderCompare() {
        const C = D.c, R = C.results.areas[S.area], PF = C.reliability.areas[S.area].performance, fam = C.reliability.settings.families;
        const rows = Object.keys(R.models).map(m => {
            const u245 = R.models[m].ssp245.uplift[S.T], u585 = R.models[m].ssp585.uplift[S.T];
            return { m, f: fam[m] || '—', u245, u585, dry: R.models[m].ssp585.dry_spell_median_change, rl: PF[m] ? PF[m].rl25_ratio : NaN, season: PF[m] ? PF[m].season_r : NaN };
        }).sort((a, b) => b.u585 - a.u585);
        $('#compare').innerHTML = `<h2>${S.T}-year uplift by model</h2>
            <div class="seg seg-inline" id="cmp-t"></div>
            ${table(['Model', 'Family', 'SSP2-4.5', 'SSP5-8.5', 'Dry spell, SSP5-8.5 (days)', '25-yr vs CHIRPS', 'Season r'], rows.map(r => [H.esc(r.m), H.esc(r.f), upct(r.u245), upct(r.u585), S.area === BASIN ? signed(r.dry, 1) : '—', num(r.rl, 2), num(r.season, 2)]))}
            <p class="sec-note">Sorted by SSP5-8.5 uplift. Family is the atmospheric model family; models from one family share much of their physics. ${S.area === BOX_AREA ? 'Dry spells are shown for the basin only.' : ''}</p>`;
        seg($('#cmp-t'), TRC.map(t => [t, `${t}-year`]), S.T, v => { S.T = v; refresh(); });
    }

    // ---------- URL state ----------
    function writeURL() {
        const p = new URLSearchParams({ g: S.group, l: S.layer, a: S.area, y: S.year, s: S.scen, t: S.T, k: S.kind, b: S.basemap, tab: S.tab });
        if (S.cell != null) p.set('c', S.cell);
        history.replaceState(null, '', '#' + p.toString());
    }
    function readURL() {
        const p = new URLSearchParams(location.hash.slice(1));
        const v = (k, ok, d) => (p.has(k) && ok(p.get(k)) ? p.get(k) : d);
        const layers = Object.values(GROUPS).flatMap(g => g.layers.map(x => x[0]));
        S.layer = v('l', x => layers.includes(x), S.layer); S.group = layerGroup(S.layer);
        S.area = v('a', x => x === BOX_AREA || x === BASIN, S.area);
        if (GROUPS[S.group].area) S.area = GROUPS[S.group].area;
        S.year = +v('y', x => +x >= 1981 && +x <= 2024, S.year);
        S.scen = v('s', x => x === 'ssp245' || x === 'ssp585', S.scen);
        S.T = v('t', x => TRC.includes(x), S.T);
        S.kind = v('k', x => x === 'median' || x === 'p90', S.kind);
        S.basemap = v('b', x => x in H.BASEMAPS, S.basemap);
        S.tab = v('tab', x => ['overview', 'cell', 'series', 'stats', 'compare'].includes(x), S.tab);
        if (S.layer === 'dry') S.area = BASIN;
        const c = p.get('c'); S.cell = c != null && isNum(c) && +c >= 0 ? +c : null;
        if (S.cell != null && S.cell >= cellsOf().length) S.cell = null;
    }

    // ---------- chrome: data, share, dialogs ----------
    function wireChrome() {
        $$('[role="tab"]').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.tab); writeURL(); }));
        // arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern)
        const tabs = $$('[role="tab"]');
        tabs.forEach((b, i) => b.addEventListener('keydown', e => {
            const j = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
            if (j === undefined) return;
            e.preventDefault(); tabs[j].focus(); setTab(tabs[j].dataset.tab); writeURL();
        }));
        $('#seg-group') && $('#seg-group').setAttribute('aria-label', 'Layer group');
        $('#year').addEventListener('input', e => { S.year = +e.target.value + 1981; $('#year-out').textContent = S.year; refresh(); });
        let timer = null; const play = $('#year-play');
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } play.textContent = '▶'; play.setAttribute('aria-label', 'Play through the years'); };
        play.addEventListener('click', () => {
            if (timer) { stop(); return; }
            play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause');
            timer = setInterval(() => { const n = B().years.indexOf(+S.year) + 1; if (n >= B().years.length) { stop(); return; } S.year = B().years[n]; refresh(); }, H.reduced ? 1100 : 650);
        });
        $('#basemap-select').addEventListener('change', e => { S.basemap = e.target.value; setBasemap(S.basemap); writeURL(); });
        $('#btn-data').addEventListener('click', () => $('#dlg-data').showModal());
        $('#btn-methods').addEventListener('click', () => $('#dlg-methods').showModal());
        $('#btn-about').addEventListener('click', () => $('#dlg-about').showModal());
        $('#btn-share').addEventListener('click', () => H.copy(location.href, 'Link copied'));
        $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
    }

    // ---------- start ----------
    function fail(msg) { const n = $('#map-error'); n.hidden = false; n.textContent = msg; setTimeout(() => { n.hidden = true; }, 4000); }
    Promise.all([H.get('data/a.json'), H.get('data/b.json'), H.get('data/b_cells.json'), H.get('data/c.json'), H.get('data/cells.json')])
        .then(([a, b, bcells, c, cells]) => {
            Object.assign(D, { a, b, bcells, c, cells });
            map = L.map('map', { zoomControl: false, scrollWheelZoom: true, zoomSnap: .25 });
            readURL();
            fitArea();
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            setBasemap(S.basemap);
            H.cartography(map, 1);
            wireChrome();
            setTab(S.tab);
            refresh();
            addEventListener('hashchange', () => { readURL(); fitArea(); setTab(S.tab); refresh(); });
            let rz = null; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderPanel, 150); });
        })
        .catch(e => { console.error(e); fail('The data could not be loaded. Please reload the page.'); });
})();
