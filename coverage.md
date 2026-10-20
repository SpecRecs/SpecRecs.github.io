# SpecRecs: Search Coverage Test

How many well-known PC parts the "My PC" page (`build.html`) can find, and how much data it shows for each. The test ran once before and once after implementing the dataset recommendation in `datasets.md`.

**Result:** parts found went from **106 of 173 (61%)** to **172 of 173 (99%)**. Parts with a performance score went from **32 (18%)** to **106 (61%)**, which is every CPU and GPU except one. Nothing that was found before was lost.

---

## How the test works

- **Reference list:** 173 parts across all six categories, in `test/coverage_refs.json`:

  | Category | Parts | Range |
  |---|---|---|
  | GPU | 54 | GTX 750 Ti (2014) to RTX 50-series, RX 9070 and Arc B580 |
  | CPU | 53 | Sandy Bridge and FX-8350 to Arrow Lake and Zen 5 |
  | Storage | 27 | Popular NVMe and SATA SSDs, plus two common hard drives |
  | RAM | 12 | DDR3, DDR4 and DDR5 kits |
  | Motherboard | 13 | AMD B450 to X870E, Intel Z270 to Z790 |
  | PSU | 14 | 600 W to 1000 W units |

- **What it runs:** `test/coverage.mjs` imports the page's own search module (`src/build/search.ts`; before the Vite port, `build.js` in a Node sandbox with a stub DOM). It calls `runSearch()` exactly as the search box does, so the test measures the code that ships, not a copy of it.
- **Found:** a part counts as found if it appears in the 15 results the dropdown shows. Every wanted phrase must match whole words, and a variant word right after the model does not count. For example, "RTX 4070 Ti" does not count as "RTX 4070", and "Crucial P3 Plus" does not count as "Crucial P3".
- **With performance score:** the found part shows at least one performance bar: TechPowerUp's relative performance, or (after the update) a Blender render score.
- **Avg. filled spec rows:** the average number of spec rows with a real value (no "—") for found parts.
- **TechPowerUp limits:** TechPowerUp blocks rapid repeat requests by IP. It returns either "403 - Access Denied: Repeated loading of same URL" or a 200 HTML challenge page instead of JSON. In testing it allowed about 2–3 requests per 4 minutes. The test spaces live queries 75 s apart, backs off when blocked, and caches each successful response in `test/out/tpu-cache.json`.
  - The 134 TechPowerUp queries (GPU, CPU and storage) were collected once, over three resumed runs on 2026-10-17 and 2026-10-18.
  - The after-update run reused those cached responses and made **no** live TechPowerUp calls. The TechPowerUp code path is the same in both versions, so this doesn't affect the comparison.

Run it yourself (Node 22.18 or later):

```
node test/coverage.mjs pre --app <path to an old build.js>     # a run against a pre-Vite build.js from git history
node test/coverage.mjs post                                    # a run against the current src/build/search.ts
node test/coverage.mjs --compare pre post                      # comparison table
```

Raw results are saved to `test/out/coverage-<label>.json`, which is gitignored. Delete `test/out/tpu-cache.json` to re-query TechPowerUp, and expect the rate limit above.

---

## 1. Before the update

Version tested: `build.js` at commit `a56ed57`, with TechPowerUp for GPU, CPU and storage and docyx for RAM, motherboard and PSU.

### Findings

- **GPU: 32 of 54 found (59%).** All RTX 40 and 50-series and RX 7000 and 9000-series cards were found. Many common older or mid-range cards were missing, including the GTX 1070, GTX 1080, GTX 1650, GTX 1660 Super, RTX 2060, RTX 3060 and RX 6600 to 6900 XT. Every found GPU had TechPowerUp's relative performance score.
- **CPU: 21 of 53 found (40%), with no performance score.** TechPowerUp returned mostly flagship chips (Core i7/i9 K, Ryzen 9, X3D). Most Core i5 chips and non-X3D Ryzen 5 and 7 chips were missing, for example the i5-12400F, i7-12700K, Ryzen 5 3600 and Ryzen 7 7700X.
- **Storage: 15 of 27 found (56%).** All four WD SSDs and both hard drives were missing. TechPowerUp's database has no hard drives.
- **TechPowerUp withholding:** the free tier withheld results in **112 of 134** queries (GPU 46 of 54, CPU 45 of 53, storage 21 of 27). The free subset appears to favor flagship and recent parts.
- **RAM, motherboard and PSU (docyx): 38 of 39 found.** The one miss, "Toughpower GF1 850", is explained in section 2.
- **Spec completeness:** every found part had all of its spec rows filled.

### Results

| Category | Reference parts | Found | Found via | With performance score | Queries hit by TPU withholding | Avg. filled spec rows | Errors |
|---|---|---|---|---|---|---|---|
| GPU | 54 | 32 (59%) | TechPowerUp 32 | 32 (59%) | 46 | 8.0 | 0 |
| CPU | 53 | 21 (40%) | TechPowerUp 21 | 0 (0%) | 45 | 7.0 | 0 |
| Storage | 27 | 15 (56%) | TechPowerUp 15 | 0 (0%) | 21 | 7.0 | 0 |
| RAM | 12 | 12 (100%) | docyx 12 | 0 (0%) | 0 | 6.0 | 0 |
| Motherboard | 13 | 13 (100%) | docyx 13 | 0 (0%) | 0 | 4.0 | 0 |
| PSU | 14 | 13 (93%) | docyx 13 | 0 (0%) | 0 | 4.0 | 0 |
| **Total** | **173** | **106 (61%)** | | **32 (18%)** | **112** | **6.5** | **0** |

<details><summary><b>GPU</b>: 32 of 54 found</summary>

