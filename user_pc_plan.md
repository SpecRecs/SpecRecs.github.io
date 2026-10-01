# Plan: "My PC" build collector test UI

## Context
SpecRecs (static GitHub Pages site, currently a "Coming Soon" `index.html`) needs a test UI that records a user's current PC build. Each component type gets a section with a search box. Searching queries TechPowerUp, and the chosen part is added to the build with its performance specs shown. Price is out of scope.

Research findings (verified with curl on 2026-10-01):
- TechPowerUp has an official free REST API (https://www.techpowerup.com/database-licensing/). It needs no key or sign-up and is intended for academic/research use. Attribution is appreciated.
- The responses send `access-control-allow-origin: *`, so the browser can call it directly. No proxy or backend is needed.
- Endpoints (all `GET ...?q=<search>`, JSON with `results[]`):
  - GPU: `https://www.techpowerup.com/gpu-specs/api/v1/cards`
  - CPU: `https://www.techpowerup.com/cpu-specs/api/v1/chips`
  - SSD: `https://www.techpowerup.com/ssd-specs/api/v1/drives`
- The free tier is a curated subset. SSD results can include a `{"_type":"withheld","message":...}` entry, which the UI must skip (and may note as "more results need a TPU license").
- TPU covers no RAM, motherboard, or PSU. Those need manual entry for now, with a pluggable data-source design so sources can be added later. **[DEPRECATED, see Update 1: RAM, motherboard and PSU now come from the docyx dataset; manual entry is only a fallback.]**
- Useful performance fields:
  - GPU: `relativePerformance.score`, shaders, boostClock, memSize, memType, memBandwidth, tdp.
  - CPU: cores, threads, baseClockMhz, cacheL3Kb, tdpW, memSpeedMhz. There is no benchmark score.
  - SSD: seqReadMbs, seqWriteMbs, capacityGB, interface.

## Approach (vanilla HTML/JS, no build step)
New page `build.html` at the repo root (leave `index.html` untouched), plus `build.js` and `build.css` (or inline if kept small).

### Data-source abstraction
In `build.js`, a `SOURCES` map, one entry per component category:
```
{ label, kind: 'tpu' | 'manual', endpoint?, mapResult(raw) -> {id,name,subtitle,specs:[[label,value],...], perfHeadline}, manualFields? }
```
**[DEPRECATED, see Update 1: `kind` now also allows `'dataset'`.]**
- `gpu`, `cpu`, `storage` use `kind: 'tpu'`, each with a mapper that turns the raw API record into display rows.
- **[DEPRECATED, see Update 1: these three now use `kind: 'dataset'`; the forms below remain only as a fallback.]** `ram`, `motherboard`, `psu` use `kind: 'manual'`, with a small form of fields:
  - RAM: type, capacity, speed, kit config.
  - Motherboard: chipset, socket, form factor.
  - PSU: wattage, efficiency.
- Adding a new TPU-style source later means adding one entry.

### UI
- One card per category: heading, search input, results dropdown, and a "selected part" panel.
- Search is debounced (~300ms) and calls `fetch(endpoint + '?q=' + encodeURIComponent(q))`. It filters out `_type: 'withheld'` rows. It also handles loading, empty, and error states, and uses `AbortController` to cancel stale requests.
- Clicking a result sets it as that category's part and renders its spec table. GPU shows a "relative performance" bar. A remove/change button clears it.
- Storage allows multiple drives (add more); the other categories hold one part each.
- Build summary strip at the top shows which categories are filled.
- Build state is saved to `localStorage` (wrapped in try/catch) so it survives reloads. This is a test UI, so no export yet.
- Footer attribution: "Hardware data from TechPowerUp" with a link. **[DEPRECATED, see Update 1: the footer now credits both TechPowerUp and the docyx dataset.]**
- Styling reuses the existing dark palette (`#0d0d12` background, `#f2f0e6` text), with a readable sans-serif for the body (Monoton for the heading only).

### Files
- Add: `build.html`, `build.js`, `build.css`.
- Modify: nothing existing, except optionally a link from `index.html` later. Not needed now.
- Note: `test/` is untracked and holds scratch scrapers. Don't touch it.

## Open caveat (not blocking)
The free API is licensed for academic/research use. Fine for this course project. If SpecRecs becomes a public or commercial product, a commercial TPU license (contact on their licensing page) is needed.

## Verification
1. `curl` each endpoint (already done) and confirm the field names used by the mappers.
2. Serve locally: `python -m http.server` in the repo root, open `http://localhost:8000/build.html`. **[DEPRECATED, see Update 1: `python` is not on this machine's Bash PATH (use `py -m http.server`), and port 8000 was already taken, so testing used port 8765.]**
3. In the browser (claude-in-chrome or manually):
   - Search "rtx 4070" in GPU and select a result. Specs and the performance bar render, and the console has no CORS errors.
   - Search "7800x3d" in CPU, and "990 pro" in Storage. Confirm the withheld row is hidden.
   - Fill the manual RAM, motherboard and PSU forms. **[DEPRECATED, see Update 1: these are now tested as dataset searches, with the forms tested as a fallback.]**
   - Reload and confirm the build persists. Remove a part and confirm it clears.
   - Try a nonsense query (empty state) and go offline (error state).
4. Check layout at phone width.

---

# Update 1 (2026-10-01): docyx dataset for RAM, motherboard and PSU

## Context
The original plan above was implemented and tested in Chrome (all checks passed). It left RAM, motherboard and PSU as manual-entry forms because TechPowerUp does not cover them. This update replaces manual entry with a searchable free dataset.

## Research findings
- Source: [docyx/pc-part-dataset](https://github.com/docyx/pc-part-dataset), a PCPartPicker snapshot as JSON/JSONL/CSV (MIT, 66,778 parts, last updated 2025-07-23, 25+ categories).
- Raw GitHub files send `Access-Control-Allow-Origin: *` and total about 3.4 MB for the three files, so a live fetch is possible.
- **Correction to an earlier statement:** I first guessed older parts would be missing. They are not. The dataset includes old sockets (LGA775, AM3) and DDR3, and only about 20% of records carry a price.
- Raw records versus unique after dedupe: memory 13,553 raw (3,493 unique names, 9,357 unique variants), motherboard 4,973 raw (4,959 unique), PSU 3,438 raw (3,233 unique). One memory kit name covers many speed/module/CAS variants, so the dropdown must show variant details.
- Encoded fields:
  - Memory `speed` is `[generation, MT/s]` (`[5, 6000]` is DDR5-6000), and `modules` is `[count, GB each]`.
  - PSU `efficiency` is lowercase (`gold`, `bronze`, ...) and null for about 12%, plus a `"plus"` value (273 records).
  - PSU `modular` is `"Full"`, `"Semi"`, `false` or `"Full / Side"`.
- Records have no IDs or URLs.

## Decisions
- **Vendored copy over live fetch.** Avoids depending on a third-party repo and its 5-minute cache, allows price stripping, and cuts the data to about 2.2 MB.
- Keep manual forms as a fallback behind a "Can't find it? Enter manually" toggle.
- No saved-build migration: saved parts keep the same `{name, subtitle, specs}` shape.
- Display PSU `"plus"` efficiency as "80+" (assumed to mean plain 80+, **not verified**).

## What was built
- `scripts/build_data.mjs`: downloads the three upstream files, drops price/color/price_per_gb, removes exact duplicates and adds a stable 10-character SHA-1 ID. Run `node scripts/build_data.mjs` to refresh. Result: memory 9,357, motherboard 4,959, PSU 3,233.
- `data/memory.json`, `data/motherboard.json`, `data/psu.json` (about 1.2 MB, 0.6 MB, 0.4 MB).
- `build.js`:
  - New `kind: 'dataset'` in `SOURCES` for `ram`, `motherboard`, `psu`, each with a `file`, an `example` and a `mapResult`. The old `fields`/`summarize` stay for the fallback form.
  - Dataset files load lazily on first search and are cached. Each row is mapped once with a lowercase "haystack" of name plus variant text (`×` normalized to `x`), so queries like "6000" or "2x16" match.
  - Local search requires all tokens to match, ranks prefix matches first, then shorter names. It shows up to 15 results and notes the total ("Showing 15 of N").
  - The TechPowerUp search card was generalized into `buildSearchCard`, which handles both `tpu` and `dataset` sources. The manual form was split into a reusable `buildManualForm`.
  - Added `example` placeholders to the three TechPowerUp sources (they were a separate `EXAMPLES` constant before).
- `build.css`: styles for the fallback `<details>` toggle.
- `build.html`: footer now credits TechPowerUp and docyx/pc-part-dataset (MIT).

## Field mapping
| Category | Dropdown line | Spec rows |
|---|---|---|
| RAM | `DDR5-6000 · 2×16 GB · CL36` | Type, speed (MT/s), kit, total GB, CAS, first-word latency (ns) |
| Motherboard | `AM5 · ATX` | Socket, form factor, memory slots, max memory |
| PSU | `850 W · 80+ Gold · Full modular` | Wattage, efficiency, modular, form factor |

RAM has no benchmark score. Its performance headline is speed, CAS and first-word latency. Motherboard and PSU are compatibility and capacity data rather than performance.

## Deviations found during implementation
- **Bug fixed:** 4 old DDR1 memory records (for example Mushkin 971130A) store `speed` as a bare number instead of `[generation, MT/s]`. The first version of the RAM mapper crashed on them, which made the whole memory list fail to load ("Couldn't load the parts list"). The mapper now accepts a bare number and shows it as `400 MT/s`.
- Dev server: `python` is not on the Bash PATH here, so use `py -m http.server`. Port 8000 was already in use, so testing used port 8765.
- Chrome screenshots timed out, so tests ran through the page's DOM and a script rather than visual inspection.

## Verification results (Chrome, `http://localhost:8765/build.html`)
- RAM "vengeance 6000" and "vengeance 2x16 ddr5" return distinct variants. Picking one shows correct specs.
- Motherboard "b650" and PSU "rm850" return sensible results with correct spec rows.
- Nonsense query shows "No matches." A broad query ("corsair") shows "Showing 15 of 974."
- Old DDR1 record ("mushkin 971130a") loads and displays.
- Forced load failure shows "Couldn't load the parts list. Try again.", and a later search recovers.
- Manual fallback saves a custom motherboard. A RAM part and PSU entered manually before this change still rendered after it, and picking from the dataset replaces them (single part per category).
- Parts persist across reload. Console shows no errors. No horizontal scroll at desktop width.
- Not re-run after this change: the phone-width (390px) check.

## Open items
- Licensing: the repo is MIT, but the underlying data was scraped from PCPartPicker. Vendoring copies that data into this repo, so this matters more than for TechPowerUp. Fine for a course project; revisit before any public launch.
- Verify what PSU efficiency `"plus"` means.
- CPU benchmark scores are still missing (candidate: Blender Open Data; its access options are unchecked).
- Nothing is committed yet.
