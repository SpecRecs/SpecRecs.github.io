# SpecRecs — Agent Build Plan

This document splits SpecRecs into independently buildable modules for subagents. It replaces the narrative in `plan.md` as the working spec. `plan.md` remains the background and vision document.

**Context:** SpecRecs is a non-commercial hobby project for a college course. Keep the scope small, the data curated, and the results reproducible.

---

## 1. Goals and Non-Goals

### Goals

- Recommend desktop PC upgrades and new builds using deterministic, explainable rules.
- Keep performance, specs, pricing, compatibility, recommendation logic, and presentation as separate concerns.
- Run entirely client-side from a versioned JSON data snapshot. No backend and no LLM in the core flow.

### Non-goals (for the MVP)

- Laptops
- Used or marketplace pricing
- Accounts or saved builds
- Micro Center bundles and local inventory
- Live per-request price fetching
- Recommending from open-ended catalogs (the large catalog only identifies the user's current parts; see §2, Catalog)

---

## 2. Settled Decisions

| Area | Decision |
|---|---|
| Frontend | Vite + TypeScript, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`. React is added with the questionnaire and results pages (M6); the existing My PC page (`src/build/`) is plain TypeScript until then. |
| Recommendation and compatibility engines | TypeScript, running in the browser, as pure functions |
| Data pipeline | Node, written in TypeScript (Node 22.18+ runs `.ts` directly), run locally or in CI, producing a JSON snapshot. `scripts/build_data.mjs` is the current version. |
| Shared types | TypeScript types in `src/types/` are the single source of truth, imported by the pipeline, the engines and the UI. The pipeline validates data files against them at runtime before publishing. |
| Catalog | **Two tiers.** The *lookup catalog* (~25,000 parts from open datasets) identifies the user's current parts. The *candidate catalog* (curated, about 20–50 parts per category, with full specs, scores and prices) is the only thing the engine recommends. Each lookup part maps to a candidate by model, so its scores can be compared. |
| Lookup catalog sources | docyx/pc-part-dataset (CPU, RAM, motherboard, PSU, storage), GPU Ark (GPUs), Blender Open Data (render scores). Attribution goes in the README and UI footer; GPU Ark (CC BY 4.0) requires it. |
| Candidate catalog | Curated allowlist with hand-entered specs and compatibility fields, in `data/source/` |
| CPU/GPU performance | **For now:** Blender Open Data render scores (a multi-thread/render measure, not gaming). **Before M4:** gaming scores from the hand-maintained starter sheet `data/source/gpu-data.csv`. Gaming is stored as estimated FPS; other dimensions are normalized (§5). |
| Pricing source | **TBA** (see §6, Module 3) |
| Gaming performance model | Estimated FPS ≈ `min(cpu.perf.gaming_fps, gpu_family.perf.r{res}_fps)`. Both are FPS on the same game suite, so they compare directly. Imbalance is explained, and no bottleneck percentage is shown. |
| Part IDs | Model slugs that join specs, scores and prices: `ryzen-5-7600`, `rtx-4070` (GPU family), `rtx-4070--asus-dual` (variant). Conventions and helpers in `src/types/ids.ts`. |
| Data freshness | Snapshot-based. **Pending (§9):** the My PC page still queries TechPowerUp live from the browser; the proposal is to search offline data only. |

---

## 3. Architecture and Ownership Boundaries

```text
 Open datasets ────────┐
 (docyx, GPU Ark,      │
  Blender)             ├──> [M1 Spec & Performance Import] ─┐
 Curated part sheets ──┤                                     │
 Gaming score sheet ───┘                                     ├──> [M5 Snapshot Build & Validation] ──> public/data/*.json
 Pricing source (TBA) ──> [M3 Pricing Adapter] ──────────────┘                                            │
                                                                                                          v
                                          [M2 Compatibility Engine] <── [M4 Recommendation Engine] <── [M6 Frontend]
```

Hard boundaries:

```text
Specs/performance  !=  Pricing  !=  Compatibility rules  !=  Recommendation logic  !=  Presentation
```

- The engines (M2, M4) never know where the data came from.
- The pipeline (M1, M3, M5) never contains recommendation logic.
- The frontend (M6) never computes scores. It only renders what M4 returns.

---

## 4. Repository Layout and Ownership

```text
SpecRecs.github.io/
├── docs/                     # plans and research (this file, plan.md, datasets.md, coverage.md, user_pc_plan.md)
├── index.html, build.html    # M6: page entry points (Vite)
├── src/
│   ├── types/                # M0: shared types (source of truth; see §2)
│   ├── compatibility/        # M2
│   ├── recommendation/       # M4
│   ├── explanations/         # M4
│   ├── build/                # M6: existing My PC page
│   └── pages/, components/   # M6
├── fixtures/                 # M0: hand-written test catalog (catalog.ts) and requests (requests.ts)
├── config/                   # M4: workload_weights.json, recommendation.json; M2: compatibility.json
├── data/
│   ├── source/               # M1: curated part sheets, gaming score sheet, prices_manual.csv
│   └── raw/                  # M1/M3: raw pulls (gitignored)
├── pipeline/
│   ├── specs/                # M1 (scripts/build_data.mjs moves here)
│   ├── pricing/              # M3 (TBA)
│   └── snapshot/             # M5
├── public/data/              # lookup catalog (*.json); M5 publishes the candidate snapshot to catalog/
├── test/
│   ├── types/                # M0: validator and fixture tests (npm test)
│   ├── scenarios/            # M4: end-to-end recommendation scenarios
│   └── coverage.mjs          # My PC search coverage test (see coverage.md)
└── .github/workflows/        # M5 (deploy.yml)
```

Rule for every agent: **only edit files in the directories you own.** If a contract in `src/types/` needs to change, stop and report it rather than editing it.

---

## 5. Module 0: Contracts and Fixtures (do first, sequentially)

Every other module builds against the output of this one. Do it yourself or with a single agent before spawning anything else.

**Status: done (2026-11-25).** Where this section and the code differ, the code in `src/types/` wins:

| File | Contents |
|---|---|
| `src/types/common.ts` | Shared enums (sockets, memory types, form factors, power connectors, size and style) |
| `src/types/ids.ts` | ID format, `slugify()`, `variantId()` |
| `src/types/parts.ts` | Candidate part entities |
| `src/types/catalog.ts` | `Price`, `Catalog`, `Manifest`, `Snapshot`, `WithCandidate` (lookup → candidate link) |
| `src/types/compatibility.ts` | M2 contract: `BuildParts`, `RuleId`, `CompatibilityReport`, `CompatibilityConfig` |
| `src/types/recommendation.ts` | M4 contract: `Recommendation`, `Reason`, `Warning`, `PerfEstimate` |
| `src/types/request.ts` | `UserRequest`, `CurrentSystem` |
| `src/types/validate.ts`, `validators.ts` | Runtime checks for every entity, and `validateCatalog()` for IDs and cross-file references |
| `fixtures/catalog.ts` | Test catalog; `EDGE_CASES` names the deliberate problem pairs |
| `fixtures/requests.ts` | The inputs of the M4 scenarios (no expected outcomes) |

Conventions settled by M0:

- Every key on a part is required; unknown values are `null`, never omitted.
- `perf.gaming` is `perf.gaming_fps` and the GPU fields are `r1080_fps`, `r1440_fps`, `r4k_fps` (see "Performance scores" below).
- Prices key on purchasable IDs. A GPU price names a variant, never a family.
- A board's `supported_cpu_ids` is a list of CPU IDs, `"socket"` (every CPU on its socket), or `null` (not curated, so support is reported as unknown).
- Cases carry `size_class` and `radiator_mm_supported`; AIO coolers carry `radiator_mm` instead of `height_mm`.
- The candidate snapshot is published as one file per `Catalog` key in `public/data/catalog/` (`cpus.json`, `gpu_families.json`, …, `prices.json`, `manifest.json`), separate from the lookup files.

### Deliverables

- TypeScript types in `src/types/` for each entity below, with units in field names and nullability stated explicitly.
- Runtime validators for the same entities, used by the pipeline to check data files and fixtures.
- Fixture dataset: about 8 CPUs, 8 GPU families with 2 variants each, and 4 of each other part type, plus a few prices. The fixtures should include deliberate edge cases: an oversized GPU, a DDR4/DDR5 mismatch, an underpowered PSU, and a missing price.

### Entities

| Entity | Key fields beyond `plan.md` §8 |
|---|---|
| `cpu` | `id`, `socket`, `memory_types[]`, `tdp_w`, `perf.gaming`, `perf.single`, `perf.multi`, `source` |
| `gpu_family` | `id`, `vram_gb`, `perf.r1080`, `perf.r1440`, `perf.r4k`, `perf.rt`, `source` |
| `gpu_variant` | `id`, `family_id`, `length_mm`, `slot_width`, `tdp_w`, `power_connectors[]`, `recommended_psu_w` |
| `motherboard` | `socket`, `chipset`, `form_factor`, `memory_type`, `memory_slots`, `m2_slots`, `supported_cpu_ids[]` (or a generation list) |
| `memory` | `memory_type`, `capacity_gb`, `module_count`, `speed_mt_s`, `cas_latency` |
| `psu` | `wattage_w`, `form_factor`, `efficiency`, `connectors` (e.g., `pcie_8pin`, `12v_2x6`) |
| `case` | `supported_mb_form_factors[]`, `supported_psu_form_factors[]`, `max_gpu_length_mm`, `max_cooler_height_mm`, `style_tags[]` |
| `cooler` | `type` (air/AIO), `height_mm`, `supported_sockets[]`, `rated_tdp_w`, `radiator_mm` |
| `storage` | `interface` (NVMe/SATA), `form_factor`, `capacity_gb` |
| `price` | `product_id`, `price_usd`, `retailer`, `condition`, `last_checked`, `source` |
| `user_request` | `mode` (new/upgrade), `purpose`, `budget_max_usd`, `budget_preferred_usd`, `resolution`, `size_pref`, `style_pref`, `current_system` (all fields optional) |
| `recommendation` | `categories[]` (best_fit/best_value/performance), `parts[]`, `total_cost_usd`, `perf_estimate`, `gain_pct`, `reasons[]`, `warnings[]` |
| `reason` | `type`, `component`, plus typed payload (see `plan.md` §23) |

The part entities above describe the **candidate catalog**. Lookup-catalog parts keep the fields their dataset provides (see `src/build/raw.ts`) plus a link to the matching candidate, when one exists.

Performance scores:

- **Gaming is FPS, not normalized:** `cpu.perf.gaming_fps` is the FPS a CPU sustains at 1080p when the GPU isn't the limit. `gpu_family.perf.r1080_fps` / `r1440_fps` / `r4k_fps` are the estimated average FPS from the GPU sheet. Gains are FPS ratios.
- **Other dimensions are normalized** so a reference part = 100: Ryzen 5 5600X for CPU `single` and `multi`, RTX 3060 12GB for GPU `rt`.

### Acceptance

- `npm run typecheck` passes for the types, pipeline and fixtures.
- All fixtures pass the validators.

---

## 6. Modules

Each module brief lists its ownership, inputs, outputs, rules, and definition of done. Give each agent **only its brief plus §2–§5**, not the full `plan.md`.

### M1: Spec and Performance Import (Node/TypeScript)

- **Owns:** `pipeline/specs/`, `data/source/`
- **Inputs:** Open datasets (docyx, GPU Ark, Blender Open Data); curated part sheets; the gaming score sheet; `src/types/`
- **Outputs:**
  - Lookup catalog: `cpu.json`, `gpu.json`, `memory.json`, `motherboard.json`, `psu.json`, `storage.json`, `bench.json` (today's files in `public/data/`)
  - Candidate catalog: `cpus.json`, `gpu_families.json`, `gpu_variants.json`, `motherboards.json`, `memory.json`, `psus.json`, `cases.json`, `coolers.json`, `storage.json`. File names and folder are to be settled in M0, so they don't collide with the lookup files.
- **Rules:**
  - Cache raw downloads in `data/raw/` and be gentle with request volume.
  - Map each source's fields to the shared types in one explicit mapping module per source.
  - Every record carries `source`.
  - Normalize performance to the reference part.
- **First task:** Import the gaming score sheet and report which candidate parts have no score, and which sheet rows don't match a part in the lookup catalog.
- **Done when:** All outputs validate. A coverage report lists which source each part came from. Normalization has unit tests.

### M2: Compatibility Engine (TypeScript)

- **Owns:** `src/compatibility/`
- **Inputs:** Shared types; fixtures only
- **Outputs:** `checkBuild(parts, config) → CompatibilityReport` (`{ valid, violations, unknown, notes }`, see `src/types/compatibility.ts`), exported from `src/compatibility/index.ts`, plus per-pair helpers (e.g., `cpuFitsBoard`, `gpuFitsCase`)
- **Hard rules:** Socket, memory type, board-to-case form factor, GPU length, cooler height and socket, PSU wattage (with headroom from config), PSU connectors, PSU form factor, CPU support on the board, M.2 slot count.
- **Soft rules:** Returned as `notes`, never as violations.
- **Rules:** Pure functions with no I/O. Every rule gets a pass test and a fail test. Missing data produces an `unknown` result, not a pass.
- **Done when:** Every rule has tests against the fixtures, and the edge-case fixtures produce the expected violations.
- **Status: done (2026-11-25).** Code in `src/compatibility/` (`rules.ts`, `power.ts`, `index.ts`), tests in `test/compatibility/`. Decisions made while building it:
  - **PSU sizing:** a build needs the larger of (base system draw + CPU TDP + GPU TDP) × (1 + headroom) and the GPU's `recommended_psu_w`. The numbers are in `config/compatibility.json` (headroom 30%, base 75 W). Unknown TDPs can only raise the requirement, so a PSU below the known minimum still fails.
  - **12V-2x6 adapters:** a card needing 12V-2x6 on a PSU without that cable passes if the PSU has enough 8-pin cables for the card's adapter (one per 150 W, at least two), with a `uses_power_adapter` note.
  - **Size limits are inclusive:** a 155 mm cooler fits a 155 mm case.
  - `cpu_board_support` is skipped when the sockets differ (that's already a `socket` failure).
  - Soft notes: `psu_headroom_low` (within 10% of the requirement), `uses_power_adapter`, `cooler_tdp_low`, `no_wifi`.

### M3: Pricing Adapter — **TBA**

Source and collection method are undecided. Other modules must not depend on how prices are collected.

**Fixed contract (so other modules can proceed):**

- The adapter outputs `prices.json` conforming to the `price` type, keyed by canonical `product_id`, for candidate parts only.
- Every price has `retailer`, `condition` (new only for the MVP), and `last_checked`.
- The adapter sits behind a single interface so sources can be swapped: `fetchPrices(productIds) → Promise<Price[]>`.
- Prototype scrapers exist in `test/` (Best Buy, PCPartPicker). They are experiments, not a decision.
- A manual `data/source/prices_manual.csv` is always a valid source.

Until this is decided, M4 and M6 use fixture prices, and M5 accepts manual prices.

### M4: Recommendation Engine and Explanations (TypeScript)

- **Owns:** `src/recommendation/`, `src/explanations/`, `config/`, `test/scenarios/`
- **Inputs:** Shared types; the M2 interface; fixtures
- **Prerequisite:** gaming scores from the starter sheet (§2). Don't start real-data integration on Blender scores alone.
- **Outputs:** `recommend(request, catalog) → Recommendation[]` (best fit, best value, performance) and `explain(reason) → string`, both exported from `src/recommendation/index.ts`
- **Pipeline:** filter (compatibility, budget, price present) → score (workload weights from config) → compare (against the current system, including the full cascading cost) → explain (reason objects).
- **Rules:**
  - Deterministic: same input and snapshot, same output. Break ties by `id`.
  - All weights and thresholds come from `config/`.
  - Upgrade cost includes any required platform change (board and RAM).
  - Parts without a price are excluded.
  - Recommend only candidate-catalog parts. The user's current parts come from the lookup catalog and are compared through their candidate mapping.
  - Use the gaming model from §2.
  - **Unknown compatibility:** a part whose rule comes back `unknown` (missing data) is allowed, and the recommendation carries a `compatibility_unknown` warning for that rule.
  - **Missing current part info:** assume the part is adequate, don't buy a replacement for it, and add a `missing_info` warning (for the PSU: `psu` / `wattage_w`).
  - **Distinct builds:** return 1–3 recommendations. A build that wins several categories is returned once with all of them in `categories`.
  - **Ray tracing is a tie-breaker** in the gaming GPU score, not a reason to pay more for equal raster FPS.
- **Scenario tests (the contract with the frontend):** written in `test/scenarios/scenarios.test.ts` against the fixtures, with exact picks where the fixture math leaves one answer. They skip until `src/recommendation/` and `src/compatibility/` exist. Every scenario also checks shared invariants: within budget, total = sum of parts, priced candidate parts only, complete new builds, no violations, warnings for unknowns, full platform cost, determinism, and an explanation for every reason.
  - 5600X + RTX 3060, $600, 1440p → GPU-only upgrades. Best fit and performance: RX 9060 XT 16GB (+54%). Best value: Arc B580 (+40% for $329).
  - Same system, productivity → best fit: Core i5-14600K + B760M DDR4, reusing the DDR4 kit; `platform_change` costs the full $348; warns that the board's CPU support is unknown
  - $1,000 new build, 1080p gaming → best fit uses the Arc B580 (76 FPS); the RX 9060 XT can't fit in budget
  - $2,500 new build, 4K gaming → best fit uses the RX 9070 XT (80 FPS, same as the RTX 5070 Ti for $321 less)
  - Mini-ITX size preference → every result fits ITX
  - Upgrade with missing PSU info → same pick as the first scenario, no PSU bought, plus a request for the PSU wattage
- **Done when:** Scenario tests pass, and every recommendation has at least one reason. The engine is deterministic across repeated runs.
- **Status: done (2026-11-25).** Code in `src/recommendation/` (`builds.ts` generates candidates, `rank.ts` scores and selects, `perf.ts` is the gaming model) and `src/explanations/`. Unit tests in `test/recommendation/`; all scenarios in `test/scenarios/` pass. How it works and what was decided:
  - **Candidates:** every priced CPU × GPU pair (in upgrades, "keep current" is one option for each). Each pair gets the cheapest supporting parts that pass every hard rule. In upgrades, a current part that still fits costs $0, so it's kept. That's how a platform change picks up its board, memory and cooler cost. Sub-results are memoized: about 10 ms on the fixtures and 0.4 s on a 5× catalog.
  - **Scoring:** weighted terms from `config/workload_weights.json`, each normalized to the best candidate. Each unknown compatibility result multiplies score and value by 0.9 (`unknown_penalty`), so a verified build wins near-ties but a large gain still wins with a warning.
  - **Picks:** best fit = top score; best value = primary metric (new) or % gain (upgrade) per dollar; performance = top primary metric, with ties broken by fewer unknowns, then higher secondary scores (RT, CPU, VRAM), then price. That way a big budget gets a "spend more" option even when FPS is capped.
  - **Memory:** new purchases are at least 16 GB under $1,000 and 32 GB from $1,000 (`min_memory_gb`). New builds get the cheapest drive of at least 1 TB.
  - **Preferences:** `size_pref` is a hard filter on purchased cases (`small` also means a Mini-ITX board). `style_pref` prefers a matching case when one fits.
  - Upgrades below `min_gain_pct` (15%) aren't recommended. `recommend()` can return an empty list.
  - **Price staleness** is measured against the newest price in the catalog, not the clock, so results stay deterministic.

### M5: Snapshot Build and Validation (Node/TypeScript + CI)

- **Owns:** `pipeline/snapshot/`, `.github/workflows/`, `public/data/`
- **Inputs:** M1 outputs; M3 output (or the manual prices CSV)
- **Outputs:** `public/data/` snapshot with a `manifest.json` (version, build time, record counts, sources); a run report
- **Rules:**
  - Validate everything against the shared types before publishing.
  - **Gate:** Refuse to publish if the record counts drop past a threshold, a price moves more than a configurable percentage since the last snapshot, or any referenced ID is missing.
  - A failed build never overwrites the previous snapshot.
  - The snapshot is committed to `public/data/` and deployed with the site by `deploy.yml` (see §9).
- **Done when:** A bad input (e.g., an empty price file) is blocked by the gate in a test. A good input produces a snapshot that the frontend loads.

### M6: Frontend UI (TypeScript/React)

- **Owns:** `src/pages/`, `src/components/`, `src/build/`, `index.html`, `build.html`
- **Inputs:** The M4 `recommend()` signature and `Recommendation` type; fixtures or snapshot
- **Stack:** React is introduced here, for the questionnaire and results pages. Port the My PC page (`src/build/`) to React when it becomes the "current hardware" step.
- **Screens:** Mode → purpose → budget → performance goals → size/style → current hardware (upgrade only) → results/compare
- **Rules:**
  - No scoring logic in components.
  - Show price freshness (`last_checked`), warnings, and reasons.
  - Advanced fields are optional.
  - Credit every data source in the footer (see §2, Lookup catalog sources).
  - Works at phone width.
- **Done when:** The full flow works against fixtures, then against a real snapshot, and each scenario in `test/scenarios/` can be reproduced through the UI.

---

## 7. Sequencing

```text
Phase A (sequential):  M0 contracts + fixtures
Phase B (parallel):    M1 (gaming score sheet first)  |  M2  |  M4 (against M2 stub/fixtures)  |  M6 (against fixtures)
Phase C:               M4 integrates real M2; M5 builds a snapshot from M1 + manual prices
Phase D:               M6 switches to real snapshot; M3 once pricing is decided
```

- M4 can start against a stub of M2's interface and swap in the real one when M2 lands.
- **You** write the expected outcomes for the scenario tests. Agents implement against them but don't invent them.

---

## 8. Instructions for Every Agent

1. Read §2–§5 and your module brief only.
2. Edit only the directories you own.
3. Don't change `src/types/`. Report needed changes instead.
4. No network calls from engine or UI code (`src/`). Only the pipeline downloads data.
5. Put tunable numbers in `config/`, not in code.
6. Finish with passing tests and a short summary: what you built, what's stubbed, and open questions.

---

## 9. Open Decisions

- **Pricing source and collection method** (M3).
- **Live TechPowerUp calls on the My PC page.** Proposal: remove them and search offline data only. With TechPowerUp unreachable, the coverage queries still find all 54 GPUs and 53 CPUs (checked 2026-10-19). Scores drop slightly: 51 GPUs instead of 53, and 52 CPUs instead of 53. TechPowerUp could still enrich candidate parts once, through the pipeline. Until this is settled, the page breaks rule 4 in §8.
- **Snapshot location.** It's committed to `public/data/` on `main` today (about 4 MB). Keep it there, or publish it separately once prices change often.
- Which parts go on the curated allowlist for each category.
- Where CPU `gaming_fps` caps come from. The GPU sheet only covers GPUs; M1 needs a CPU equivalent on the same game suite.
- Initial workload weights and upgrade thresholds (start from `plan.md` §16 and §19).