Missed: GTX 750 Ti, GTX 960, GTX 1050 Ti, GTX 1070, GTX 1080, GTX 1650, GTX 1660 Super, GTX 1660 Ti, RTX 2060, RTX 2060 Super, RTX 2070 Super, RTX 3050, RTX 3060, RTX 3060 Ti, RTX 3070 Ti, RX 570, RX 5600 XT, RX 6600, RX 6700 XT, RX 6800 XT, RX 6900 XT, Arc A750

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| GTX 750 Ti | ✗ |  |  |  |  |
| GTX 960 | ✗ |  |  |  |  |
| GTX 970 | ✓ | GeForce GTX 970 | TechPowerUp | Relative performance 25 | 8/8 |
| GTX 1050 Ti | ✗ |  |  |  |  |
| GTX 1060 | ✓ | GeForce GTX 1060 6 GB | TechPowerUp | Relative performance 27 | 8/8 |
| GTX 1070 | ✗ |  |  |  |  |
| GTX 1080 | ✗ |  |  |  |  |
| GTX 1080 Ti | ✓ | GeForce GTX 1080 Ti | TechPowerUp | Relative performance 56 | 8/8 |
| GTX 1650 | ✗ |  |  |  |  |
| GTX 1660 Super | ✗ |  |  |  |  |
| GTX 1660 Ti | ✗ |  |  |  |  |
| RTX 2060 | ✗ |  |  |  |  |
| RTX 2060 Super | ✗ |  |  |  |  |
| RTX 2070 Super | ✗ |  |  |  |  |
| RTX 2080 Ti | ✓ | GeForce RTX 2080 Ti | TechPowerUp | Relative performance 79 | 8/8 |
| RTX 3050 | ✗ |  |  |  |  |
| RTX 3060 | ✗ |  |  |  |  |
| RTX 3060 Ti | ✗ |  |  |  |  |
| RTX 3070 | ✓ | GeForce RTX 3070 | TechPowerUp | Relative performance 79 | 8/8 |
| RTX 3070 Ti | ✗ |  |  |  |  |
| RTX 3080 | ✓ | GeForce RTX 3080 | TechPowerUp | Relative performance 100 | 8/8 |
| RTX 3090 | ✓ | GeForce RTX 3090 | TechPowerUp | Relative performance 113 | 8/8 |
| RTX 4060 | ✓ | GeForce RTX 4060 | TechPowerUp | Relative performance 63 | 8/8 |
| RTX 4060 Ti | ✓ | GeForce RTX 4060 Ti 8 GB | TechPowerUp | Relative performance 78 | 8/8 |
| RTX 4070 | ✓ | GeForce RTX 4070 | TechPowerUp | Relative performance 103 | 8/8 |
| RTX 4070 Super | ✓ | GeForce RTX 4070 SUPER | TechPowerUp | Relative performance 108 | 8/8 |
| RTX 4070 Ti | ✓ | GeForce RTX 4070 Ti | TechPowerUp | Relative performance 115 | 8/8 |
| RTX 4080 | ✓ | GeForce RTX 4080 | TechPowerUp | Relative performance 149 | 8/8 |
| RTX 4090 | ✓ | GeForce RTX 4090 | TechPowerUp | Relative performance 195 | 8/8 |
| RTX 5060 | ✓ | GeForce RTX 5060 | TechPowerUp | Relative performance 77 | 8/8 |
| RTX 5060 Ti | ✓ | GeForce RTX 5060 Ti 8 GB | TechPowerUp | Relative performance 89 | 8/8 |
| RTX 5070 | ✓ | GeForce RTX 5070 | TechPowerUp | Relative performance 114 | 8/8 |
| RTX 5070 Ti | ✓ | GeForce RTX 5070 Ti | TechPowerUp | Relative performance 147 | 8/8 |
| RTX 5080 | ✓ | GeForce RTX 5080 | TechPowerUp | Relative performance 169 | 8/8 |
| RTX 5090 | ✓ | GeForce RTX 5090 | TechPowerUp | Relative performance 256 | 8/8 |
| RX 570 | ✗ |  |  |  |  |
| RX 580 | ✓ | Radeon RX 580 | TechPowerUp | Relative performance 28 | 8/8 |
| RX 5600 XT | ✗ |  |  |  |  |
| RX 5700 XT | ✓ | Radeon RX 5700 XT | TechPowerUp | Relative performance 50 | 8/8 |
| RX 6600 | ✗ |  |  |  |  |
| RX 6700 XT | ✗ |  |  |  |  |
| RX 6800 XT | ✗ |  |  |  |  |
| RX 6900 XT | ✗ |  |  |  |  |
| RX 7600 | ✓ | Radeon RX 7600 | TechPowerUp | Relative performance 59 | 8/8 |
| RX 7700 XT | ✓ | Radeon RX 7700 XT | TechPowerUp | Relative performance 87 | 8/8 |
| RX 7800 XT | ✓ | Radeon RX 7800 XT | TechPowerUp | Relative performance 100 | 8/8 |
| RX 7900 XT | ✓ | Radeon RX 7900 XT | TechPowerUp | Relative performance 129 | 8/8 |
| RX 7900 XTX | ✓ | Radeon RX 7900 XTX | TechPowerUp | Relative performance 149 | 8/8 |
| RX 9060 XT | ✓ | Radeon RX 9060 XT 8 GB | TechPowerUp | Relative performance 80 | 8/8 |
| RX 9070 | ✓ | Radeon RX 9070 | TechPowerUp | Relative performance 126 | 8/8 |
| RX 9070 XT | ✓ | Radeon RX 9070 XT | TechPowerUp | Relative performance 141 | 8/8 |
| Arc A750 | ✗ |  |  |  |  |
| Arc A770 | ✓ | Arc A770 | TechPowerUp | Relative performance 55 | 8/8 |
| Arc B580 | ✓ | Arc B580 | TechPowerUp | Relative performance 62 | 8/8 |

</details>

<details><summary><b>CPU</b>: 21 of 53 found</summary>

Missed: i5-2500K, i7-4790K, i5-6600K, i5-8400, i5-9600K, i5-10400, i7-10700K, i5-11400F, i5-12400F, i5-12600K, i7-12700K, i5-13400F, i7-13700K, i5-14400F, i5-14600K, i7-14700K, Core Ultra 5 245K, Core Ultra 7 265K, FX-8350, Ryzen 7 1700X, Ryzen 5 2600, Ryzen 5 3600, Ryzen 7 3700X, Ryzen 5 5600, Ryzen 7 5700X, Ryzen 9 5950X, Ryzen 5 7600X, Ryzen 7 7700X, Ryzen 9 7900X, Ryzen 9 7950X3D, Ryzen 5 9600X, Ryzen 7 9700X

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| i5-2500K | ✗ |  |  |  |  |
| i7-2600K | ✓ | Core i7-2600K | TechPowerUp |  | 7/7 |
| i7-3770K | ✓ | Core i7-3770K | TechPowerUp |  | 7/7 |
| i7-4790K | ✗ |  |  |  |  |
| i5-6600K | ✗ |  |  |  |  |
| i7-6700K | ✓ | Core i7-6700K | TechPowerUp |  | 7/7 |
| i7-7700K | ✓ | Core i7-7700K | TechPowerUp |  | 7/7 |
| i5-8400 | ✗ |  |  |  |  |
| i7-8700K | ✓ | Core i7-8700K | TechPowerUp |  | 7/7 |
| i5-9600K | ✗ |  |  |  |  |
| i9-9900K | ✓ | Core i9-9900K | TechPowerUp |  | 7/7 |
| i5-10400 | ✗ |  |  |  |  |
| i7-10700K | ✗ |  |  |  |  |
| i9-10900K | ✓ | Core i9-10900K | TechPowerUp |  | 7/7 |
| i5-11400F | ✗ |  |  |  |  |
| i5-12400F | ✗ |  |  |  |  |
| i5-12600K | ✗ |  |  |  |  |
| i7-12700K | ✗ |  |  |  |  |
| i9-12900K | ✓ | Core i9-12900K | TechPowerUp |  | 7/7 |
| i5-13400F | ✗ |  |  |  |  |
| i5-13600K | ✓ | Core i5-13600K | TechPowerUp |  | 7/7 |
| i7-13700K | ✗ |  |  |  |  |
| i9-13900K | ✓ | Core i9-13900K | TechPowerUp |  | 7/7 |
| i5-14400F | ✗ |  |  |  |  |
| i5-14600K | ✗ |  |  |  |  |
| i7-14700K | ✗ |  |  |  |  |
| i9-14900K | ✓ | Core i9-14900K | TechPowerUp |  | 7/7 |
| Core Ultra 5 245K | ✗ |  |  |  |  |
| Core Ultra 7 265K | ✗ |  |  |  |  |
| Core Ultra 9 285K | ✓ | Core Ultra 9 285K | TechPowerUp |  | 7/7 |
| FX-8350 | ✗ |  |  |  |  |
| Ryzen 5 1600 | ✓ | Ryzen 5 1600 | TechPowerUp |  | 7/7 |
| Ryzen 7 1700X | ✗ |  |  |  |  |
| Ryzen 5 2600 | ✗ |  |  |  |  |
| Ryzen 7 2700X | ✓ | Ryzen 7 2700X | TechPowerUp |  | 7/7 |
| Ryzen 5 3600 | ✗ |  |  |  |  |
| Ryzen 7 3700X | ✗ |  |  |  |  |
| Ryzen 9 3900X | ✓ | Ryzen 9 3900X | TechPowerUp |  | 7/7 |
| Ryzen 5 5600 | ✗ |  |  |  |  |
| Ryzen 5 5600X | ✓ | Ryzen 5 5600X | TechPowerUp |  | 7/7 |
| Ryzen 7 5700X | ✗ |  |  |  |  |
| Ryzen 7 5800X3D | ✓ | Ryzen 7 5800X3D | TechPowerUp |  | 7/7 |
| Ryzen 9 5900X | ✓ | Ryzen 9 5900X | TechPowerUp |  | 7/7 |
| Ryzen 9 5950X | ✗ |  |  |  |  |
| Ryzen 5 7600X | ✗ |  |  |  |  |
| Ryzen 7 7700X | ✗ |  |  |  |  |
| Ryzen 7 7800X3D | ✓ | Ryzen 7 7800X3D | TechPowerUp |  | 7/7 |
| Ryzen 9 7900X | ✗ |  |  |  |  |
| Ryzen 9 7950X3D | ✗ |  |  |  |  |
| Ryzen 5 9600X | ✗ |  |  |  |  |
| Ryzen 7 9700X | ✗ |  |  |  |  |
| Ryzen 7 9800X3D | ✓ | Ryzen 7 9800X3D | TechPowerUp |  | 7/7 |
| Ryzen 9 9950X | ✓ | Ryzen 9 9950X | TechPowerUp |  | 7/7 |

