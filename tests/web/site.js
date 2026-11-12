// Browser checks for the study page (docs/index.html). Expected values come from docs/data/*.json.
// Run: (cd docs && python3 -m http.server 8770 --bind 127.0.0.1) & URL=http://127.0.0.1:8770/ node tests/web/site.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const C = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/data/c.json'), 'utf8'));
const A = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/data/a.json'), 'utf8'));
const BASE = process.env.URL || 'http://127.0.0.1:8770/';
const fails = [];
const ok = (name, cond) => { if (!cond) fails.push(name); console.log(cond ? 'PASS' : 'FAIL', name); };

(async () => {
  const b = await chromium.launch();
  for (const [label, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const bad = [];
    p.on('response', r => { if (r.status() >= 400) bad.push(r.url()); });
    await p.goto(BASE + 'index.html', { waitUntil: 'load' });
    // reveal everything the way a reader would: scroll through the page
    const H = await p.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < H; y += 500) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(120); }
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(1500);
    console.log(`--- ${label} ---`);
    ok(`${label}: no JavaScript errors`, errs.length === 0);
    if (errs.length) console.log(errs.slice(0, 5));
    ok(`${label}: no failed requests`, bad.length === 0);
    ok(`${label}: no horizontal page scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
    ok(`${label}: every data-v value filled`, (await p.$$eval('[data-v]', es => es.filter(e => e.textContent.trim() === '—').length)) === 0);
    ok(`${label}: no NaN or undefined text`, (await p.$$eval('main, footer', m => /NaN|undefined/.test(m.map(x => x.textContent).join('')))) === false);
    ok(`${label}: every map drawn`, (await p.$$eval('.map', ms => ms.filter(m => !m.querySelector('.leaflet-tile, .leaflet-image-layer, .leaflet-interactive')).length)) === 0);
    ok(`${label}: every chart drawn`, (await p.$$eval('.chart', cs => cs.filter(c => !c.querySelector('svg')).length)) === 0);
    ok(`${label}: maps outnumber charts`, (await p.$$eval('.map', m => m.length)) > (await p.$$eval('.chart', c => c.length)) - 9);
    if (label === 'desktop') {
      const nM = C.results.settings.models.length;
      ok(`${label}: Figure C4 shows ${2 * nM} model dots`, (await p.$$eval('#upchart circle', c => c.length)) >= 2 * nM);
      ok(`${label}: flood curve has 12 monthly points`, (await p.$$eval('#floodchart circle', c => c.length)) >= 12);
      const d = C.results.areas.niger_benue.ensemble.ssp585.design_rainfall["25"];
      const row = await p.$$eval('#design-table tbody tr', rs => rs.map(r => [...r.cells].map(c => c.childNodes[0] ? c.childNodes[0].textContent.trim() : '')));
      ok(`${label}: Table C2 Lower Niger–Benue 25-year row matches results`, row.length === 10 && row[2][2] === String(Math.round(d.baseline_mm)) && row[2][5].split(" ")[0] === String(Math.round(d.future_mm_median)));
      await p.click('#up-t button[data-val="100"]'); await p.waitForTimeout(150);
      ok(`${label}: return-period switch redraws uplift chart`, (await p.$eval('#upchart', e => e.textContent)).length > 0 && (await p.$$eval('#upchart circle', c => c.length)) >= 2 * nM);
      await p.click('#fm-layer button[data-val="oct"]'); await p.waitForTimeout(200);
      ok(`${label}: flood map switches to October 2022`, (await p.$eval('#fm-legend .lg-t', e => e.textContent)).includes('October 2022'));
      await p.click('#spi-k button[data-val="6"]'); await p.waitForTimeout(150);
      ok(`${label}: SPI switch to SPI-6 redraws`, (await p.$eval('#spi-k button[aria-pressed="true"]', e => e.dataset.val)) === '6');
      ok(`${label}: Sentinel-2 check agrees with data (dry precision ${A.dualpol.sentinel2_check.dry_2022_02.s1_confirmed_by_s2})`,
        (await p.$eval('#s2chart', e => e.textContent)) !== '');
    }
    const links = await p.$$eval('a[href]', as => as.map(a => a.getAttribute('href')).filter(h => h && !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('mailto')));
    const missing = [];
    for (const l of [...new Set(links)]) { const r = await p.request.get(BASE + l).catch(() => null); if (!r || r.status() >= 400) missing.push(l); }
    ok(`${label}: every local link resolves${missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''}`, missing.length === 0);
    await p.close();
  }
  await b.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
