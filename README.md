# SpecRecs.github.io

Static site built with Vite and TypeScript, deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Develop

Needs Node 22.18 or later.

```
npm install
npm run dev        # dev server at http://localhost:5173 (open /build.html for the "My PC" page)
npm run build      # type-check, then build to dist/
npm run preview    # serve the built dist/ locally
npm run typecheck  # type-check the site, fixtures and tests
npm test           # unit and scenario tests (node --test)
```

## Layout

| Path | What it is |
|---|---|
| `index.html`, `build.html` | Pages (Vite entry points) |
| `src/types/` | Shared types and runtime validators: the contracts every module builds against (`docs/agent-plan.md` §5) |
| `src/compatibility/` | Compatibility engine: `checkBuild()` and per-pair helpers. Tunables in `config/compatibility.json` |
| `src/recommendation/`, `src/explanations/` | Recommendation engine (`recommend()`) and reason templates (`explain()`). Weights and thresholds in `config/` |
| `src/pages/questionnaire/`, `src/pages/results/` | Home page (React): the questionnaire, then the recommendations. Results use the fixture catalog until a snapshot is published |
| `fixtures/` | Hand-written test catalog and sample requests |
| `src/build/` | "My PC" page: `sources.ts` (data sources and mappers), `search.ts` (search, no DOM), `main.ts` (UI) |
| `public/data/` | Part datasets, served as `/data/*.json`. Rebuild with `npm run data` |
| `scripts/build_data.mjs` | Downloads and cleans the datasets |
| `test/types/`, `test/compatibility/`, `test/recommendation/`, `test/pages/` | Validator, fixture, compatibility, engine and results-page tests |
| `test/scenarios/` | End-to-end recommendation scenarios |
| `test/coverage.mjs` | Search coverage test (`npm run coverage -- <label>`); see `docs/coverage.md` |
| `docs/` | Plans and research: `plan.md` (vision), `agent-plan.md` (working spec), `datasets.md`, `coverage.md`, `user_pc_plan.md` |