</details>

<details><summary><b>Storage</b>: 15 of 27 found</summary>

Missed: Samsung 980, WD Black SN850X, WD Black SN770, WD Blue SN580, WD Blue SN570, Kingston KC3000, Kingston A400, SK hynix Platinum P41, Teamgroup MP33, Sabrent Rocket 4 Plus, Seagate BarraCuda 2 TB, WD Blue 1 TB

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| Samsung 990 Pro | ✓ | Samsung 990 Pro 1 TB | TechPowerUp |  | 7/7 |
| Samsung 990 EVO Plus | ✓ | Samsung 990 Evo Plus 2 TB | TechPowerUp |  | 7/7 |
| Samsung 980 Pro | ✓ | Samsung 980 PRO 1 TB | TechPowerUp |  | 7/7 |
| Samsung 980 | ✗ |  |  |  |  |
| Samsung 970 EVO Plus | ✓ | Samsung 970 EVO Plus 1 TB | TechPowerUp |  | 7/7 |
| Samsung 870 EVO | ✓ | Samsung 870 EVO 500 GB | TechPowerUp |  | 7/7 |
| Samsung 860 EVO | ✓ | Samsung 860 EVO 500 GB | TechPowerUp |  | 7/7 |
| Samsung 9100 Pro | ✓ | Samsung 9100 Pro 2 TB | TechPowerUp |  | 7/7 |
| WD Black SN850X | ✗ |  |  |  |  |
| WD Black SN770 | ✗ |  |  |  |  |
| WD Blue SN580 | ✗ |  |  |  |  |
| WD Blue SN570 | ✗ |  |  |  |  |
| Crucial P3 Plus | ✓ | Crucial P3 Plus 1 TB | TechPowerUp |  | 7/7 |
| Crucial P3 | ✓ | Crucial P3 1 TB | TechPowerUp |  | 7/7 |
| Crucial P5 Plus | ✓ | Crucial P5 Plus 1 TB | TechPowerUp |  | 7/7 |
| Crucial T500 | ✓ | Crucial T500 2 TB | TechPowerUp |  | 7/7 |
| Crucial T700 | ✓ | Crucial T700 1 TB | TechPowerUp |  | 7/7 |
| Crucial MX500 | ✓ | Crucial MX500 1 TB | TechPowerUp |  | 7/7 |
| Kingston NV2 | ✓ | Kingston NV2 1 TB | TechPowerUp |  | 7/7 |
| Kingston KC3000 | ✗ |  |  |  |  |
| Kingston A400 | ✗ |  |  |  |  |
| SK hynix Platinum P41 | ✗ |  |  |  |  |
| Seagate FireCuda 530 | ✓ | Seagate FireCuda 530 1 TB | TechPowerUp |  | 7/7 |
| Teamgroup MP33 | ✗ |  |  |  |  |
| Sabrent Rocket 4 Plus | ✗ |  |  |  |  |
| Seagate BarraCuda 2 TB | ✗ |  |  |  |  |
| WD Blue 1 TB | ✗ |  |  |  |  |

</details>

<details><summary><b>RAM</b>: 12 of 12 found</summary>

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| Vengeance LPX 3200 2x8 | ✓ | Corsair Vengeance LPX 16 GB | docyx |  | 6/6 |
| Vengeance LPX 3200 2x16 | ✓ | Corsair Vengeance LPX 32 GB | docyx |  | 6/6 |
| Ripjaws V 3600 2x8 | ✓ | G.Skill Ripjaws V 16 GB | docyx |  | 6/6 |
| Trident Z Neo 3600 2x16 | ✓ | G.Skill Trident Z Neo 32 GB | docyx |  | 6/6 |
| Vengeance RGB 6000 2x16 | ✓ | Corsair Vengeance RGB 32 GB | docyx |  | 6/6 |
| Trident Z5 RGB 6000 2x16 | ✓ | G.Skill Trident Z5 RGB 32 GB | docyx |  | 6/6 |
| Fury Beast 5600 2x16 | ✓ | Kingston FURY Beast 32 GB | docyx |  | 6/6 |
| Ballistix 3200 2x8 | ✓ | Crucial Ballistix 16 GB | docyx |  | 6/6 |
| Delta RGB 3200 2x8 | ✓ | TEAMGROUP T-Force Delta RGB 16 GB | docyx |  | 6/6 |
| Dominator Platinum RGB 6000 2x16 | ✓ | Corsair Dominator Platinum RGB 32 GB | docyx |  | 6/6 |
| HyperX Fury DDR3 1600 2x4 | ✓ | Kingston HyperX Fury 8 GB | docyx |  | 6/6 |
| Vengeance DDR3 1600 2x4 | ✓ | Corsair Vengeance 8 GB | docyx |  | 6/6 |

</details>

