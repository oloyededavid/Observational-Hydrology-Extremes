/* Page logic for the floods, droughts and design-rainfall study, and its explorer.
   Every number and every statement of direction is computed here from data/site.json (written by
   tools/build_site_data.py from the analysis outputs); none is typed into the HTML. */
(function () {
    'use strict';

    // ---------- helpers ----------
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const isNum = v => v !== null && v !== undefined && Number.isFinite(Number(v));
    const num = (v, d) => {
        if (!isNum(v)) return '—';
        const r = Math.round(Number(v) * 10 ** d) / 10 ** d;
        return (r === 0 ? 0 : r).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−');
    };
    const fmtInt = v => num(v, 0);
    const fmt = (v, d = 1) => num(v, d);
    const signed = (v, d = 0) => (Math.round(v * 10 ** d) > 0 ? '+' : '') + num(v, d);
    const pct = u => signed((u - 1) * 100, 0) + '%';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const listing = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
    const AREA = { niger_benue: 'Lower Niger–Benue', sokoto_rima: 'Sokoto–Rima' };
    const SCEN = { ssp245: 'SSP2-4.5', ssp585: 'SSP5-8.5' };
    const SCOL = { ssp245: '#2f6fd6', ssp585: '#c2410c' };
    let D = null, GEO = null;

    // ---------- numbers in the text ----------
    function fill() {
        const C = D.part_c, R = D.part_b_rain;
        const A = a => C.areas[a], E = (a, s) => A(a).ensemble[s];
        const v = {};
        v.futPeriod = `${C.settings.future[0]}–${C.settings.future[1]}`;
        v.nbCells = A('niger_benue').n_cells; v.srCells = A('sokoto_rima').n_cells;
        const area = id => GEO.features.find(f => f.properties.id === id).properties;
        v.srArea = fmtInt(area('sokoto_rima').area_km2);
        v.nbArea = fmtInt(area('niger_benue').area_km2);
        // Part B
        v.srMean = fmtInt(R.mean_mm); v.srCv = fmtInt(R.cv * 100);
        v.srTrend = signed(R.trend_mm_per_decade); v.sumTrend = signed(R.trend_mm_per_decade);
        v.srTau = fmt(R.kendall_tau, 2); v.srTauP = R.kendall_p < 0.001 ? '< 0.001' : fmt(R.kendall_p, 3);
        const dry = R.years.filter(y => y.spi <= -1);
        const d80 = dry.filter(y => y.year < 1990);
        v.drought80s = `${d80.length} of the ${R.years.filter(y => y.year < 1990).length} years from 1981 to 1989 were drought years, ${listing(d80.filter(y => y.spi <= -2).map(y => `${y.year} (SPI ${fmt(y.spi, 1)})`))} extreme`;
        const since = dry.filter(y => y.year >= 2000);
        v.droughtYears = since.length ? `${since.length} (${listing(since.map(y => y.year))})` : 'none';
        const diff = R.years.filter(y => y.z_score_2000_2024 !== null && cls(y.z_score_2000_2024) !== y.class);
        v.classDiff = diff.length ? listing(diff.map(y => `${y.year}, which moves from ${cls(y.z_score_2000_2024)} (z = ${fmt(y.z_score_2000_2024, 2)}) to ${y.class} (SPI ${fmt(y.spi, 2)})`)) : 'none';
        // Part C headline: 50-year uplift in the Sokoto–Rima basin and Lower Niger–Benue under SSP5-8.5
        const u = (a, s, T = '50') => E(a, s).uplift[T];
        const hi = [u('niger_benue', 'ssp585'), u('sokoto_rima', 'ssp585')];
        v.sumUplift = `${fmt(Math.min(...hi.map(x => x.combined.median)), 2)}–${fmt(Math.max(...hi.map(x => x.combined.median)), 2)}`;
        v.sumUpliftText = `Median change in the 50-year daily rainfall by ${v.futPeriod} under high emissions (SSP5-8.5), across 23 models: ${pct(hi[0].combined.median)} on the Lower Niger–Benue, ${pct(hi[1].combined.median)} in the Sokoto–Rima basin. ${agreeWord(hi)}`;
        const dr = E('sokoto_rima', 'ssp585').dry90;
        const drAgree = Math.sign(dr.combined.p05) === Math.sign(dr.combined.p95);
        v.sumDry = drAgree ? `${signed(dr.combined.median, 1)} days` : 'No clear change';
        v.sumDryText = `in the longest dry spell of a 1-in-10 dry rainy season in the Sokoto–Rima basin by ${v.futPeriod} (SSP5-8.5): median ${signed(dr.combined.median, 1)} days, 5–95% range ${signed(dr.combined.p05, 1)} to ${signed(dr.combined.p95, 1)} days.${drAgree ? '' : ' The models do not agree on the direction.'}`;
        Object.assign(v, partCText());
        Object.assign(v, partABText());
        $$('[data-v]').forEach(el => { if (v[el.dataset.v] !== undefined) el.innerHTML = v[el.dataset.v]; });
        $$('.pill').forEach(p => p.classList.toggle('done', p.textContent === 'Computed'));
    }
    const cls = s => s <= -2 ? 'extreme drought' : s <= -1.5 ? 'severe drought' : s <= -1 ? 'moderate drought' : s < 1 ? 'near normal' : 'wet';
    function agreeWord(list) {
        const all = list.map(x => [x.models_above_1, D.part_c.areas.sokoto_rima.ensemble.ssp585.n_models]);
        return `${listing(all.map(([k, n]) => `${k} of ${n}`))} models project an increase.`;
    }

    // Part C sentences, phrased from the numbers
    function partCText() {
        const C = D.part_c, t = {};
        const models = Object.keys(C.areas.sokoto_rima.models);
        const bias = a => models.map(m => C.areas[a].models[m].historical.rl_bias_vs_chirps['25']).sort((x, y) => x - y);
        const med = arr => { const s = [...arr].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
        const g = models.flatMap(m => Object.values(C.areas.sokoto_rima.models[m].gauge_check || {}).map(x => x.rl25_ratio));
        const bN = bias('niger_benue'), bS = bias('sokoto_rima');
        const G = D.gauges, gv = Object.values(G);
        t.checkText = `Against CHIRPS for 1985–2014, the models' 25-year daily rainfall is ${fmt(med(bN), 2)} times CHIRPS's on the Lower Niger–Benue (range ${fmt(bN[0], 2)}–${fmt(bN[bN.length - 1], 2)}) and ${fmt(med(bS), 2)} times in the Sokoto–Rima basin (${fmt(bS[0], 2)}–${fmt(bS[bS.length - 1], 2)}). Against the two gauges, 1950–1980, the same models give ${fmt(med(g), 2)} times the gauges' value (${fmt(Math.min(...g), 2)}–${fmt(Math.max(...g), 2)}). The two references disagree: ${gv.map(x => `${x.name}'s median wettest day was ${fmtInt(median(Object.values(x.rx1day)))} mm`).join(' and ')}, against ${fmtInt(C.areas.sokoto_rima.chirps.return_levels['2'].median_cells)} mm for a typical CHIRPS cell. Part of that gap is real, because a 0.25° cell averages rain over about 750 km² and a gauge does not; part is CHIRPS understating heavy days. Absolute design values are therefore uncertain by tens of percent before any climate change, which is why the change is computed within each model.`;
        const T = ['25', '50', '100'];
        const line = (a, s) => T.map(x => { const u = C.areas[a].ensemble[s].uplift[x]; return `${x}-year ${pct(u.combined.median)} (${pct(u.combined.p05)} to ${pct(u.combined.p95)})`; }).join(', ');
        const up = (a, s, x = '50') => C.areas[a].ensemble[s].uplift[x];
        const u50 = (a, s) => up(a, s, '50'), n = C.areas.sokoto_rima.ensemble.ssp585.n_models;
        const say = a => `the median 50-year uplift is ${pct(u50(a, 'ssp245').combined.median)} under SSP2-4.5 and ${pct(u50(a, 'ssp585').combined.median)} under SSP5-8.5, with ${u50(a, 'ssp245').models_above_1} and ${u50(a, 'ssp585').models_above_1} of ${n} models projecting an increase`;
        t.changeText = `By ${C.settings.future[0]}–${C.settings.future[1]}, on the <strong>Lower Niger–Benue</strong> ${say('niger_benue')}. In the <strong>Sokoto–Rima basin</strong> ${say('sokoto_rima')}. The ranges are wide: for the 50-year value under SSP5-8.5 the 5–95% range runs from ${pct(u50('niger_benue', 'ssp585').combined.p05)} to ${pct(u50('niger_benue', 'ssp585').combined.p95)} on the Lower Niger–Benue and from ${pct(u50('sokoto_rima', 'ssp585').combined.p05)} to ${pct(u50('sokoto_rima', 'ssp585').combined.p95)} in the Sokoto–Rima basin (Figure ${figNo('fig-uplift')}; every return period in Table 2). ${nullWord()}`;
        const rx = a => C.areas[a].ensemble, tr = (a, s) => pct(rx(a)[s].total_ratio.models_median);
        t.physText = `The rise is in the data, not only in the fitted curves: the plain average of each year's wettest day, which needs no curve fitting, rises by a median ${pct(rx('niger_benue').ssp585.rx1day_mean_ratio.models_median)} on the Lower Niger–Benue and ${pct(rx('sokoto_rima').ssp585.rx1day_mean_ratio.models_median)} in the Sokoto–Rima basin under SSP5-8.5, while annual rainfall changes by ${tr('niger_benue', 'ssp585')} and ${tr('sokoto_rima', 'ssp585')}. The wettest days grow much faster than the yearly total. That is more than the roughly 7% per °C of warming expected because warmer air holds more water <span class="cite">(Trenberth et al., 2003)</span>. Whether the extra comes from the models' physics or from the statistical downscaling cannot be told from these data; if it is the downscaling, these uplift factors overstate the models' own signal. It is the largest unresolved uncertainty in Part C.`;
        const dy = (s, k) => C.areas.sokoto_rima.ensemble[s][k];
        const c = C.areas.sokoto_rima.chirps;
        t.dryText = `In CHIRPS, the longest June–September dry spell in a typical year is ${fmtInt(c.dry_spell_median)} days per cell, and ${fmtInt(c.dry_spell_p90)} days in a 1-in-10 dry season. By ${C.settings.future[0]}–${C.settings.future[1]} the models change the typical spell by ${signed(dy('ssp245', 'dry50').combined.median, 1)} days under SSP2-4.5 and ${signed(dy('ssp585', 'dry50').combined.median, 1)} under SSP5-8.5, and the 1-in-10 spell by ${signed(dy('ssp245', 'dry90').combined.median, 1)} and ${signed(dy('ssp585', 'dry90').combined.median, 1)} days (5–95%: ${signed(dy('ssp585', 'dry90').combined.p05, 1)} to ${signed(dy('ssp585', 'dry90').combined.p95, 1)} under SSP5-8.5). Annual rainfall changes by a median ${pct(C.areas.sokoto_rima.ensemble.ssp585.total_ratio.models_median)} under SSP5-8.5 (models' 10–90%: ${pct(C.areas.sokoto_rima.ensemble.ssp585.total_ratio.models_p10)} to ${pct(C.areas.sokoto_rima.ensemble.ssp585.total_ratio.models_p90)}).`;
        const all = ['niger_benue', 'sokoto_rima'].flatMap(a => ['ssp245', 'ssp585'].map(s => up(a, s)));
        const lo = Math.min(...all.map(x => x.combined.median)), hi = Math.max(...all.map(x => x.combined.median));
        const p95 = Math.max(...all.map(x => x.combined.p95));
        t.discText = `For a drain or culvert to be built now and still working in ${C.settings.future[0]}–${C.settings.future[1]}, the models point to scaling today's 50-year daily rainfall by ×${fmt(lo, 2)}–${fmt(hi, 2)} at the median, depending on the area and scenario. The spread between models is as large as the median change, so the choice within the range is a question of how costly failure would be: where it is, the upper part of the range (up to ×${fmt(p95, 2)} at the 95th percentile) deserves as much weight as the median. The factor should be applied to a design value from a local gauge record where one exists, not to CHIRPS: it is the ratio that the models inform, not the absolute rainfall. In the Sokoto–Rima basin, the same projections that raise extreme days ${Math.sign(dy('ssp585', 'dry90').combined.p05) === Math.sign(dy('ssp585', 'dry90').combined.p95) ? 'also change' : 'do not agree on'} the length of rainy-season dry spells, which matters for small reservoirs and rain-fed crops.`;
        t.conclText = `Measured instead of typed in, the Lower Niger–Benue flood rise is real but modest, and visible only once dry ground is masked out; drought years in the Sokoto–Rima basin are clear, and vegetation follows each year's rain even with the trend removed. The climate models add a median design uplift for 50-year daily rainfall of ×${fmt(lo, 2)}–${fmt(hi, 2)} by ${C.settings.future[0]}–${C.settings.future[1]}, with a spread between models that a designer must carry, not ignore. The weakest link is the present, not the future: without modern rain-gauge records the absolute design rainfall in both basins is uncertain by tens of percent. Opening Nigeria's station records would do more for design here than any further model run.`;
        return t;
    }
    function nullWord() {
        const n = D.part_c.areas, a = n.niger_benue.null_test['50'], b = n.sokoto_rima.null_test['50'];
        return `As a check, comparing each model's own two historical periods (1985–2014 against 1950–1980), where no large change is expected, gives 50-year ratios of ${fmt(a.min, 2)}–${fmt(a.max, 2)} on the Lower Niger–Benue and ${fmt(b.min, 2)}–${fmt(b.max, 2)} in the Sokoto–Rima basin, with medians of ${fmt(a.median, 2)} and ${fmt(b.median, 2)}. A single model's ratio is therefore largely chance; the median over 23 models is the signal.`;
    }
    const median = a => { const s = [...a].map(Number).sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

    // ---------- SVG helpers ----------
    const NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text !== undefined) e.textContent = text; return e; }
    function width(node, min = 320, max = 1180) { return Math.max(min, Math.min(max, Math.round(node.getBoundingClientRect().width || 720))); }
    function seg(node, options, current, onPick) {
        node.innerHTML = '';
        options.forEach(([val, label]) => {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.val = val;
            b.setAttribute('aria-pressed', String(val === current));
            b.addEventListener('click', () => { $$('button', node).forEach(x => x.setAttribute('aria-pressed', String(x === b))); onPick(val); });
            node.append(b);
        });
    }

    // ---------- Figure 4: SPI ----------
    const SPI_COL = { 'extreme drought': '#7f2704', 'severe drought': '#c2410c', 'moderate drought': '#f59e0b', 'near normal': '#c7c7c2', 'wet': '#2f6fd6' };
    function renderSpi() {
        const box = $('#spichart'), R = D.part_b_rain.years, W = width(box), H = 300, m = { l: 44, r: 8, t: 12, b: 30 };
        const x = i => m.l + (i + 0.5) * (W - m.l - m.r) / R.length, bw = Math.max(3, (W - m.l - m.r) / R.length - 3);
        const lo = Math.min(-4, ...R.map(r => r.spi)), hi = Math.max(2.5, ...R.map(r => r.spi));
        const y = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b);
        const s = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Bar chart of the Standardized Precipitation Index, ${R[0].year}–${R[R.length - 1].year}; drought years are ${R.filter(r => r.spi <= -1).map(r => r.year).join(', ')}` });
        [-3, -2, -1, 0, 1, 2].forEach(v => {
            s.append(el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v === 0 ? 'ax0' : v === -1 ? 'axd' : 'grid' }));
            s.append(el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, num(v, 0)));
        });
        R.forEach((r, i) => {
            const g = el('g', { class: 'bar', tabindex: 0 });
            g.append(el('rect', { class: r.spi >= 0 ? 'pos' : 'neg', style: `animation-delay:${i * 18}ms`, x: x(i) - bw / 2, width: bw, y: Math.min(y(0), y(r.spi)), height: Math.max(1, Math.abs(y(r.spi) - y(0))), fill: SPI_COL[r.class], rx: 1.5 }));
            g.append(el('title', {}, `${r.year}: ${fmtInt(r.rain_mm)} mm, SPI ${fmt(r.spi, 2)} (${r.class})`));
            s.append(g);
            if (r.year % (W < 560 ? 10 : 5) === 0) s.append(el('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', class: 'tick' }, r.year));
        });
        s.append(el('text', { x: W - m.r, y: y(-1) - 5, 'text-anchor': 'end', class: 'note' }, 'drought below −1'));
        box.innerHTML = ''; box.append(s);
        $('#spi-key').innerHTML = Object.entries(SPI_COL).map(([k, c]) => `<li><i style="background:${c}"></i><span>${k[0].toUpperCase() + k.slice(1)}</span></li>`).join('');
    }

    // ---------- dot-strip chart used by Figures 6-8 ----------
    // rows: [{label, sub, dots:[{v, color, open, title}], band:[lo,hi], mid, bandColor}]
    function strip(box, rows, { domain, ref, fmtTick = v => fmt(v, 2), label, aria, rowH = 34 }) {
        // On narrow screens the row labels sit above each row, so the dots get the full width.
        const W = width(box), narrow = W < 560, lw = narrow ? 8 : 170, top = narrow ? 30 : 0;
        rowH = rowH + top;
        const m = { l: lw, r: 16, t: 10, b: 40 }, H = m.t + m.b + rows.length * rowH;
        const x = v => m.l + (v - domain[0]) / (domain[1] - domain[0]) * (W - m.l - m.r);
        const s = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': aria });
        const ticks = niceTicks(domain[0], domain[1], W < 560 ? 4 : 7);
        ticks.forEach(v => { s.append(el('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b, class: 'grid' })); s.append(el('text', { x: x(v), y: H - m.b + 16, 'text-anchor': 'middle', class: 'tick' }, fmtTick(v))); });
        if (ref !== undefined) s.append(el('line', { x1: x(ref), x2: x(ref), y1: m.t, y2: H - m.b, class: 'ax0' }));
        s.append(el('text', { x: m.l + (W - m.l - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axlab' }, label));
        rows.forEach((r, i) => {
            const y0 = m.t + i * rowH, cy = y0 + top + (rowH - top) / 2;
            if (i) s.append(el('line', { x1: 0, x2: W - m.r, y1: y0, y2: y0, class: 'rowline' }));
            if (narrow) {
                s.append(el('text', { x: 0, y: y0 + 14, class: 'rowlab' }, r.label + (r.sub ? ' · ' : '')));
                if (r.sub) { const t = s.lastChild; t.append(el('tspan', { class: 'rowsub' }, r.sub)); }
            } else {
                s.append(el('text', { x: 0, y: cy + (r.sub ? -1 : 4), class: 'rowlab' }, r.label));
                if (r.sub) s.append(el('text', { x: 0, y: cy + 13, class: 'rowsub' }, r.sub));
            }
            if (r.band) s.append(el('rect', { x: x(r.band[0]), width: Math.max(1, x(r.band[1]) - x(r.band[0])), y: cy - 9, height: 18, fill: r.bandColor, opacity: 0.16, rx: 3 }));
            r.dots.forEach((d, j) => {
                const jit = r.dots.length > 4 ? ((j * 7) % 11 - 5) * 1.1 : 0;
                const c = el('circle', { style: `transition-delay:${Math.min(700, (i * r.dots.length + j) * 12)}ms`, cx: x(Math.max(domain[0], Math.min(domain[1], d.v))), cy: cy + jit, r: d.open ? 4 : 3.6, fill: d.open ? 'var(--bg)' : d.color, stroke: d.color, 'stroke-width': d.open ? 1.6 : 0.8, 'fill-opacity': d.open ? 1 : 0.8 });
                c.append(el('title', {}, d.title)); s.append(c);
            });
            if (isNum(r.mid)) s.append(el('line', { x1: x(r.mid), x2: x(r.mid), y1: cy - 11, y2: cy + 11, stroke: 'var(--ink)', 'stroke-width': 2.4 }));
        });
        box.innerHTML = ''; box.append(s);
    }
    function niceTicks(a, b, n) {
        const step0 = (b - a) / n, p = 10 ** Math.floor(Math.log10(step0)), step = [1, 2, 2.5, 5, 10].map(k => k * p).find(k => k >= step0);
        const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step);
        return out;
    }
    const pad = (lo, hi, k = 0.06) => [lo - (hi - lo) * k, hi + (hi - lo) * k];

    // ---------- Figure 6: model check ----------
    const S = { check: 'sokoto_rima', upArea: 'sokoto_rima', upT: '50' };
    function renderCheck() {
        const A = D.part_c.areas[S.check], names = Object.keys(A.models);
        const rows = names.map(m => {
            const M = A.models[m], dots = [{ v: M.historical.rl_bias_vs_chirps['25'], color: '#111', title: `${m}: ${fmt(M.historical.rl_bias_vs_chirps['25'], 2)} × CHIRPS` }];
            Object.entries(M.gauge_check || {}).forEach(([sid, gc]) => dots.push({ v: gc.rl25_ratio, color: '#c2410c', open: true, title: `${m}: ${fmt(gc.rl25_ratio, 2)} × ${D.gauges[sid].name} gauge, 1950–1980` }));
            return { label: m, dots, key: M.historical.rl_bias_vs_chirps['25'] };
        }).sort((a, b) => a.key - b.key);
        const vals = rows.flatMap(r => r.dots.map(d => d.v));
        strip($('#checkchart'), rows, { domain: pad(Math.min(0.3, ...vals), Math.max(1.8, ...vals)), ref: 1, label: '25-year daily rainfall, model ÷ reference', aria: `Dot chart: each model's 25-year daily rainfall divided by CHIRPS${S.check === 'sokoto_rima' ? ' (filled) and by the two gauges (open)' : ''}, ${AREA[S.check]}`, rowH: 22 });
    }

    // ---------- Figure 7: uplift ----------
    function renderUplift() {
        const A = D.part_c.areas[S.upArea], T = S.upT;
        const rows = ['ssp245', 'ssp585'].map(s => {
            const E = A.ensemble[s].uplift[T];
            return { label: SCEN[s], sub: `median ${pct(E.combined.median)}, ${E.models_above_1} of ${A.ensemble[s].n_models} models up`, band: [E.combined.p05, E.combined.p95], bandColor: SCOL[s], mid: E.combined.median,
                dots: Object.entries(A.models).filter(([, M]) => M[s]).map(([m, M]) => ({ v: M[s].uplift[T], color: SCOL[s], title: `${m}: ×${fmt(M[s].uplift[T], 2)}` })) };
        });
        const vals = rows.flatMap(r => [...r.dots.map(d => d.v), ...r.band]);
        strip($('#upchart'), rows, { domain: pad(Math.min(0.8, ...vals), Math.max(1.3, ...vals)), ref: 1, fmtTick: v => '×' + fmt(v, 1), label: `Uplift factor, ${T}-year daily rainfall`, aria: `Dot chart of uplift factors for the ${T}-year daily rainfall, ${AREA[S.upArea]}, by scenario`, rowH: 70 });
    }

    // ---------- Figure 8: dry spells ----------
    function renderDry() {
        const A = D.part_c.areas.sokoto_rima, rows = [];
        [['dry50', 'dry_spell_median_change', 'Typical year'], ['dry90', 'dry_spell_p90_change', '1-in-10 dry year']].forEach(([k, mk, lab]) => ['ssp245', 'ssp585'].forEach(s => {
            const E = A.ensemble[s][k];
            rows.push({ label: lab, sub: SCEN[s], band: [E.combined.p05, E.combined.p95], bandColor: SCOL[s], mid: E.combined.median,
                dots: Object.entries(A.models).filter(([, M]) => M[s]).map(([m, M]) => ({ v: M[s][mk], color: SCOL[s], title: `${m}: ${signed(M[s][mk], 1)} days` })) });
        }));
        const vals = rows.flatMap(r => [...r.dots.map(d => d.v), ...r.band]);
        strip($('#drychart'), rows, { domain: pad(Math.min(-2, ...vals), Math.max(2, ...vals)), ref: 0, fmtTick: v => signed(v, 0), label: 'Change in longest June–September dry spell, days', aria: 'Dot chart of the change in the longest rainy-season dry spell, Sokoto–Rima basin, by scenario', rowH: 46 });
    }

    // ---------- Table 2 ----------
    function renderDesign() {
        const C = D.part_c, rows = [];
        ['niger_benue', 'sokoto_rima'].forEach(a => ['25', '50', '100'].forEach((T, i) => {
            const base = C.areas[a].chirps.return_levels[T].median_cells;
            const cell = s => { const d = C.areas[a].ensemble[s].design_rainfall[T]; return `${fmtInt(d.future_mm_median)} <span class="rng">${fmtInt(d.future_mm_p05)}–${fmtInt(d.future_mm_p95)}</span>`; };
            rows.push(`<tr${i === 0 ? ' class="grp"' : ''}><td class="text">${i === 0 ? AREA[a] : ''}</td><td>${T} years</td><td>${fmtInt(base)}</td><td>${cell('ssp245')}</td><td>${cell('ssp585')}</td></tr>`);
        }));
        $('#design-table tbody').innerHTML = rows.join('');
    }

    // ---------- Parts A and B, recomputed ----------
    const figNo = id => { const b = document.querySelector(`#${id} figcaption b`); return b ? b.textContent.replace(/\D/g, '') : '?'; };
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function partABText() {
        const A = D.part_a, B = D.part_b_ndvi, t = {};
        const M = A.monthly, fp = m => M.filter(r => r.month === m).map(r => r.flood_floodplain_km2);
        const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
        const base = median(M.filter(r => r.month <= 8 || r.month === 12).map(r => r.flood_floodplain_km2));
        const years = [...new Set(M.map(r => r.year))];
        const peaks = years.map(y => M.filter(r => r.year === y).reduce((a, b) => b.flood_floodplain_km2 > a.flood_floodplain_km2 ? b : a));
        const top = peaks.reduce((a, b) => b.flood_floodplain_km2 > a.flood_floodplain_km2 ? b : a);
        const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const pm = [...new Set(peaks.map(p => p.month))].sort((a, b) => a - b).map(m => FULL[m - 1]);
        const out = m => mean(M.filter(r => r.month === m).map(r => r.dark_outside_floodplain_km2));
        const nimg = M.reduce((a, r) => a + r.n_images, 0);
        t.aCurveText = `Measured month by month from ${fmtInt(nimg)} Sentinel-1 images, 2018–2023, water inside the floodplain (${fmtInt(A.floodplain_km2)} km², ground JRC has seen flooded at least once since 1984) sits near ${fmtInt(base)} km² from December to August and rises every year to a peak in ${pm.join(' or ')}: ${fmtInt(mean(fp(10)))} km² on average in October, and ${fmtInt(top.flood_floodplain_km2)} km² at most (${MON[top.month - 1]} ${top.year}). The typed-in curve of the report rose to 1,400 km². The same −18 dB threshold also marks ${fmtInt(out(3))} km² of dry ground outside the floodplain as water in March on average, against ${fmtInt(out(10))} km² in October: dry, bare or burnt ground can return as little radar signal as water. Counted everywhere, the "flood" would be largest in the dry season, so areas from this method mean flooding only inside a floodplain mask.`;
        const j = A.jrc.dry_season_vs_occurrence50, w = A.jrc.wet_season_ever_vs_max_extent;
        t.aJrcText = `Measured here, Sentinel-1 dry-season water covers ${fmt(j.recall * 100, 0)}% of the water JRC maps at least half the time (recall), but only ${fmt(j.precision * 100, 0)}% of what Sentinel-1 calls water is JRC water (precision); for the wet season the figures are ${fmt(w.recall * 100, 0)}% and ${fmt(w.precision * 100, 0)}%. Sentinel-1 finds almost all of JRC's water and much more besides, largely the dry ground described above, so the report's "2,497 km² of hidden inundation" cannot be read as flooding.`;
        const p = v => v < 0.001 ? '< 0.001' : fmt(v, 3);
        t.bNdviText = `The report found that annual MODIS NDVI follows rainfall (<var>r</var> = 0.594) and called it proof of coupling, but both series rise over the period, rainfall with the Sahel recovery and vegetation with the region's re-greening <span class="cite">(Dardel et al., 2014)</span>, and a shared trend alone can produce a correlation. Recomputed with quality-screened MODIS NDVI for the July–October growing season, ${B.years[0]}–${B.years[1]}, greenness and rainfall correlate at <var>r</var> = ${fmt(B.raw.pearson_r, 2)} (<var>p</var> ${p(B.raw.pearson_p)}). With each series' straight-line trend removed, <var>r</var> = ${fmt(B.detrended.pearson_r, 2)} (<var>p</var> ${p(B.detrended.pearson_p)}), and on year-to-year differences <var>r</var> = ${fmt(B.differenced.pearson_r, 2)} (<var>p</var> ${p(B.differenced.pearson_p)}) (Figure ${figNo('fig-ndvi')}). The link is not an artefact of the trend: in wetter years the basin is greener. It is still a correlation, and says nothing by itself about how much greening rainfall causes.`;
        t.ndviFilled = String(Object.values(B.filled_composites || {}).reduce((a, v) => a + v.length, 0));
        return t;
    }

    // Figure: flood map with image overlays
    function initFloodMap() {
        const S0 = D.part_a.settings.box, bounds = [[S0[1], S0[0]], [S0[3], S0[2]]];
        const map = L.map('flood-map', { scrollWheelZoom: false, zoomSnap: 0.25 });
        map.fitBounds(bounds, { padding: [8, 8] });
        basemap(map);
        cartography(map, 0.5);
        L.rectangle(bounds, { color: '#111', weight: 1.2, fill: false, interactive: false }).addTo(map);
        const plain = L.imageOverlay('data/part_a/floodplain.png', bounds, { opacity: 1, className: 'overlay' }).addTo(map);
        const layers = { freq: 'data/part_a/frequency.png', feb: 'data/part_a/water_2022-02.png', oct: 'data/part_a/water_2022-10.png' };
        let ov = null, cur = 'freq';
        const FREQ = [[0, 0, '#dfebf7', '1–10% of images'], [0, 0, '#9ecae1', '10–25%'], [0, 0, '#4292c6', '25–50%'], [0, 0, '#08519c', '50–75%'], [0, 0, '#08306b', '75–100%'], [0, 0, 'rgba(120,120,112,0.35)', 'Floodplain (JRC, 1984–2020)']];
        const WATER = [[0, 0, '#1f56b0', 'Water outside permanent water'], [0, 0, '#111111', 'Permanent water (JRC ≥ 90%)'], [0, 0, 'rgba(120,120,112,0.35)', 'Floodplain (JRC, 1984–2020)']];
        const draw = () => {
            if (ov) ov.remove();
            ov = L.imageOverlay(layers[cur], bounds, { className: 'overlay' }).addTo(map);
            $('#fm-legend').innerHTML = cur === 'freq'
                ? legendHtml('How often water, August–November', 'Share of Sentinel-1 images, 2018–2023, VH below −18 dB, slope under 5°', FREQ)
                : legendHtml(`Water, ${cur === 'feb' ? 'February' : 'October'} 2022`, `Median of the month's Sentinel-1 images, VH below −18 dB, slope under 5°`, WATER);
        };
        seg($('#fm-layer'), [['freq', 'Flood frequency 2018–2023'], ['feb', 'February 2022 (dry)'], ['oct', 'October 2022 (flood)']], cur, v => { cur = v; draw(); });
        draw();
        new ResizeObserver(() => map.invalidateSize()).observe($('#flood-map'));
    }

    // Figure: monthly flood curve
    const FC = { year: 'all' };
    function renderFloodCurve() {
        const box = $('#floodchart'), M = D.part_a.monthly, W = width(box), H = 330, m = { l: 52, r: 14, t: 28, b: 34 };
        const years = [...new Set(M.map(r => r.year))];
        const x = mo => m.l + (mo - 0.5) / 12 * (W - m.l - m.r);
        const sel = FC.year === 'all' ? M : M.filter(r => r.year === +FC.year);
        const by = (mo, k) => M.filter(r => r.month === mo).map(r => r[k]);
        const hi = Math.max(...M.map(r => Math.max(r.flood_floodplain_km2, r.dark_outside_floodplain_km2)));
        const top = niceTicks(0, hi, 5).slice(-1)[0] < hi ? niceTicks(0, hi * 1.15, 5).slice(-1)[0] : niceTicks(0, hi, 5).slice(-1)[0];
        const y = v => m.t + (1 - v / top) * (H - m.t - m.b);
        const s = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Monthly water area inside and outside the floodplain, ${FC.year === 'all' ? '2018–2023' : FC.year}` });
        niceTicks(0, top, 5).forEach(v => { s.append(el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid' })); s.append(el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, fmtInt(v))); });
        MON.forEach((n, i) => s.append(el('text', { x: x(i + 1), y: H - 12, 'text-anchor': 'middle', class: 'tick' }, W < 560 ? n[0] : n)));
        s.append(el('text', { x: m.l - 6, y: 12, 'text-anchor': 'end', class: 'tick' }, 'km²'));
        const line = (pts, col, dash) => s.append(el('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(''), fill: 'none', stroke: col, 'stroke-width': 2.2, 'stroke-dasharray': dash || '', class: 'ch-line' }));
        const mos = [...Array(12)].map((_, i) => i + 1);
        if (FC.year === 'all') {
            const lo = mos.map(mo => Math.min(...by(mo, 'flood_floodplain_km2'))), up = mos.map(mo => Math.max(...by(mo, 'flood_floodplain_km2')));
            s.append(el('path', { d: mos.map((mo, i) => `${i ? 'L' : 'M'}${x(mo)},${y(up[i])}`).join('') + mos.slice().reverse().map((mo, i) => `L${x(mo)},${y(lo[11 - i])}`).join('') + 'Z', fill: '#2f6fd6', opacity: 0.14 }));
        }
        const avg = (mo, k) => { const v = sel.filter(r => r.month === mo).map(r => r[k]); return v.reduce((a, b) => a + b, 0) / v.length; };
        line(mos.map(mo => [mo, avg(mo, 'dark_outside_floodplain_km2')]), '#9a9a93', '5 4');
        line(mos.map(mo => [mo, avg(mo, 'flood_floodplain_km2')]), '#1f56b0');
        mos.forEach(mo => {
            const r = sel.filter(q => q.month === mo), v = avg(mo, 'flood_floodplain_km2'), n = r.reduce((a, q) => a + q.n_images, 0);
            const c = el('circle', { cx: x(mo), cy: y(v), r: 4, fill: '#1f56b0', stroke: '#fff', 'stroke-width': 1.2 });
            c.append(el('title', {}, `${MON[mo - 1]}${FC.year === 'all' ? ' (mean of 2018–2023)' : ' ' + FC.year}: ${fmtInt(v)} km² in the floodplain, ${fmtInt(avg(mo, 'dark_outside_floodplain_km2'))} km² outside; ${n} images`));
            s.append(c);
        });
        box.innerHTML = ''; box.append(s);
        $('#fc-key').innerHTML = `<li><i style="background:#1f56b0"></i><span>Water inside the floodplain</span></li>${FC.year === 'all' ? '<li><i style="background:rgba(47,111,214,0.25)"></i><span>Range of the six years</span></li>' : ''}<li><i style="background:#9a9a93"></i><span>Dry ground counted as water outside it</span></li>`;
    }

    // Figure: NDVI and rainfall
    const ND = { mode: 'raw' };
    function renderNdvi() {
        const box = $('#ndvichart'), B = D.part_b_ndvi, R = D.part_b_rain, W = width(box), H = 300, m = { l: 40, r: 14, t: 12, b: 32 };
        const yrs = Object.keys(B.ndvi_growing_season).map(Number);
        const rain = yrs.map(y => R.years.find(r => r.year === y).rain_mm), veg = yrs.map(y => B.ndvi_growing_season[y]);
        const prep = a => {
            let v = [...a];
            if (ND.mode === 'detrended') { const n = v.length, xm = (n - 1) / 2, ym = v.reduce((p, q) => p + q, 0) / n; let sxy = 0, sxx = 0; v.forEach((q, i) => { sxy += (i - xm) * (q - ym); sxx += (i - xm) ** 2; }); const b = sxy / sxx; v = v.map((q, i) => q - ym - b * (i - xm)); }
            const mu = v.reduce((p, q) => p + q, 0) / v.length, sd = Math.sqrt(v.reduce((p, q) => p + (q - mu) ** 2, 0) / (v.length - 1));
            return v.map(q => (q - mu) / sd);
        };
        const zr = prep(rain), zv = prep(veg), lim = Math.ceil(Math.max(2.5, ...zr.map(Math.abs), ...zv.map(Math.abs)));
        const x = i => m.l + (i + 0.5) / yrs.length * (W - m.l - m.r), y = v => m.t + (lim - v) / (2 * lim) * (H - m.t - m.b);
        const s = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Standard scores of growing-season NDVI and annual rainfall, ${yrs[0]}–${yrs[yrs.length - 1]}, ${ND.mode === 'raw' ? 'as measured' : 'trend removed'}` });
        for (let v = -lim; v <= lim; v++) { s.append(el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v === 0 ? 'ax0' : 'grid' })); s.append(el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, num(v, 0))); }
        yrs.forEach((yr, i) => { if (yr % (W < 560 ? 10 : 5) === 0) s.append(el('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', class: 'tick' }, yr)); });
        const path = (z, col) => s.append(el('path', { d: z.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(''), fill: 'none', stroke: col, 'stroke-width': 2.2, class: 'ch-line' }));
        path(zr, '#2f6fd6'); path(zv, '#2e7d32');
        yrs.forEach((yr, i) => {
            const a = el('circle', { cx: x(i), cy: y(zr[i]), r: 3.4, fill: '#2f6fd6' }); a.append(el('title', {}, `${yr}: rainfall ${fmtInt(rain[i])} mm (score ${fmt(zr[i], 1)})`)); s.append(a);
            const b = el('rect', { x: x(i) - 3.4, y: y(zv[i]) - 3.4, width: 6.8, height: 6.8, fill: '#2e7d32' }); b.append(el('title', {}, `${yr}: NDVI ${fmt(veg[i], 3)} (score ${fmt(zv[i], 1)})`)); s.append(b);
        });
        box.innerHTML = ''; box.append(s);
        const r = ND.mode === 'raw' ? B.raw : B.detrended;
        $('#nd-key').innerHTML = `<li><i style="background:#2f6fd6;border-radius:50%"></i><span>Annual rainfall (CHIRPS)</span></li><li><i style="background:#2e7d32"></i><span>Growing-season NDVI (MODIS)</span></li><li><span class="small">r = ${fmt(r.pearson_r, 2)}</span></li>`;
    }

    // ---------- Figure 1: study map ----------
    function basemap(map) {
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 12, attribution: 'Basemap © Esri' }).addTo(map);
    }
    function initStudyMap() {
        const map = L.map('study-map', { scrollWheelZoom: false, zoomSnap: 0.25 });
        map.fitBounds(L.geoJSON(GEO).getBounds(), { padding: [16, 16] }); // a map needs a view before vector layers are added
        basemap(map);
        cartography(map, 2);
        const cells = D.cells || null;
        const gj = L.geoJSON(GEO, { style: f => ({ color: f.properties.id === 'sokoto_rima' ? '#2f6fd6' : '#c2410c', weight: 2, fillOpacity: 0.08 }) })
            .bindTooltip(l => l.feature.properties.name, { sticky: true }).addTo(map);
        if (cells) Object.entries(cells).forEach(([a, c]) => c.cells.forEach(([lon, lat]) => L.rectangle([[lat - 0.125, lon - 0.125], [lat + 0.125, lon + 0.125]], { color: a === 'sokoto_rima' ? '#2f6fd6' : '#c2410c', weight: 0.4, opacity: 0.5, fillOpacity: 0, interactive: false }).addTo(map)));
        GEO.features.forEach(f => L.marker(L.geoJSON(f).getBounds().getCenter(), { icon: L.divIcon({ className: 'no-icon', html: '', iconSize: [0, 0] }), interactive: false, keyboard: false })
            .bindTooltip(f.properties.id === 'sokoto_rima' ? 'Sokoto–Rima basin' : 'Lower Niger–Benue reach', { permanent: true, direction: f.properties.id === 'sokoto_rima' ? (innerWidth >= 700 ? 'center' : 'left') : 'right', className: 'map-label area-label' }).addTo(map));
        Object.values(D.gauges).forEach(g => L.circleMarker([g.lat, g.lon], { radius: 6, color: '#111', weight: 2, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(`${g.name} gauge, 1950–1980`, { permanent: innerWidth >= 700, direction: 'right', className: 'map-label' }).addTo(map));
        map.fitBounds(gj.getBounds(), { padding: [16, 16] });
        new ResizeObserver(() => map.invalidateSize()).observe($('#study-map'));
    }


    // ---------- cell maps (Figures 5 and 8, and the explorer) ----------
    // Discrete classes, so each colour on the map matches one labelled step in the legend.
    const SPI_CLASSES = [[-Infinity, -2, '#7f2704', '≤ −2 extreme'], [-2, -1.5, '#c2410c', '−2 to −1.5 severe'], [-1.5, -1, '#f59e0b', '−1.5 to −1 moderate'],
        [-1, 1, '#e8e6e1', '−1 to 1 near normal'], [1, 1.5, '#9fc5e8', '1 to 1.5'], [1.5, 2, '#4a8fd1', '1.5 to 2'], [2, Infinity, '#1f56b0', '≥ 2 very wet']];
    const UP_CLASSES = [[-Infinity, 0.9, '#8c510a', '< 0.90'], [0.9, 1.0, '#dfc27d', '0.90–1.00'], [1.0, 1.1, '#e8e6e1', '1.00–1.10'], [1.1, 1.2, '#c6dbef', '1.10–1.20'],
        [1.2, 1.3, '#9fc5e8', '1.20–1.30'], [1.3, 1.5, '#4a8fd1', '1.30–1.50'], [1.5, Infinity, '#1f56b0', '≥ 1.50']];
    const SEQ_BLUE = ['#eef4fd', '#c9dcf6', '#9cc0ee', '#6a9fe2', '#3f7dd2', '#2459ab', '#173b78'];
    const SEQ_ORANGE = ['#fff5eb', '#fdd8b0', '#fdb57a', '#f8904b', '#e8682a', '#c2410c', '#7f2704'];
    // equal-interval classes on rounded breaks for a sequential layer
    function seqClasses(vals, ramp, unit, d = 0) {
        const ok = vals.filter(isNum), lo = Math.min(...ok), hi = Math.max(...ok);
        const step = niceTicks(lo, hi, ramp.length)[1] - niceTicks(lo, hi, ramp.length)[0] || (hi - lo) / ramp.length || 1;
        const start = Math.floor(lo / step) * step, out = [];
        for (let k = 0; start + k * step <= hi && k < 12; k++) out.push([start + k * step, start + (k + 1) * step, null, `${num(start + k * step, d)}–${num(start + (k + 1) * step, d)}${unit}`]);
        out.forEach((c, k) => { c[2] = ramp[Math.round(k * (ramp.length - 1) / Math.max(1, out.length - 1))]; });
        out[out.length - 1][1] = Infinity;
        return out;
    }
    const classOf = (v, classes) => isNum(v) ? (classes.find(c => v >= c[0] && v < c[1]) || classes[classes.length - 1])[2] : '#ccc';
    function legendHtml(title, sub, classes) {
        return `<div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}<ul class="lg-classes">${classes.map(c => `<li><i style="background:${c[2]}"></i>${c[3]}</li>`).join('')}</ul>`;
    }
    // Rectangles are created once per map and area and then restyled, so colour changes fade (CSS transition).
    function cellLayer(map, cells, values, classes, tip, onClick, selected, prev) {
        if (prev && prev._cells === cells) {
            let k = 0;
            prev.eachLayer(r => { const i = k++; r.setStyle({ color: i === selected ? '#111' : '#fff', weight: i === selected ? 2 : 0.4, fillColor: classOf(values[i], classes) }); r.setTooltipContent(tip(values[i], i)); r._onPick = onClick; });
            return prev;
        }
        if (prev) prev.remove();
        const g = L.layerGroup(cells.map(([lon, lat], i) => {
            const r = L.rectangle([[lat - 0.125, lon - 0.125], [lat + 0.125, lon + 0.125]], { className: 'cell', color: i === selected ? '#111' : '#fff', weight: i === selected ? 2 : 0.4, fillColor: classOf(values[i], classes), fillOpacity: 0.88 });
            r.bindTooltip(tip(values[i], i), { sticky: true });
            r._onPick = onClick;
            r.on('click', () => { if (r._onPick) r._onPick(i); });
            return r;
        })).addTo(map);
        g._cells = cells;
        return g;
    }
    // Scale bar, north arrow and a labelled graticule, so each map stands on its own.
    function cartography(map, step) {
        L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 140 }).addTo(map);
        const North = L.Control.extend({ options: { position: 'topright' }, onAdd() { const d = L.DomUtil.create('div', 'north-arrow'); d.setAttribute('aria-hidden', 'true'); d.innerHTML = '<svg width="22" height="34" viewBox="0 0 22 34"><text x="11" y="10" text-anchor="middle" font-size="11" font-weight="700">N</text><path d="M11 13 L17 31 L11 26 L5 31 Z" fill="#111"/></svg>'; return d; } });
        map.addControl(new North());
        const lines = L.layerGroup().addTo(map), labels = L.layerGroup().addTo(map);
        for (let la = -10; la <= 30; la += step) lines.addLayer(L.polyline([[la, -20], [la, 30]], { color: '#8a8a86', weight: 0.6, opacity: 0.55, dashArray: '2 4', interactive: false }));
        for (let lo = -20; lo <= 30; lo += step) lines.addLayer(L.polyline([[-10, lo], [30, lo]], { color: '#8a8a86', weight: 0.6, opacity: 0.55, dashArray: '2 4', interactive: false }));
        const label = (ll, text, cls) => labels.addLayer(L.marker(ll, { icon: L.divIcon({ className: 'grat-label ' + cls, html: text, iconSize: null }), interactive: false, keyboard: false }));
        const deg = (v, pos, neg) => `${num(Math.abs(v), step < 1 ? 1 : 0)}°${v >= 0 ? pos : neg}`;
        const place = () => {
            labels.clearLayers();
            const b = map.getBounds(), dy = (b.getNorth() - b.getSouth()) * 0.012, dx = (b.getEast() - b.getWest()) * 0.006;
            for (let la = Math.ceil(b.getSouth() / step) * step; la <= b.getNorth(); la += step) label([la, b.getWest() + dx], deg(la, ' N', ' S'), 'lat');
            for (let lo = Math.ceil(b.getWest() / step) * step; lo <= b.getEast(); lo += step) label([b.getSouth() + dy, lo], deg(lo, ' E', ' W'), 'lon');
        };
        map.on('moveend zoomend resize', place); place();
    }
    function figMap(id, area) {
        const map = L.map(id, { scrollWheelZoom: false, zoomSnap: 0.25 });
        const g = L.geoJSON(GEO.features.find(f => f.properties.id === area));
        map.fitBounds(g.getBounds(), { padding: [12, 12] });
        basemap(map);
        cartography(map, area === 'niger_benue' ? 0.5 : 1);
        L.geoJSON(GEO, { style: { color: '#111', weight: 1.2, fill: false }, interactive: false }).addTo(map);
        new ResizeObserver(() => map.invalidateSize()).observe($('#' + id));
        return map;
    }

    // Figure 5: drought map with a year slider
    const DM = { layer: 'spi', year: null, timer: null };
    function initDroughtMap() {
        const P = D.spi, map = figMap('drought-map', 'sokoto_rima');
        let layer = null;
        DM.year = P.years.indexOf(1984) >= 0 ? P.years.indexOf(1984) : P.years.length - 1;
        const slider = $('#dm-year'); slider.max = P.years.length - 1; slider.value = DM.year;
        const draw = () => {
            let vals, classes, title, sub, tip;
            if (DM.layer === 'spi') { vals = P.spi[DM.year]; classes = SPI_CLASSES; title = `SPI, ${P.years[DM.year]}`; sub = 'Annual rainfall, gamma-fitted per cell to 1991–2020'; tip = (v, i) => `${P.years[DM.year]}: SPI ${fmt(v, 2)}, ${fmtInt(P.rain_mm[DM.year][i])} mm`; }
            else if (DM.layer === 'mean') { vals = P.mean_mm; classes = seqClasses(vals, SEQ_BLUE, ' mm'); title = 'Mean annual rainfall, mm'; sub = 'CHIRPS v2.0, 1981–2024'; tip = v => `${fmtInt(v)} mm a year`; }
            else { vals = P.cv_pct; classes = seqClasses(vals, SEQ_ORANGE, '%'); title = 'Year-to-year variability, %'; sub = 'Coefficient of variation of annual rainfall, 1981–2024'; tip = v => `CV ${fmt(v, 1)}%`; }
            layer = cellLayer(map, P.cells, vals, classes, tip, null, null, layer);
            $('#dm-legend').innerHTML = legendHtml(title, sub, classes);
            $('#dm-year-ctl').hidden = DM.layer !== 'spi';
            $('#dm-year-out').textContent = P.years[DM.year];
        };
        seg($('#dm-layer'), [['spi', 'Drought (SPI) by year'], ['mean', 'Mean rainfall'], ['cv', 'Variability']], DM.layer, v => { DM.layer = v; stop(); draw(); });
        slider.addEventListener('input', () => { DM.year = +slider.value; stop(); draw(); });
        const stop = () => { if (DM.timer) { clearInterval(DM.timer); DM.timer = null; $('#dm-play').textContent = '▶'; $('#dm-play').setAttribute('aria-label', 'Play through the years'); } };
        $('#dm-play').addEventListener('click', () => {
            if (DM.timer) return stop();
            $('#dm-play').textContent = '❚❚'; $('#dm-play').setAttribute('aria-label', 'Pause');
            DM.timer = setInterval(() => { DM.year = (DM.year + 1) % P.years.length; slider.value = DM.year; draw(); }, reduced ? 1600 : 900);
        });
        draw();
    }

    // Figure 8: where design rainfall changes
    const UM = { area: 'sokoto_rima', layer: 'uplift', scen: 'ssp585', T: '50' };
    function upliftValues(area, layer, scen, T, model = 'median') {
        const c = D.cells[area];
        if (layer === 'today') return c.chirps_rl[T];
        const per = c.uplift[scen][T];
        if (layer === 'agree') return c.cells.map((_, i) => Object.values(per).filter(v => v[i] > 1).length);
        if (model !== 'median') return per[model];
        return c.cells.map((_, i) => median(Object.values(per).map(v => v[i])));
    }
    function agreeClasses(n) {
        return [[0, Math.floor(n / 2) + 1, '#e8e6e1', `fewer than ${Math.floor(n / 2) + 1}`], [Math.floor(n / 2) + 1, Math.ceil(n * 2 / 3), '#c6dbef', `${Math.floor(n / 2) + 1}–${Math.ceil(n * 2 / 3) - 1}`],
            [Math.ceil(n * 2 / 3), Math.ceil(n * 0.9), '#6a9fe2', `${Math.ceil(n * 2 / 3)}–${Math.ceil(n * 0.9) - 1}`], [Math.ceil(n * 0.9), n, '#2459ab', `${Math.ceil(n * 0.9)}–${n - 1}`], [n, Infinity, '#173b78', `all ${n}`]];
    }
    function layerSpec(area, layer, scen, T, model, vals) {
        const n = D.part_c.settings.models.length;
        if (layer === 'today') return { classes: seqClasses(vals, SEQ_BLUE, ' mm'), title: `${T}-year daily rainfall today, mm`, sub: 'CHIRPS v2.0, 1985–2014', tip: v => `${fmtInt(v)} mm` };
        if (layer === 'agree') return { classes: agreeClasses(n), title: `Models projecting an increase, of ${n}`, sub: `${T}-year daily rainfall, ${SCEN[scen]}, 2041–2070`, tip: v => `${v} of ${n} models up` };
        return { classes: UP_CLASSES, title: `Uplift factor, ${T}-year daily rainfall`, sub: `${model === 'median' ? `Median of ${n} models` : esc(model)}, ${SCEN[scen]}, 2041–2070 vs 1985–2014`, tip: v => `×${fmt(v, 2)}` };
    }
    function initUpliftMap() {
        let map = null, layer = null, shown = null;
        const draw = () => {
            if (shown !== UM.area) {
                if (map) map.remove();
                map = figMap('uplift-map', UM.area); shown = UM.area; layer = null;
            }
            const vals = upliftValues(UM.area, UM.layer, UM.scen, UM.T), sp = layerSpec(UM.area, UM.layer, UM.scen, UM.T, 'median', vals);
            layer = cellLayer(map, D.cells[UM.area].cells, vals, sp.classes, sp.tip, null, null, layer);
            $('#um-legend').innerHTML = legendHtml(sp.title, sp.sub, sp.classes);
            $('#um-scen').hidden = UM.layer === 'today';
        };
        seg($('#um-area'), [['sokoto_rima', 'Sokoto–Rima'], ['niger_benue', 'Lower Niger–Benue']], UM.area, v => { UM.area = v; draw(); });
        seg($('#um-layer'), [['today', 'Today'], ['uplift', 'Uplift'], ['agree', 'Models agreeing']], UM.layer, v => { UM.layer = v; draw(); });
        seg($('#um-scen'), [['ssp245', 'SSP2-4.5'], ['ssp585', 'SSP5-8.5']], UM.scen, v => { UM.scen = v; draw(); });
        seg($('#um-t'), [['25', '25-year'], ['50', '50-year'], ['100', '100-year']], UM.T, v => { UM.T = v; draw(); });
        draw();
    }

    // Figure 11: where dry spells change
    const DRY_CLASSES = [[-Infinity, -4, '#1f56b0', '≤ −4 days (shorter)'], [-4, -2, '#4a8fd1', '−4 to −2'], [-2, -0.5, '#9fc5e8', '−2 to −0.5'], [-0.5, 0.5, '#e8e6e1', '−0.5 to +0.5'],
        [0.5, 2, '#dfc27d', '+0.5 to +2'], [2, 4, '#bf812d', '+2 to +4'], [4, Infinity, '#8c510a', '≥ +4 days (longer)']];
    function initDryMap() {
        const st = { kind: 'p90', scen: 'ssp585' }, map = figMap('dry-map', 'sokoto_rima'), c = D.cells.sokoto_rima;
        let layer = null;
        const draw = () => {
            const per = c.dry_change[st.scen][st.kind], models = Object.values(per), n = models.length;
            const vals = c.cells.map((_, i) => median(models.map(v => v[i])));
            const tip = (v, i) => { const longer = models.filter(m => m[i] > 0).length, shorter = models.filter(m => m[i] < 0).length; return `${signed(v, 1)} days (median); ${longer} of ${n} models longer, ${shorter} shorter`; };
            layer = cellLayer(map, c.cells, vals, DRY_CLASSES, tip, null, null, layer);
            $('#ds-legend').innerHTML = legendHtml(`Change in longest dry spell, ${st.kind === 'p90' ? '1-in-10 dry year' : 'typical year'}`, `Median of ${n} models, ${SCEN[st.scen]}, June–September, 2041–2070 vs 1985–2014`, DRY_CLASSES);
        };
        seg($('#ds-kind'), [['median', 'Typical year'], ['p90', '1-in-10 dry year']], st.kind, v => { st.kind = v; draw(); });
        seg($('#ds-scen'), [['ssp245', 'SSP2-4.5'], ['ssp585', 'SSP5-8.5']], st.scen, v => { st.scen = v; draw(); });
        draw();
    }

    // ---------- explorer ----------
    // Layers: design rainfall today, uplift and model agreement for both areas; drought layers for the
    // Sokoto–Rima basin only (Part B covers that basin).
    const X = { area: 'sokoto_rima', layer: 'uplift', T: '50', scen: 'ssp585', model: 'median', year: '1984', cell: null };
    const DROUGHT = ['spi', 'mean', 'cv'];
    function readQuery() {
        const p = new URLSearchParams(location.search);
        if (AREA[p.get('area')]) X.area = p.get('area');
        if (['today', 'uplift', 'agree', ...DROUGHT].includes(p.get('layer'))) X.layer = p.get('layer');
        if (['25', '50', '100'].includes(p.get('T'))) X.T = p.get('T');
        if (SCEN[p.get('scen')]) X.scen = p.get('scen');
        if (p.get('model') && (p.get('model') === 'median' || D.part_c.settings.models.includes(p.get('model')))) X.model = p.get('model');
        if (D.spi.years.includes(+p.get('year'))) X.year = p.get('year');
        if (X.area === 'niger_benue' && DROUGHT.includes(X.layer)) X.layer = 'uplift';
    }
    function writeQuery() {
        const q = { area: X.area, layer: X.layer };
        if (DROUGHT.includes(X.layer)) { if (X.layer === 'spi') q.year = X.year; }
        else { q.T = X.T; if (X.layer !== 'today') { q.scen = X.scen; q.model = X.model; } }
        try { history.replaceState(null, '', `${location.pathname}?${new URLSearchParams(q)}`); } catch (e) {}
    }
    let exMap = null, exLayer = null, exShown = null;
    const LAYERS = [['today', 'Design rainfall today'], ['uplift', 'Uplift factor'], ['agree', 'Models agreeing'], ['spi', 'Drought (SPI)'], ['mean', 'Mean rainfall'], ['cv', 'Variability']];
    function initExplorer() {
        readQuery();
        const models = D.part_c.settings.models;
        seg($('#ex-area'), [['sokoto_rima', 'Sokoto–Rima'], ['niger_benue', 'Lower Niger–Benue']], X.area, v => {
            X.area = v; X.cell = null;
            if (v === 'niger_benue' && DROUGHT.includes(X.layer)) { X.layer = 'uplift'; $$('#ex-layer button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === 'uplift'))); }
            draw();
        });
        seg($('#ex-layer'), LAYERS, X.layer, v => { X.layer = v; draw(); });
        seg($('#ex-t'), [['25', '25-year'], ['50', '50-year'], ['100', '100-year']], X.T, v => { X.T = v; draw(); });
        seg($('#ex-scen'), [['ssp245', 'SSP2-4.5'], ['ssp585', 'SSP5-8.5']], X.scen, v => { X.scen = v; draw(); });
        const sel = $('#ex-model');
        sel.innerHTML = `<option value="median">Median of ${models.length} models</option>` + models.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
        sel.value = X.model;
        sel.addEventListener('change', () => { X.model = sel.value; draw(); });
        const yr = $('#ex-year'); yr.min = D.spi.years[0]; yr.max = D.spi.years[D.spi.years.length - 1]; yr.value = X.year;
        yr.addEventListener('input', () => { X.year = yr.value; draw(); });
        draw();
    }
    function draw() {
        const drought = DROUGHT.includes(X.layer), c = D.cells[X.area];
        $$('#ex-layer button').forEach(b => { b.disabled = X.area === 'niger_benue' && DROUGHT.includes(b.dataset.val); });
        $('#ex-t').closest('.field').hidden = drought;
        $('#ex-scen').closest('.field').hidden = drought || X.layer === 'today';
        $('#ex-model').closest('.field').hidden = drought || X.layer !== 'uplift';
        $('#ex-year').closest('.field').hidden = X.layer !== 'spi';
        $('#ex-year-out').textContent = X.year;
        if (exShown !== X.area) {
            if (exMap) exMap.remove();
            exMap = figMap('explore-map', X.area); exMap.scrollWheelZoom.enable(); exShown = X.area; exLayer = null;
        }
        let vals, sp;
        if (drought) {
            const P = D.spi, yi = P.years.indexOf(+X.year);
            if (X.layer === 'spi') { vals = P.spi[yi]; sp = { classes: SPI_CLASSES, title: `SPI, ${X.year}`, sub: 'Annual rainfall, gamma-fitted per cell to 1991–2020', tip: (v, i) => `${X.year}: SPI ${fmt(v, 2)}, ${fmtInt(P.rain_mm[yi][i])} mm` }; }
            else if (X.layer === 'mean') { vals = P.mean_mm; sp = { classes: seqClasses(vals, SEQ_BLUE, ' mm'), title: 'Mean annual rainfall, mm', sub: 'CHIRPS v2.0, 1981–2024', tip: v => `${fmtInt(v)} mm a year` }; }
            else { vals = P.cv_pct; sp = { classes: seqClasses(vals, SEQ_ORANGE, '%'), title: 'Year-to-year variability, %', sub: 'Coefficient of variation, 1981–2024', tip: v => `CV ${fmt(v, 1)}%` }; }
        } else {
            vals = upliftValues(X.area, X.layer, X.scen, X.T, X.model);
            sp = layerSpec(X.area, X.layer, X.scen, X.T, X.model, vals);
        }
        exLayer = cellLayer(exMap, c.cells, vals, sp.classes, sp.tip, i => { X.cell = i; draw(); }, X.cell, exLayer);
        $('#ex-legend').innerHTML = legendHtml(sp.title, sp.sub, sp.classes);
        side();
        writeQuery();
    }
    function sparkSvg(series, dry) {
        const W = 280, H = 70, bw = W / series.length, y0 = H / 2, k = H / 2 / 3.5;
        const bars = series.map(([y, v], j) => `<rect x="${(j * bw + 0.5).toFixed(1)}" width="${(bw - 1).toFixed(1)}" y="${(v >= 0 ? y0 - Math.min(3.5, v) * k : y0).toFixed(1)}" height="${Math.max(0.8, Math.min(3.5, Math.abs(v)) * k).toFixed(1)}" fill="${classOf(v, SPI_CLASSES) === '#e8e6e1' ? '#c7c7c2' : classOf(v, SPI_CLASSES)}"><title>${y}: SPI ${fmt(v, 2)}</title></rect>`).join('');
        return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="SPI by year for this cell, ${series[0][0]}–${series[series.length - 1][0]}; drought years ${dry.join(', ') || 'none'}"><line x1="0" x2="${W}" y1="${y0}" y2="${y0}" stroke="#bbb"/>${bars}</svg>`;
    }
    function side() {
        const box = $('#ex-side'), c = D.cells[X.area], A = D.part_c.areas[X.area];
        const clear = '<button type="button" class="button quiet" id="ex-clear">Back to the whole area</button>';
        if (X.cell === null) {
            const E = A.ensemble[X.scen].uplift[X.T];
            box.innerHTML = `<h3>${AREA[X.area]}</h3><p class="when">${c.cells.length} cells of 0.25°. Select a cell for its values.</p>
                <dl><dt>Today, ${X.T}-year (CHIRPS)</dt><dd>${fmtInt(A.chirps.return_levels[X.T].median_cells)} mm</dd>
                <dt>Uplift, ${SCEN[X.scen]}</dt><dd>×${fmt(E.combined.median, 2)}</dd>
                <dt>5–95% range</dt><dd>×${fmt(E.combined.p05, 2)}–${fmt(E.combined.p95, 2)}</dd>
                <dt>Models projecting an increase</dt><dd>${E.models_above_1} of ${A.ensemble[X.scen].n_models}</dd></dl>`;
            return;
        }
        const [lon, lat] = c.cells[X.cell];
        if (DROUGHT.includes(X.layer)) {
            const P = D.spi, k = P.cells.findIndex(q => q[0] === lon && q[1] === lat);
            const series = P.years.map((y, j) => [y, P.spi[j][k]]);
            const dry = series.filter(([, v]) => v <= -1).map(([y]) => y);
            box.innerHTML = `<h3>Cell ${fmt(lat, 3)}° N, ${fmt(lon, 3)}° E</h3><p class="when">CHIRPS v2.0, 1981–2024</p>
                <dl><dt>Mean rainfall</dt><dd>${fmtInt(P.mean_mm[k])} mm</dd><dt>Variability (CV)</dt><dd>${fmt(P.cv_pct[k], 1)}%</dd>
                <dt>Drought years (SPI ≤ −1)</dt><dd>${dry.length}</dd></dl>
                ${sparkSvg(series, dry)}
                <p class="when">${P.years[0]}–${P.years[P.years.length - 1]}; drought years: ${dry.join(', ') || 'none'}</p>${clear}`;
        } else {
            const per = c.uplift[X.scen][X.T];
            const list = Object.entries(per).map(([m, v]) => [m, v[X.cell]]).sort((a, b) => b[1] - a[1]);
            box.innerHTML = `<h3>Cell ${fmt(lat, 3)}° N, ${fmt(lon, 3)}° E</h3><p class="when">${X.T}-year daily rainfall, ${SCEN[X.scen]}</p>
                <dl><dt>Today (CHIRPS)</dt><dd>${fmtInt(c.chirps_rl[X.T][X.cell])} mm</dd>
                <dt>Median uplift</dt><dd>×${fmt(median(list.map(x => x[1])), 2)}</dd>
                <dt>Models projecting an increase</dt><dd>${list.filter(([, v]) => v > 1).length} of ${list.length}</dd></dl>
                <ol class="model-bars">${list.map(([m, v]) => `<li${m === X.model ? ' class="on"' : ''}><span>${esc(m)}</span><b>×${fmt(v, 2)}</b><i style="--w:${Math.min(100, Math.abs(Math.log(v)) / Math.log(3) * 100)}%" class="${v >= 1 ? 'up' : 'down'}"></i></li>`).join('')}</ol>${clear}`;
        }
        $('#ex-clear').addEventListener('click', () => { X.cell = null; draw(); });
    }

    // ---------- page chrome ----------
    function initNav() {
        const links = $$('.toc a').filter(a => a.getAttribute('href').startsWith('#'));
        if (!links.length) return;
        const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
        let queued = false, current = null;
        const update = () => {
            queued = false;
            let i = -1; targets.forEach((t, j) => { if (t && t.getBoundingClientRect().top <= innerHeight * 0.3) i = j; });
            if (i === current) return; current = i;
            links.forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
        };
        addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
        update();
    }
    // A table that scrolls sideways must be reachable by keyboard; one that fits must not add a tab stop.
    function initTableWraps() {
        const check = w => {
            const fig = w.closest('figure'), cap = fig && $('figcaption', fig);
            if (w.scrollWidth > w.clientWidth + 1 && cap) { w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-labelledby', cap.id); }
            else ['tabindex', 'role', 'aria-labelledby'].forEach(a => w.removeAttribute(a));
        };
        const ro = new ResizeObserver(es => es.forEach(e => check(e.target)));
        $$('.table-wrap').forEach(w => { check(w); ro.observe(w); });
    }
    function snack(msg) { const s = document.createElement('div'); s.className = 'snack'; s.setAttribute('role', 'status'); s.textContent = msg; document.body.append(s); setTimeout(() => s.remove(), 2000); }
    function copy(text, ok) { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => snack(ok), () => window.prompt('Copy:', text)); else window.prompt('Copy:', text); }
    let opener = null;
    function initFigures() {
        const v = $('#fig-viewer');
        if (v) {
            v.addEventListener('click', e => { if (e.target === v || e.target.closest('[data-close]')) v.close(); });
            v.addEventListener('close', () => { if (opener) opener.focus(); });
        }
        $$('figure[id]').filter(f => !f.classList.contains('tablefig')).forEach(f => {
            const cap = $('figcaption', f); if (!cap) return;
            const tools = document.createElement('span'); tools.className = 'fig-tools';
            const imgs = $$('img.zoomable', f);
            if (imgs.length) tools.insertAdjacentHTML('beforeend', '<button type="button" class="tool" data-act="enlarge">Enlarge</button>');
            tools.insertAdjacentHTML('beforeend', '<button type="button" class="tool" data-act="link">Copy link</button>');
            cap.append(tools);
            tools.addEventListener('click', e => {
                const act = e.target.closest('[data-act]'); if (!act) return;
                if (act.dataset.act === 'link') return copy(`${location.origin}${location.pathname}#${f.id}`, 'Link to the figure copied');
                const c = cap.cloneNode(true); $('.fig-tools', c).remove();
                const t = $('b', c); $('#viewer-title').textContent = t ? t.textContent.replace(/\.$/, '') : 'Figure'; if (t) t.remove();
                $('#viewer-cap').innerHTML = c.innerHTML.trim();
                $('#viewer-body').innerHTML = imgs.map(i => `<img src="${i.src}" alt="${esc(i.alt)}">`).join('');
                opener = act; v.showModal();
            });
        });
        if ($('#copy-cite')) $('#copy-cite').addEventListener('click', () => copy($('#cite-text').textContent.replace(/\s+/g, ' ').trim(), 'Citation copied'));
    }
    function initChrome() {
        const bar = $('#progress'), top = $('#to-top');
        if (bar && top) {
            let queued = false;
            const update = () => { queued = false; const max = document.documentElement.scrollHeight - innerHeight; bar.style.width = `${max > 0 ? Math.min(100, 100 * scrollY / max) : 0}%`; top.hidden = scrollY < innerHeight * 1.5; };
            addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
            update();
            top.addEventListener('click', () => { scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); $('.site-id').focus({ preventScroll: true }); });
        }
        const items = $$('.reveal, [data-reveal]');
        if (reduced || !('IntersectionObserver' in window)) { items.forEach(x => x.classList.add('in')); return; }
        document.documentElement.classList.add('js-reveal');
        const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
        items.forEach(x => io.observe(x));
    }

    // ---------- reactions and counts ----------
    // Counted by Abacus (abacus.jasoncameron.dev), a public counter, on the published site only: a view once per
    // browser session, a reaction once per browser. Automated browsers (navigator.webdriver) never count.
    const COUNTER = 'https://abacus.jasoncameron.dev', NSP = 'oloyededavid-hydro-extremes-v1';
    const LIVE = location.hostname === 'oloyededavid.github.io' && !navigator.webdriver;
    const REACT = { 'Useful': 'useful', 'Interesting': 'interesting', 'Needs clarity': 'clarity' }, RSTORE = 'hx-reaction';
    const store = { get: (k, t = sessionStorage) => { try { return t.getItem(k); } catch (e) { return null; } }, set: (k, v, t = sessionStorage) => { try { t.setItem(k, v); } catch (e) {} } };
    const count = (op, key) => fetch(`${COUNTER}/${op}/${NSP}/${key}`).then(r => r.ok ? r.json() : (r.status === 404 ? { value: 0 } : Promise.reject(r.status))).then(j => Number(j.value) || 0);
    const showCount = (label, n) => { const e = $(`.react[data-react="${label}"] .rc`); if (e) e.textContent = n ? fmtInt(n) : ''; };
    function initCounts() {
        if (!LIVE) return;
        const v = $('#views');
        if (v) { const seen = store.get('hx-viewed'); count(seen ? 'get' : 'hit', 'views').then(n => { if (!seen) store.set('hx-viewed', '1'); if (n) { v.textContent = `${fmtInt(n)} page views`; v.hidden = false; } }).catch(() => {}); }
        Object.entries(REACT).forEach(([label, key]) => { if ($(`.react[data-react="${label}"]`)) count('get', key).then(n => showCount(label, n)).catch(() => {}); });
    }
    function initReactions() {
        let reaction = store.get(RSTORE, localStorage) || '';
        const mark = () => $$('.react').forEach(x => { x.setAttribute('aria-pressed', String(x.dataset.react === reaction)); x.classList.toggle('is-other', !!reaction && x.dataset.react !== reaction); });
        mark();
        if (reaction) $('#react-status').textContent = 'Thanks, your reaction is counted.';
        $$('.react').forEach(b => b.addEventListener('click', () => {
            if (reaction) { $('#react-status').textContent = reaction === b.dataset.react ? 'Thanks, your reaction is counted.' : 'You have already reacted from this browser.'; return; }
            reaction = b.dataset.react; store.set(RSTORE, reaction, localStorage); mark();
            $('#react-status').textContent = 'Thank you! Counted.';
            const rc = b.querySelector('.rc'); rc.textContent = fmtInt((Number((rc.textContent || '0').replace(/,/g, '')) || 0) + 1); b.classList.add('pop');
            if (LIVE) count('hit', REACT[reaction]).then(n => showCount(reaction, n)).catch(() => {});
        }));
    }

    // ---------- start ----------
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); });
    Promise.all([get('data/site.json'), get('data/domains.geojson'), get('data/cells.json'), get('data/spi_cells.json')]).then(([site, geo, cells, spi]) => {
        D = site; GEO = geo; D.cells = cells; D.spi = spi;
        const has = s => !!$(s);
        if (has('#abstract')) fill();
        if (has('#study-map')) initStudyMap();
        if (has('#spichart')) { renderSpi(); new ResizeObserver(renderSpi).observe($('#spichart')); }
        if (has('#checkchart')) {
            seg($('#check-area'), [['sokoto_rima', 'Sokoto–Rima'], ['niger_benue', 'Lower Niger–Benue']], S.check, v => { S.check = v; renderCheck(); });
            renderCheck(); new ResizeObserver(renderCheck).observe($('#checkchart'));
        }
        if (has('#upchart')) {
            seg($('#up-area'), [['sokoto_rima', 'Sokoto–Rima'], ['niger_benue', 'Lower Niger–Benue']], S.upArea, v => { S.upArea = v; renderUplift(); });
            seg($('#up-t'), [['25', '25-year'], ['50', '50-year'], ['100', '100-year']], S.upT, v => { S.upT = v; renderUplift(); });
            renderUplift(); new ResizeObserver(renderUplift).observe($('#upchart'));
        }
        if (has('#flood-map')) initFloodMap();
        if (has('#floodchart')) {
            seg($('#fc-year'), [['all', 'All years'], ...[...new Set(D.part_a.monthly.map(r => r.year))].map(y => [String(y), String(y)])], FC.year, v => { FC.year = v; renderFloodCurve(); });
            renderFloodCurve(); new ResizeObserver(renderFloodCurve).observe($('#floodchart'));
        }
        if (has('#ndvichart')) {
            seg($('#nd-mode'), [['raw', 'As measured'], ['detrended', 'Trend removed']], ND.mode, v => { ND.mode = v; renderNdvi(); });
            renderNdvi(); new ResizeObserver(renderNdvi).observe($('#ndvichart'));
        }
        if (has('#drought-map')) initDroughtMap();
        if (has('#uplift-map')) initUpliftMap();
        if (has('#dry-map')) initDryMap();
        if (has('#drychart')) { renderDry(); new ResizeObserver(renderDry).observe($('#drychart')); }
        if (has('#design-table')) renderDesign();
        if (has('#explore-map')) initExplorer();
        initNav();
        initTableWraps();
        initFigures();
        if (has('#react-status')) initReactions();
        initChrome();
        initCounts();
    }).catch(err => {
        console.error(err);
        const m = document.createElement('p'); m.className = 'small load-error';
        m.textContent = `The data could not be loaded (${err.message}). Reload the page to try again.`;
        $('main').prepend(m);
    });
})();
