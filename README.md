# SpecRecs.github.io

Static site built with Vite and TypeScript, deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Develop

Needs Node 22.18 or later.

```
npm install
npm run dev        # dev server at http://localhost:5173 (open /build.html for the "My PC" page)
npm run build      # type-check, then build to dist/
npm run preview    # serve the built dist/ locally
```

## Layout

| Path | What it is |
|---|---|
| `index.html`, `build.html` | Pages (Vite entry points) |
| `src/build/` | "My PC" page: `sources.ts` (data sources and mappers), `search.ts` (search, no DOM), `main.ts` (UI) |
| `public/data/` | Part datasets, served as `/data/*.json`. Rebuild with `npm run data` |
| `scripts/build_data.mjs` | Downloads and cleans the datasets |
| `test/coverage.mjs` | Search coverage test (`npm run coverage -- <label>`); see `docs/coverage.md` |
| `docs/` | Plans and research: `plan.md` (vision), `agent-plan.md` (working spec), `datasets.md`, `coverage.md`, `user_pc_plan.md` |