<details><summary><b>Motherboard</b>: 13 of 13 found</summary>

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| ROG Strix B550-F Gaming | ✓ | Asus ROG STRIX B550-F GAMING | docyx |  | 4/4 |
| B450 Tomahawk Max | ✓ | MSI B450 TOMAHAWK MAX | docyx |  | 4/4 |
| B650 Tomahawk | ✓ | MSI MAG B650 TOMAHAWK WIFI | docyx |  | 4/4 |
| TUF Gaming X570-Plus | ✓ | Asus TUF GAMING X570-PLUS | docyx |  | 4/4 |
| B550 Aorus Elite | ✓ | Gigabyte B550 AORUS ELITE | docyx |  | 4/4 |
| B450M Pro4 | ✓ | ASRock B450M Pro4 | docyx |  | 4/4 |
| Z790-A WiFi | ✓ | MSI PRO Z790-A WIFI | docyx |  | 4/4 |
| Strix Z690-E | ✓ | Asus ROG STRIX Z690-E GAMING WIFI | docyx |  | 4/4 |
| Z390 Aorus Pro | ✓ | Gigabyte Z390 AORUS PRO | docyx |  | 4/4 |
| Prime Z270-A | ✓ | Asus PRIME Z270-A | docyx |  | 4/4 |
| Prime B760M-A | ✓ | Asus PRIME B760M-A | docyx |  | 4/4 |
| X870E Aorus Master | ✓ | Gigabyte X870E AORUS MASTER | docyx |  | 4/4 |
| B650M Pro RS | ✓ | ASRock B650M Pro RS | docyx |  | 4/4 |

</details>

<details><summary><b>PSU</b>: 13 of 14 found</summary>

Missed: Toughpower GF1 850

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| RM850x | ✓ | Corsair RM850x | docyx |  | 4/4 |
| RM750x | ✓ | Corsair RM750x | docyx |  | 4/4 |
| RM650 | ✓ | Corsair RM650 | docyx |  | 4/4 |
| SuperNOVA 750 G5 | ✓ | EVGA SuperNOVA 750 G5 | docyx |  | 4/4 |
| EVGA 600 BR | ✓ | EVGA 600 BR | docyx |  | 4/4 |
| Focus GX-750 | ✓ | SeaSonic FOCUS GX-750 ATX 3.0 | docyx |  | 4/4 |
| Prime TX-1000 | ✓ | SeaSonic PRIME TX-1000 | docyx |  | 4/4 |
| Straight Power 11 750 | ✓ | be quiet! Straight Power 11 | docyx |  | 4/4 |
| MWE Gold 750 V2 | ✓ | Cooler Master MWE GOLD 750 V2 | docyx |  | 4/4 |
| Toughpower GF1 850 | ✗ |  |  |  |  |
| CX650M | ✓ | Corsair CX650M | docyx |  | 4/4 |
| A850GL | ✓ | MSI MAG A850GL PCIE5 | docyx |  | 4/4 |
| HX1000i | ✓ | Corsair HX1000i | docyx |  | 4/4 |
| SF750 | ✓ | Corsair SF750 (2024) | docyx |  | 4/4 |

</details>

---

## 2. After the update

### What changed

| Change | Files |
|---|---|
| GPU search adds an offline fallback of 2,445 reference GPUs from **GPU Ark** (CC BY 4.0), with no board-partner cards | `scripts/build_data.mjs`, `data/gpu.json`, `build.js` |
| CPU search adds an offline fallback of 961 CPUs from **docyx** | `data/cpu.json`, `build.js` |
| Storage search adds an offline fallback of 5,663 SSDs and hard drives from **docyx** (an extension beyond `datasets.md`) | `data/storage.json`, `build.js` |
| CPUs and GPUs get a **Blender Open Data** render score (Blender 4.5, median samples per minute; 1,212 CPUs, 445 GPUs) | `data/bench.json`, `build.js` |
| Footer credits GPU Ark and Blender Open Data; part cards show where specs and scores came from | `build.html`, `build.css`, `build.js` |

How the search combines sources:

- **Order:** TechPowerUp results come first, then offline parts it didn't return.
- **Duplicates:** compared by model name, so "GeForce RTX 4070" and "NVIDIA GeForce RTX 4070" count as one part.
- **TechPowerUp down:** if it is unreachable or blocking, the search shows offline results with a note instead of an error.
- **Blender scores:**
  - **Bar scale:** 100% is the Ryzen 9 9950X3D (663.5) for CPUs and the RTX 5090 (14,966) for GPUs. Workstation and server chips score up to 10 times higher and would otherwise squash every desktop part's bar.
  - **Backend choice:** each GPU uses the backend with the most runs, so a one-run outlier can't win.

### Comparison

| Category | Reference parts | Found (pre → post) | With performance score (pre → post) | Avg. filled spec rows (pre → post) | Found via (post) |
|---|---|---|---|---|---|
| GPU | 54 | 32 → 54 | 32 → 53 | 8.0 → 8.1 | GPU Ark 22, TechPowerUp 32 |
| CPU | 53 | 21 → 53 | 0 → 53 | 7.0 → 5.8 | docyx 32, TechPowerUp 21 |
| Storage | 27 | 15 → 27 | 0 → 0 | 7.0 → 5.7 | TechPowerUp 15, docyx 12 |
| RAM | 12 | 12 → 12 | 0 → 0 | 6.0 → 6.0 | docyx 12 |
| Motherboard | 13 | 13 → 13 | 0 → 0 | 4.0 → 4.0 | docyx 13 |
| PSU | 14 | 13 → 13 | 0 → 0 | 4.0 → 4.0 | docyx 13 |
| **Total** | **173** | **106 (61%) → 172 (99%)** | **32 (18%) → 106 (61%)** | **6.5 → 6.2** | |

Newly found (66):
- **GPU (22):** GTX 750 Ti, GTX 960, GTX 1050 Ti, GTX 1070, GTX 1080, GTX 1650, GTX 1660 Super, GTX 1660 Ti, RTX 2060, RTX 2060 Super, RTX 2070 Super, RTX 3050, RTX 3060, RTX 3060 Ti, RTX 3070 Ti, RX 570, RX 5600 XT, RX 6600, RX 6700 XT, RX 6800 XT, RX 6900 XT, Arc A750
- **CPU (32):** i5-2500K, i7-4790K, i5-6600K, i5-8400, i5-9600K, i5-10400, i7-10700K, i5-11400F, i5-12400F, i5-12600K, i7-12700K, i5-13400F, i7-13700K, i5-14400F, i5-14600K, i7-14700K, Core Ultra 5 245K, Core Ultra 7 265K, FX-8350, Ryzen 7 1700X, Ryzen 5 2600, Ryzen 5 3600, Ryzen 7 3700X, Ryzen 5 5600, Ryzen 7 5700X, Ryzen 9 5950X, Ryzen 5 7600X, Ryzen 7 7700X, Ryzen 9 7900X, Ryzen 9 7950X3D, Ryzen 5 9600X, Ryzen 7 9700X
- **Storage (12):** Samsung 980, WD Black SN850X, WD Black SN770, WD Blue SN580, WD Blue SN570, Kingston KC3000, Kingston A400, SK hynix Platinum P41, Teamgroup MP33, Sabrent Rocket 4 Plus, Seagate BarraCuda 2 TB, WD Blue 1 TB

