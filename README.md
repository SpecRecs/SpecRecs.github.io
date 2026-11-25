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
npm test           # validator and fixture tests (node --test)
```

## Layout

| Path | What it is |
|---|---|
| `index.html`, `build.html` | Pages (Vite entry points) |
| `src/types/` | Shared types and runtime validators: the contracts every module builds against (`docs/agent-plan.md` §5) |
| `src/compatibility/` | Compatibility engine: `checkBuild()` and per-pair helpers. Tunables in `config/compatibility.json` |
| `fixtures/` | Hand-written test catalog and sample requests |
| `src/build/` | "My PC" page: `sources.ts` (data sources and mappers), `search.ts` (search, no DOM), `main.ts` (UI) |
| `public/data/` | Part datasets, served as `/data/*.json`. Rebuild with `npm run data` |
| `scripts/build_data.mjs` | Downloads and cleans the datasets |
| `test/types/`, `test/compatibility/` | Validator, fixture and compatibility tests |
| `test/scenarios/` | M4 recommendation scenarios (skip until the engine exists) |
| `test/coverage.mjs` | Search coverage test (`npm run coverage -- <label>`); see `docs/coverage.md` |
| `docs/` | Plans and research: `plan.md` (vision), `agent-plan.md` (working spec), `datasets.md`, `coverage.md`, `user_pc_plan.md` |
