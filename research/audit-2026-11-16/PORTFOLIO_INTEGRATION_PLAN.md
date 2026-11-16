# Portfolio integration plan: Observational Hydrology and Coastal Hydrogeology

16 November 2026 · a plan only: nothing here has been applied to the live portfolio (<https://oloyededavid.github.io/geospatial-rs-portfolio/>). The same plan applies to both repositories; it is kept here and referenced from `coastal-hydrogeology-modeling/research/audit-2026-11-16/`.

## 1. What the portfolio has now (inspected)

- One page in English, French and German (`index.html`; `fr/` and `de/` built by `tools/build_i18n.py` from `i18n/*.json`).
- An index map of five project areas, then five project cards: 01 Hydrology (Lower Niger–Benue and Sokoto–Rima), 02 Ogun surface water, 03 Ouémé–Ogun recharge, 04 Lake Chad water storage, 05 Lagos urban heat (wide card with a map tour).
- Each card links to a study site on GitHub Pages; `tools/sync_nav.py` writes the "Study 0N of 05" bar and next-study card on each site.
- **Observational Hydrology is already card 01.** Its title, years (1950–2070), tags ("Floods and drought", "Satellite hydrology", "Climate change", "Earth observation") and summary ("tested for how far they can stand in for missing gauges") were corrected on 15 November.
- **Coastal Hydrogeology is not on the portfolio**, and its repository has no GitHub Pages site (both URL spellings return 404).

## 2. Decisions

| Question | Recommendation | Reason |
| :--- | :--- | :--- |
| Update or duplicate Observational Hydrology? | **Update card 01 in place; no new card** | It is already there and correct; duplicating would split one study |
| Is Coastal Hydrogeology mature enough for a card? | **Not yet as a full card; yes as a clearly labelled work-in-progress entry, after you review the re-analysis** | The re-analysis is reproducible and honest, but its groundwater result is an uncalibrated scenario model and the absolute sealing estimate is bracketed, not measured. The five current cards are all executed, independently checked studies; a sixth that is not would lower the set's standard unless it is labelled |
| Where would Coastal sit? | After card 05 (Lagos), as card 06, or as a short "In progress" line under the projects | It shares the Lagos coast with card 05 and the groundwater theme with cards 03 and 04 |

## 3. Essential changes (only if you approve each)

### 3.1 Observational Hydrology (card 01)

Nothing essential. Optional, in all three languages:

- Add "independently reproduced" to the card only if you want to signal it; the study page already has the limits.
- Publish the `research-audit` branch of the study repository (README, limits table, reproduction record) so the card's link leads to the updated README.

### 3.2 Coastal Hydrogeology, if added as card 06

1. **Publish its site first.** Merge `research-audit` in the Coastal repository and enable GitHub Pages from `docs/`. The page has no study bar yet; `sync_nav.py` would add it.
2. **Card content (English):**
   - Title: *Urban Sealing and Groundwater on the Lekki–Epe Barrier, Lagos, 1986–2024*
   - Tags: Groundwater · Urban change · Coastal aquifer · Scenario modelling
   - Summary: *Satellite evidence of surface sealing since the late 1980s, checked against an independent built-up map, and a MODFLOW 6 scenario model of what it could do to a shallow coastal water table. Uncalibrated: no groundwater observations were available.*
   - Image: the water-table map with flow arrows (`docs/fig/heads.png`, upper panel), cropped to 4:3 at 720, 1200 and 1600 px wide, as for the other cards.
   - Caption: *Lekki–Epe barrier: modelled water table and flow, central scenario*
   - Alt text: *Map of the Lekki–Epe barrier between the Lagos and Lekki lagoons and the Atlantic, showing a modelled water table highest in the middle of the barrier, with arrows of groundwater flow outwards to the lagoons and the sea.*
3. **Index map.** Add the barrier outline (from `outputs/index_arrays.npz` land mask, simplified) as area 06 with a sixth legend row. It overlaps the Lagos area (05) on the coast; draw it on top with a distinct hatch.
4. **Study bar.** Add the sixth study to `S` in `tools/sync_nav.py`; every study bar then reads "Study 0N of 06", and the Lagos site's next-study card points to Coastal, Coastal's to Hydrology.
5. **French and German.** Add to `i18n/fr.json` and `i18n/de.json` the title, the four tags, the summary, the caption, the alt text and "Open the project: …" label; `build_i18n.py` will refuse to build until every new English string has a translation.
6. **About and skills.** If added, "MODFLOW 6 / FloPy" is a fair addition to the Analysis and modelling skills row; nothing else changes.

### 3.3 Alternative for Coastal: an "In progress" line

One sentence under the project cards, no card, no map entry: *In progress: how far urban sealing and groundwater abstraction lower the shallow water table of the Lekki–Epe barrier, Lagos; open-data re-analysis and an uncalibrated MODFLOW 6 scenario model, awaiting groundwater observations.* with a link to the repository README. Three dictionary entries (FR, DE), no other change.

## 4. Optional improvements

- A short "Method notes" link on card 01 to the reproduction record.
- Once Coastal has groundwater observations and a calibrated model, promote it to a full card with the map entry.

## 5. Recommended page structure for the Coastal study site

Already built as the preview (`docs/index.html` in the Coastal repository):

1. Title, author, status note (uncalibrated)
2. Question and setting, with the study-area map
3. Data and method table
4. The satellite evidence for sealing: index maps, sensitivity chart, GHSL check
5. What sealing could do to the water table: head and change maps, scenario chart
6. What changed from the original version
7. Limits
8. What would make it a hydrogeology study

Every number on the page is read from `docs/data/site.json`, built from the analysis outputs by `code/pipeline/p05_site_data.py`.

## 6. How the two projects fit the portfolio

- **Groundwater:** Ouémé–Ogun recharge (03) asks whether satellites can estimate recharge; Lake Chad (04) measures storage change from gravity; Coastal would ask what land-surface change does to a shallow coastal water table. Three different handles on groundwater, each honest about what it cannot measure.
- **Floods and climate extremes:** Observational Hydrology (01) and Ogun (02) cover river flooding and rainfall; Coastal adds the urban coast.
- **Lagos:** Lagos heat (05) and Coastal share a city and its land-cover change (heat and vegetation; sealing and recharge).