No longer found (0):
- none

### Findings

- **GPU: 32 → 54 found (100%), 32 → 53 with a score.** The 22 new finds all come from GPU Ark. 31 of the 32 TechPowerUp GPUs now show both TechPowerUp's relative performance and a Blender score.
  - **RX 570:** the only GPU without a score.
  - **RX 580:** has TechPowerUp's score but no Blender score.
  - Blender's AMD backend (HIP) doesn't run on these older GCN cards, so Blender has no results for them.
- **CPU: 21 → 53 found (100%), 0 → 53 with a score.** The 32 new finds come from docyx. Every CPU now has a Blender score.
- **Storage: 15 → 27 found (100%), still no performance score.** The 12 new finds come from docyx, including both hard drives. None of the sources has a storage benchmark. Read and write speeds appear only for drives TechPowerUp returns.
- **RAM, motherboard and PSU are unchanged.** Their data files were rebuilt byte-identical.
  - **PSU miss:** "Toughpower GF1 850" is still counted as missed. The search does show four 850 W GF1 units (PE, ARGB, 2024 and Snow), but the test requires "GF1 850" with nothing in between. This is the test being strict, not missing data.
- **Avg. filled spec rows fell from 6.5 to 6.2.** Offline records have fewer fields than TechPowerUp's:
  - **docyx CPUs:** 5 rows. There are no thread, cache, process, memory or socket fields.
  - **docyx drives:** 5 rows. There are no read/write speeds, endurance or flash type.
  - **GPU Ark:** 9 rows, adding FP32 TFLOPS, so the GPU average rose slightly (8.0 → 8.1).
- **Scores to treat with care:**
  - **Approximate:** 4 GPU scores were matched without the memory size, because Blender doesn't record VRAM: RTX 3060 8 GB, RTX 4060 Ti 8 GB, RTX 5060 Ti 8 GB and RX 9060 XT 8 GB. The page labels these "approximate: scored as …".
  - **Few runs:** 2 scores rest on fewer than 5 runs: the RTX 3050 (matched to the OEM variant, 2 runs) and the i5-2500K (3 runs). The page shows the run count with every score.

### Results

| Category | Reference parts | Found | Found via | With performance score | Queries hit by TPU withholding | Avg. filled spec rows | Errors |
|---|---|---|---|---|---|---|---|
| GPU | 54 | 54 (100%) | GPU Ark 22, TechPowerUp 32 | 53 (98%) | 46 | 8.1 | 0 |
| CPU | 53 | 53 (100%) | docyx 32, TechPowerUp 21 | 53 (100%) | 45 | 5.8 | 0 |
| Storage | 27 | 27 (100%) | TechPowerUp 15, docyx 12 | 0 (0%) | 21 | 5.7 | 0 |
| RAM | 12 | 12 (100%) | docyx 12 | 0 (0%) | 0 | 6.0 | 0 |
| Motherboard | 13 | 13 (100%) | docyx 13 | 0 (0%) | 0 | 4.0 | 0 |
| PSU | 14 | 13 (93%) | docyx 13 | 0 (0%) | 0 | 4.0 | 0 |
| **Total** | **173** | **172 (99%)** | | **106 (61%)** | **112** | **6.2** | **0** |

<details><summary><b>GPU</b>: 54 of 54 found</summary>

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| GTX 750 Ti | ✓ | NVIDIA GeForce GTX 750 Ti | GPU Ark | Blender render score 92 | 8/9 |
| GTX 960 | ✓ | NVIDIA GeForce GTX 960 | GPU Ark | Blender render score 164 | 8/9 |
| GTX 970 | ✓ | GeForce GTX 970 | TechPowerUp | Relative performance 25; Blender render score 255 | 8/8 |
| GTX 1050 Ti | ✓ | NVIDIA GeForce GTX 1050 Ti | GPU Ark | Blender render score 208 | 8/9 |
| GTX 1060 | ✓ | GeForce GTX 1060 6 GB | TechPowerUp | Relative performance 27; Blender render score 360 | 8/8 |
| GTX 1070 | ✓ | NVIDIA GeForce GTX 1070 | GPU Ark | Blender render score 521 | 8/9 |
| GTX 1080 | ✓ | NVIDIA GeForce GTX 1080 | GPU Ark | Blender render score 585 | 8/9 |
| GTX 1080 Ti | ✓ | GeForce GTX 1080 Ti | TechPowerUp | Relative performance 56; Blender render score 821 | 8/8 |
| GTX 1650 | ✓ | NVIDIA GeForce GTX 1650 | GPU Ark | Blender render score 424 | 8/9 |
| GTX 1660 Super | ✓ | NVIDIA GeForce GTX 1660 SUPER | GPU Ark | Blender render score 748 | 8/9 |
| GTX 1660 Ti | ✓ | NVIDIA GeForce GTX 1660 Ti | GPU Ark | Blender render score 743 | 8/9 |
| RTX 2060 | ✓ | NVIDIA GeForce RTX 2060 | GPU Ark | Blender render score 1,562 | 9/9 |
| RTX 2060 Super | ✓ | NVIDIA GeForce RTX 2060 SUPER | GPU Ark | Blender render score 2,060 | 9/9 |
| RTX 2070 Super | ✓ | NVIDIA GeForce RTX 2070 SUPER | GPU Ark | Blender render score 2,223 | 9/9 |
| RTX 2080 Ti | ✓ | GeForce RTX 2080 Ti | TechPowerUp | Relative performance 79; Blender render score 2,838 | 8/8 |
| RTX 3050 | ✓ | NVIDIA GeForce RTX 3050 OEM | GPU Ark | Blender render score 1,469 | 9/9 |
| RTX 3060 | ✓ | NVIDIA GeForce RTX 3060 8 GB | GPU Ark | Blender render score 2,155 | 9/9 |
| RTX 3060 Ti | ✓ | NVIDIA GeForce RTX 3060 Ti | GPU Ark | Blender render score 2,765 | 9/9 |
| RTX 3070 | ✓ | GeForce RTX 3070 | TechPowerUp | Relative performance 79; Blender render score 3,190 | 8/8 |
| RTX 3070 Ti | ✓ | NVIDIA GeForce RTX 3070 Ti | GPU Ark | Blender render score 3,494 | 9/9 |
| RTX 3080 | ✓ | GeForce RTX 3080 | TechPowerUp | Relative performance 100; Blender render score 4,529 | 8/8 |
| RTX 3090 | ✓ | GeForce RTX 3090 | TechPowerUp | Relative performance 113; Blender render score 5,412 | 8/8 |
| RTX 4060 | ✓ | GeForce RTX 4060 | TechPowerUp | Relative performance 63; Blender render score 3,182 | 8/8 |
| RTX 4060 Ti | ✓ | GeForce RTX 4060 Ti 8 GB | TechPowerUp | Relative performance 78; Blender render score 3,941 | 8/8 |
| RTX 4070 | ✓ | GeForce RTX 4070 | TechPowerUp | Relative performance 103; Blender render score 5,219 | 8/8 |
| RTX 4070 Super | ✓ | GeForce RTX 4070 SUPER | TechPowerUp | Relative performance 108; Blender render score 6,247 | 8/8 |
| RTX 4070 Ti | ✓ | GeForce RTX 4070 Ti | TechPowerUp | Relative performance 115; Blender render score 6,369 | 8/8 |
| RTX 4080 | ✓ | GeForce RTX 4080 | TechPowerUp | Relative performance 149; Blender render score 8,388 | 8/8 |
| RTX 4090 | ✓ | GeForce RTX 4090 | TechPowerUp | Relative performance 195; Blender render score 11,062 | 8/8 |
| RTX 5060 | ✓ | GeForce RTX 5060 | TechPowerUp | Relative performance 77; Blender render score 3,681 | 8/8 |
| RTX 5060 Ti | ✓ | GeForce RTX 5060 Ti 8 GB | TechPowerUp | Relative performance 89; Blender render score 4,309 | 8/8 |
| RTX 5070 | ✓ | GeForce RTX 5070 | TechPowerUp | Relative performance 114; Blender render score 6,174 | 8/8 |
| RTX 5070 Ti | ✓ | GeForce RTX 5070 Ti | TechPowerUp | Relative performance 147; Blender render score 7,589 | 8/8 |
| RTX 5080 | ✓ | GeForce RTX 5080 | TechPowerUp | Relative performance 169; Blender render score 9,138 | 8/8 |
| RTX 5090 | ✓ | GeForce RTX 5090 | TechPowerUp | Relative performance 256; Blender render score 14,966 | 8/8 |
| RX 570 | ✓ | AMD Radeon RX 570 | GPU Ark |  | 8/9 |
| RX 580 | ✓ | Radeon RX 580 | TechPowerUp | Relative performance 28 | 8/8 |
| RX 5600 XT | ✓ | AMD Radeon RX 5600 XT | GPU Ark | Blender render score 696 | 8/9 |
| RX 5700 XT | ✓ | Radeon RX 5700 XT | TechPowerUp | Relative performance 50; Blender render score 961 | 8/8 |
| RX 6600 | ✓ | AMD Radeon RX 6600 | GPU Ark | Blender render score 933 | 8/9 |
| RX 6700 XT | ✓ | AMD Radeon RX 6700 XT | GPU Ark | Blender render score 1,462 | 8/9 |
| RX 6800 XT | ✓ | AMD Radeon RX 6800 XT | GPU Ark | Blender render score 2,406 | 8/9 |
| RX 6900 XT | ✓ | AMD Radeon RX 6900 XT | GPU Ark | Blender render score 2,603 | 8/9 |
| RX 7600 | ✓ | Radeon RX 7600 | TechPowerUp | Relative performance 59; Blender render score 1,157 | 8/8 |
| RX 7700 XT | ✓ | Radeon RX 7700 XT | TechPowerUp | Relative performance 87; Blender render score 2,084 | 8/8 |
| RX 7800 XT | ✓ | Radeon RX 7800 XT | TechPowerUp | Relative performance 100; Blender render score 2,458 | 8/8 |
| RX 7900 XT | ✓ | Radeon RX 7900 XT | TechPowerUp | Relative performance 129; Blender render score 3,607 | 8/8 |
| RX 7900 XTX | ✓ | Radeon RX 7900 XTX | TechPowerUp | Relative performance 149; Blender render score 4,329 | 8/8 |
| RX 9060 XT | ✓ | Radeon RX 9060 XT 8 GB | TechPowerUp | Relative performance 80; Blender render score 1,615 | 8/8 |
| RX 9070 | ✓ | Radeon RX 9070 | TechPowerUp | Relative performance 126; Blender render score 2,841 | 8/8 |
| RX 9070 XT | ✓ | Radeon RX 9070 XT | TechPowerUp | Relative performance 141; Blender render score 3,279 | 8/8 |
| Arc A750 | ✓ | Intel Arc A750 | GPU Ark | Blender render score 2,226 | 8/9 |
| Arc A770 | ✓ | Arc A770 | TechPowerUp | Relative performance 55; Blender render score 2,448 | 8/8 |
| Arc B580 | ✓ | Arc B580 | TechPowerUp | Relative performance 62; Blender render score 2,373 | 8/8 |

</details>

<details><summary><b>CPU</b>: 53 of 53 found</summary>

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| i5-2500K | ✓ | Intel Core i5-2500K | docyx | Blender render score 27 | 4/5 |
| i7-2600K | ✓ | Core i7-2600K | TechPowerUp | Blender render score 53 | 7/7 |
| i7-3770K | ✓ | Core i7-3770K | TechPowerUp | Blender render score 49 | 7/7 |
| i7-4790K | ✓ | Intel Core i7-4790K | docyx | Blender render score 74 | 5/5 |
| i5-6600K | ✓ | Intel Core i5-6600K | docyx | Blender render score 65 | 5/5 |
| i7-6700K | ✓ | Core i7-6700K | TechPowerUp | Blender render score 85 | 7/7 |
| i7-7700K | ✓ | Core i7-7700K | TechPowerUp | Blender render score 89 | 7/7 |
| i5-8400 | ✓ | Intel Core i5-8400 | docyx | Blender render score 78 | 5/5 |
| i7-8700K | ✓ | Core i7-8700K | TechPowerUp | Blender render score 122 | 7/7 |
| i5-9600K | ✓ | Intel Core i5-9600K | docyx | Blender render score 101 | 5/5 |
| i9-9900K | ✓ | Core i9-9900K | TechPowerUp | Blender render score 170 | 7/7 |
| i5-10400 | ✓ | Intel Core i5-10400 | docyx | Blender render score 117 | 5/5 |
| i7-10700K | ✓ | Intel Core i7-10700K | docyx | Blender render score 180 | 5/5 |
| i9-10900K | ✓ | Core i9-10900K | TechPowerUp | Blender render score 239 | 7/7 |
| i5-11400F | ✓ | Intel Core i5-11400F | docyx | Blender render score 123 | 5/5 |
| i5-12400F | ✓ | Intel Core i5-12400F | docyx | Blender render score 154 | 5/5 |
| i5-12600K | ✓ | Intel Core i5-12600K | docyx | Blender render score 222 | 5/5 |
| i7-12700K | ✓ | Intel Core i7-12700K | docyx | Blender render score 286 | 5/5 |
| i9-12900K | ✓ | Core i9-12900K | TechPowerUp | Blender render score 354 | 7/7 |
| i5-13400F | ✓ | Intel Core i5-13400F | docyx | Blender render score 205 | 5/5 |
| i5-13600K | ✓ | Core i5-13600K | TechPowerUp | Blender render score 302 | 7/7 |
| i7-13700K | ✓ | Intel Core i7-13700K | docyx | Blender render score 387 | 5/5 |
| i9-13900K | ✓ | Core i9-13900K | TechPowerUp | Blender render score 485 | 7/7 |
| i5-14400F | ✓ | Intel Core i5-14400F | docyx | Blender render score 202 | 5/5 |
| i5-14600K | ✓ | Intel Core i5-14600K | docyx | Blender render score 302 | 5/5 |
| i7-14700K | ✓ | Intel Core i7-14700K | docyx | Blender render score 442 | 5/5 |
| i9-14900K | ✓ | Core i9-14900K | TechPowerUp | Blender render score 508 | 7/7 |
| Core Ultra 5 245K | ✓ | Intel Core Ultra 5 245K | docyx | Blender render score 318 | 5/5 |
| Core Ultra 7 265K | ✓ | Intel Core Ultra 7 265K | docyx | Blender render score 478 | 5/5 |
| Core Ultra 9 285K | ✓ | Core Ultra 9 285K | TechPowerUp | Blender render score 562 | 7/7 |
| FX-8350 | ✓ | AMD FX-8350 | docyx | Blender render score 52 | 4/5 |
| Ryzen 5 1600 | ✓ | Ryzen 5 1600 | TechPowerUp | Blender render score 97 | 7/7 |
| Ryzen 7 1700X | ✓ | AMD Ryzen 7 1700X | docyx | Blender render score 126 | 5/5 |
| Ryzen 5 2600 | ✓ | AMD Ryzen 5 2600 | docyx | Blender render score 107 | 5/5 |
| Ryzen 7 2700X | ✓ | Ryzen 7 2700X | TechPowerUp | Blender render score 144 | 7/7 |
| Ryzen 5 3600 | ✓ | AMD Ryzen 5 3600 | docyx | Blender render score 130 | 5/5 |
| Ryzen 7 3700X | ✓ | AMD Ryzen 7 3700X | docyx | Blender render score 174 | 5/5 |
| Ryzen 9 3900X | ✓ | Ryzen 9 3900X | TechPowerUp | Blender render score 268 | 7/7 |
| Ryzen 5 5600 | ✓ | AMD Ryzen 5 5600 | docyx | Blender render score 150 | 5/5 |
| Ryzen 5 5600X | ✓ | Ryzen 5 5600X | TechPowerUp | Blender render score 151 | 7/7 |
| Ryzen 7 5700X | ✓ | AMD Ryzen 7 5700X | docyx | Blender render score 214 | 5/5 |
| Ryzen 7 5800X3D | ✓ | Ryzen 7 5800X3D | TechPowerUp | Blender render score 210 | 7/7 |
| Ryzen 9 5900X | ✓ | Ryzen 9 5900X | TechPowerUp | Blender render score 306 | 7/7 |
| Ryzen 9 5950X | ✓ | AMD Ryzen 9 5950X | docyx | Blender render score 392 | 5/5 |
| Ryzen 5 7600X | ✓ | AMD Ryzen 5 7600X | docyx | Blender render score 204 | 5/5 |
| Ryzen 7 7700X | ✓ | AMD Ryzen 7 7700X | docyx | Blender render score 279 | 5/5 |
| Ryzen 7 7800X3D | ✓ | Ryzen 7 7800X3D | TechPowerUp | Blender render score 264 | 7/7 |
| Ryzen 9 7900X | ✓ | AMD Ryzen 9 7900X | docyx | Blender render score 414 | 5/5 |
| Ryzen 9 7950X3D | ✓ | AMD Ryzen 9 7950X3D | docyx | Blender render score 540 | 5/5 |
| Ryzen 5 9600X | ✓ | AMD Ryzen 5 9600X | docyx | Blender render score 263 | 5/5 |
| Ryzen 7 9700X | ✓ | AMD Ryzen 7 9700X | docyx | Blender render score 309 | 5/5 |
| Ryzen 7 9800X3D | ✓ | Ryzen 7 9800X3D | TechPowerUp | Blender render score 334 | 7/7 |
| Ryzen 9 9950X | ✓ | Ryzen 9 9950X | TechPowerUp | Blender render score 625 | 7/7 |

</details>

<details><summary><b>Storage</b>: 27 of 27 found</summary>

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| Samsung 990 Pro | ✓ | Samsung 990 Pro 1 TB | TechPowerUp |  | 7/7 |
| Samsung 990 EVO Plus | ✓ | Samsung 990 Evo Plus 2 TB | TechPowerUp |  | 7/7 |
| Samsung 980 Pro | ✓ | Samsung 980 PRO 1 TB | TechPowerUp |  | 7/7 |
| Samsung 980 | ✓ | Samsung 980 1 TB | docyx |  | 4/5 |
| Samsung 970 EVO Plus | ✓ | Samsung 970 EVO Plus 1 TB | TechPowerUp |  | 7/7 |
| Samsung 870 EVO | ✓ | Samsung 870 EVO 500 GB | TechPowerUp |  | 7/7 |
| Samsung 860 EVO | ✓ | Samsung 860 EVO 500 GB | TechPowerUp |  | 7/7 |
| Samsung 9100 Pro | ✓ | Samsung 9100 Pro 2 TB | TechPowerUp |  | 7/7 |
| WD Black SN850X | ✓ | Western Digital WD_Black SN850X 2 TB | docyx |  | 4/5 |
| WD Black SN770 | ✓ | Western Digital Black SN770 1 TB | docyx |  | 4/5 |
| WD Blue SN580 | ✓ | Western Digital Blue SN580 1 TB | docyx |  | 4/5 |
| WD Blue SN570 | ✓ | Western Digital Blue SN570 1 TB | docyx |  | 4/5 |
| Crucial P3 Plus | ✓ | Crucial P3 Plus 1 TB | TechPowerUp |  | 7/7 |
| Crucial P3 | ✓ | Crucial P3 1 TB | TechPowerUp |  | 7/7 |
| Crucial P5 Plus | ✓ | Crucial P5 Plus 1 TB | TechPowerUp |  | 7/7 |
| Crucial T500 | ✓ | Crucial T500 2 TB | TechPowerUp |  | 7/7 |
| Crucial T700 | ✓ | Crucial T700 1 TB | TechPowerUp |  | 7/7 |
| Crucial MX500 | ✓ | Crucial MX500 1 TB | TechPowerUp |  | 7/7 |
| Kingston NV2 | ✓ | Kingston NV2 1 TB | TechPowerUp |  | 7/7 |
| Kingston KC3000 | ✓ | Kingston KC3000 512 GB | docyx |  | 4/5 |
| Kingston A400 | ✓ | Kingston A400 240 GB | docyx |  | 4/5 |
| SK hynix Platinum P41 | ✓ | SK Hynix Platinum P41 2 TB | docyx |  | 4/5 |
| Seagate FireCuda 530 | ✓ | Seagate FireCuda 530 1 TB | TechPowerUp |  | 7/7 |
| Teamgroup MP33 | ✓ | TEAMGROUP MP33 1 TB | docyx |  | 4/5 |
| Sabrent Rocket 4 Plus | ✓ | Sabrent Rocket 4 Plus 8 TB | docyx |  | 4/5 |
| Seagate BarraCuda 2 TB | ✓ | Seagate BarraCuda 2 TB | docyx |  | 5/5 |
| WD Blue 1 TB | ✓ | Western Digital Blue 1 TB | docyx |  | 4/5 |

</details>

<details><summary><b>RAM</b>: 12 of 12 found</summary>

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| Vengeance LPX 3200 2x8 | ✓ | Corsair Vengeance LPX 16 GB | docyx |  | 6/6 |
| Vengeance LPX 3200 2x16 | ✓ | Corsair Vengeance LPX 32 GB | docyx |  | 6/6 |
| Ripjaws V 3600 2x8 | ✓ | G.Skill Ripjaws V 16 GB | docyx |  | 6/6 |
| Trident Z Neo 3600 2x16 | ✓ | G.Skill Trident Z Neo 32 GB | docyx |  | 6/6 |
| Vengeance RGB 6000 2x16 | ✓ | Corsair Vengeance RGB 32 GB | docyx |  | 6/6 |
| Trident Z5 RGB 6000 2x16 | ✓ | G.Skill Trident Z5 RGB 32 GB | docyx |  | 6/6 |
| Fury Beast 5600 2x16 | ✓ | Kingston FURY Beast 32 GB | docyx |  | 6/6 |
| Ballistix 3200 2x8 | ✓ | Crucial Ballistix 16 GB | docyx |  | 6/6 |
| Delta RGB 3200 2x8 | ✓ | TEAMGROUP T-Force Delta RGB 16 GB | docyx |  | 6/6 |
| Dominator Platinum RGB 6000 2x16 | ✓ | Corsair Dominator Platinum RGB 32 GB | docyx |  | 6/6 |
| HyperX Fury DDR3 1600 2x4 | ✓ | Kingston HyperX Fury 8 GB | docyx |  | 6/6 |
| Vengeance DDR3 1600 2x4 | ✓ | Corsair Vengeance 8 GB | docyx |  | 6/6 |

</details>

<details><summary><b>Motherboard</b>: 13 of 13 found</summary>

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| ROG Strix B550-F Gaming | ✓ | Asus ROG STRIX B550-F GAMING | docyx |  | 4/4 |
| B450 Tomahawk Max | ✓ | MSI B450 TOMAHAWK MAX | docyx |  | 4/4 |
| B650 Tomahawk | ✓ | MSI MAG B650 TOMAHAWK WIFI | docyx |  | 4/4 |
| TUF Gaming X570-Plus | ✓ | Asus TUF GAMING X570-PLUS | docyx |  | 4/4 |
| B550 Aorus Elite | ✓ | Gigabyte B550 AORUS ELITE | docyx |  | 4/4 |
| B450M Pro4 | ✓ | ASRock B450M Pro4 | docyx |  | 4/4 |
| Z790-A WiFi | ✓ | MSI PRO Z790-A WIFI | docyx |  | 4/4 |
| Strix Z690-E | ✓ | Asus ROG STRIX Z690-E GAMING WIFI | docyx |  | 4/4 |
| Z390 Aorus Pro | ✓ | Gigabyte Z390 AORUS PRO | docyx |  | 4/4 |
| Prime Z270-A | ✓ | Asus PRIME Z270-A | docyx |  | 4/4 |
| Prime B760M-A | ✓ | Asus PRIME B760M-A | docyx |  | 4/4 |
| X870E Aorus Master | ✓ | Gigabyte X870E AORUS MASTER | docyx |  | 4/4 |
| B650M Pro RS | ✓ | ASRock B650M Pro RS | docyx |  | 4/4 |

</details>

<details><summary><b>PSU</b>: 13 of 14 found</summary>

Missed: Toughpower GF1 850

| Query | Found | Matched part | Source | Performance score | Filled spec rows |
|---|---|---|---|---|---|
| RM850x | ✓ | Corsair RM850x | docyx |  | 4/4 |
| RM750x | ✓ | Corsair RM750x | docyx |  | 4/4 |
| RM650 | ✓ | Corsair RM650 | docyx |  | 4/4 |
| SuperNOVA 750 G5 | ✓ | EVGA SuperNOVA 750 G5 | docyx |  | 4/4 |
| EVGA 600 BR | ✓ | EVGA 600 BR | docyx |  | 4/4 |
| Focus GX-750 | ✓ | SeaSonic FOCUS GX-750 ATX 3.0 | docyx |  | 4/4 |
| Prime TX-1000 | ✓ | SeaSonic PRIME TX-1000 | docyx |  | 4/4 |
| Straight Power 11 750 | ✓ | be quiet! Straight Power 11 | docyx |  | 4/4 |
| MWE Gold 750 V2 | ✓ | Cooler Master MWE GOLD 750 V2 | docyx |  | 4/4 |
| Toughpower GF1 850 | ✗ |  |  |  |  |
| CX650M | ✓ | Corsair CX650M | docyx |  | 4/4 |
| A850GL | ✓ | MSI MAG A850GL PCIE5 | docyx |  | 4/4 |
| HX1000i | ✓ | Corsair HX1000i | docyx |  | 4/4 |
| SF750 | ✓ | Corsair SF750 (2024) | docyx |  | 4/4 |

</details>

---

## 3. Notes and open items

- **TechPowerUp rate limit affects real users too.** The page queries TechPowerUp on every GPU, CPU and storage search (300 ms debounce), and this IP was blocked after a handful of searches. Before the update, a block showed "Couldn't reach TechPowerUp". Now it shows offline results with the note "TechPowerUp didn't respond, so these are offline results only." This was confirmed in the Node sandbox with TechPowerUp disabled. Caching TechPowerUp responses in the page would cut repeat calls further.
- **Browser test (Chrome, 2026-10-18).** TechPowerUp requests were answered from the cached responses in the page, with zero live calls. The live TechPowerUp path in a browser is therefore still untested.
  - **Search:** GPU, CPU, storage and RAM searches return results labeled with their source. RTX 4070 shows TechPowerUp results, RX 6700 XT shows the GPU Ark fallback, and i5-12400F and WD Blue SN580 show docyx results.
  - **Part cards:** the RTX 4070 card shows both bars (TechPowerUp relative performance 102.6 and Blender 5,219 from 262 runs) and "Specs: TechPowerUp · Score: Blender Open Data". CPU cards show the Blender bar, and the hard drive shows `3.5"` and its RPM.
  - **State:** parts and scores survive a reload, Remove clears a card and updates the summary chip, and a second drive can be added to storage.
  - **Phone width:** a 390 px frame has no horizontal scroll, and the score bars fit.
  - **Console:** no errors.
  - **Bug found and fixed:** when TechPowerUp failed and nothing matched offline, the dropdown said only "No matches." It now adds "TechPowerUp didn't respond, so these are offline results only."
  - **Dev server caching:** Chrome kept the old `build.js` after the fix, so hard-reload after editing.
- **GPU Ark data quality:**
  - **Possible TechPowerUp origin:** its chip-variant names match TechPowerUp's closely (for example "RTX 4070 AD103" and "RX 580 2048SP"). It may be derived from TechPowerUp even though it lists itself as original. Check before any public launch (see `datasets.md`, section 5).
  - **Mislabeled rows:** some reference cards, such as the RX 6700 XT and RX 6800 XT, are flagged as retail boards. The build script also keeps any row with a chip-vendor tag, which recovered them.
  - **Mixed VRAM units:** VRAM is stored in MB on older cards and GB on newer ones. The script converts it using the card's release year.
- **Blender scores are rendering-only.** They measure Cycles render throughput, which is a fair CPU multi-core measure but only a rough guide to gaming performance.
- **CPU search could drop TechPowerUp.** docyx with Blender scores found all 53 CPUs with scores, while TechPowerUp added only 21 with more spec rows.
