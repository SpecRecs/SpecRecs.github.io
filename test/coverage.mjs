// Coverage test for the "My PC" search: how many well-known parts (test/coverage_refs.json) it finds,
// and how complete their data is. Imports the page's own search module (src/build/search.ts) and calls
// runSearch() exactly as the search box does. Node 22.18+ (runs the TypeScript directly), no dependencies.
// --app <path to an old build.js> instead runs a pre-Vite version in a sandbox with a stub DOM.
// TechPowerUp blocks rapid repeat requests ("Repeated loading of same URL"); in testing it allowed about
// 2-3 requests per 4 minutes. Live queries are spaced 75 s apart, back off when blocked, and successful
// responses are cached in test/out/tpu-cache.json, so an interrupted run resumes and later runs reuse
// them. Delete that file to re-query TechPowerUp.
// Usage:
//   node test/coverage.mjs <label> [--app <path to old build.js>]   # markdown report; saves test/out/coverage-<label>.json
//   node test/coverage.mjs --compare <a> <b>                     # compares two saved runs by label
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const PUBLIC = new URL("public/", ROOT);
const OUT = new URL("./out/", import.meta.url);
const CACHE = new URL("tpu-cache.json", OUT);
const UA = "SpecRecs-coverage-test/0.1 (+https://github.com/SpecRecs/SpecRecs.github.io)";
const DELAY_MS = 75_000;
const BACKOFF_MS = [120_000, 300_000, 600_000, 900_000, 900_000];
const LABELS = { gpu: "GPU", cpu: "CPU", storage: "Storage", ram: "RAM", motherboard: "Motherboard", psu: "PSU" };
const KIND_SOURCE = { tpu: "TechPowerUp", dataset: "docyx" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- matching: a ref is found when every wanted phrase appears as whole tokens in a shown result ----
// A phrase followed by a variant word does not count, so "rtx 4070" does not match "RTX 4070 Ti".
const VARIANTS = new Set(["ti", "super", "xt", "xtx", "gre", "plus", "pro", "max", "mobile", "laptop"]);
const tokens = (s) =>
  s.toLowerCase().replace(/\((r|tm)\)|®|™/g, " ").replace(/×/g, "x").replace(/[^a-z0-9.+]+/g, " ").trim().split(" ");
function hasPhrase(toks, phrase) {
  for (let i = 0; i + phrase.length <= toks.length; i++) {
    if (phrase.every((p, j) => toks[i + j] === p) && !VARIANTS.has(toks[i + phrase.length])) return true;
  }
  return false;
}
const matches = (part, wants) => {
  const toks = tokens(`${part.name} ${part.subtitle ?? ""}`);
  return wants.every((w) => hasPhrase(toks, tokens(w)));
};
const filledRows = (specs) => specs.filter(([, v]) => v != null && v !== "" && !String(v).includes("—")).length;

// ---- the app's search, with local data/ files served from public/ on disk ----
const JSON_HEADERS = { "content-type": "application/json" };
let cache = {};
let blocked = null;
let lastNet = 0;
const cacheStats = { hits: 0, fetched: 0 };

async function liveFetch(url, opts) {
  if (cache[url]) {
    cacheStats.hits++;
    return new Response(cache[url], { headers: JSON_HEADERS });
  }
  for (let attempt = 0; ; attempt++) {
    const wait = lastNet + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastNet = Date.now();
    const res = await fetch(url, { ...opts, headers: { "user-agent": UA } });
    const body = await res.text();
    if (res.ok && /json/.test(res.headers.get("content-type") ?? "")) {
      cache[url] = body;
      cacheStats.fetched++;
      await writeFile(CACHE, JSON.stringify(cache));
      return new Response(body, { headers: JSON_HEADERS });
    }
    if (attempt === BACKOFF_MS.length) {
      // Recorded separately because build.js may catch the rejection and fall back to offline data.
      blocked = new Error(`TechPowerUp is still blocking (HTTP ${res.status}). Try again later.`);
      throw blocked;
    }
    process.stderr.write(`TechPowerUp blocked (HTTP ${res.status}); waiting ${BACKOFF_MS[attempt] / 1000} s\n`);
    await sleep(BACKOFF_MS[attempt]);
  }
}

async function sandboxFetch(url, opts = {}) {
  url = String(url);
  if (/^https?:/.test(url)) return liveFetch(url, opts);
  try {
    // "/data/x.json" from src/build/search.ts, or "data/x.json" from an old build.js.
    return new Response(await readFile(new URL(url.replace(/^\//, ""), PUBLIC)), { headers: JSON_HEADERS });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

async function loadApp(appUrl) {
  if (!appUrl) {
    globalThis.fetch = sandboxFetch;
    const { runSearch } = await import(new URL("src/build/search.ts", ROOT));
    const { SOURCES } = await import(new URL("src/build/sources.ts", ROOT));
    return { SOURCES, runSearch };
  }
  const node = () => ({ style: {}, setAttribute() {}, addEventListener() {}, append() {}, replaceChildren() {} });
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, AbortController, URL,
    document: { createElement: node, getElementById: node },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: sandboxFetch,
  });
  vm.runInContext(await readFile(appUrl, "utf8"), ctx, { filename: "build.js" });
  return vm.runInContext("({ SOURCES, runSearch })", ctx);
}

// Every performance figure shown for a part: TechPowerUp's relative performance and/or a Blender score.
const scores = (part) =>
  [part.perf, part.bench].filter(Boolean).map((p) => `${p.label} ${Math.round(p.value).toLocaleString("en-US")}`);

async function run(label, appPath) {
  await mkdir(OUT, { recursive: true });
  cache = JSON.parse(await readFile(CACHE, "utf8").catch(() => "{}"));
  const refs = JSON.parse(await readFile(new URL("coverage_refs.json", import.meta.url), "utf8"));
  const app = await loadApp(appPath && pathToFileURL(resolve(appPath)));
  const results = {};
  for (const [key, list] of Object.entries(refs)) {
    results[key] = [];
    for (const ref of list) {
      const { q, want = q } = typeof ref === "string" ? { q: ref } : ref;
      const row = { q, found: false };
      try {
        const { parts, freeTierOnly } = await app.runSearch(app.SOURCES[key], q);
        const hit = parts.find((p) => matches(p, [want].flat()));
        Object.assign(row, { shown: parts.length, withheld: !!freeTierOnly, found: !!hit });
        if (hit) {
          Object.assign(row, {
            name: hit.name,
            source: hit.source ?? KIND_SOURCE[app.SOURCES[key].kind],
            scores: scores(hit),
            filled: filledRows(hit.specs),
            rows: hit.specs.length,
          });
        }
      } catch (err) {
        row.error = err.message;
      }
      if (blocked) throw blocked;
      results[key].push(row);
      process.stderr.write(`${key} ${row.found ? "✓" : "✗"} ${q}${row.error ? ` (${row.error})` : ""}\n`);
    }
  }
  const saved = { label, date: new Date().toISOString(), app: appPath ?? "src/build/search.ts", tpu: { ...cacheStats }, results };
  await writeFile(new URL(`coverage-${label}.json`, OUT), JSON.stringify(saved, null, 2));
  console.log(report(saved));
}

// ---- markdown output ----
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "—");
function stats(rows) {
  const found = rows.filter((r) => r.found);
  const via = {};
  for (const r of found) via[r.source] = (via[r.source] ?? 0) + 1;
  return {
    refs: rows.length,
    found: found.length,
    perf: found.filter((r) => r.scores.length).length,
    via: Object.entries(via).map(([s, n]) => `${s} ${n}`).join(", ") || "—",
    withheld: rows.filter((r) => r.withheld).length,
    errors: rows.filter((r) => r.error).length,
    avgFilled: found.length ? (found.reduce((s, r) => s + r.filled, 0) / found.length).toFixed(1) : "—",
  };
}

function report({ label, date, app, tpu, results }) {
  const lines = [
    `Run \`${label}\` on ${date.slice(0, 10)} against \`${app}\`. TechPowerUp: ${tpu.fetched} live queries, ${tpu.hits} from cache.`, "",
    "| Category | Reference parts | Found | Found via | With performance score | Queries hit by TPU withholding | Avg. filled spec rows | Errors |",
    "|---|---|---|---|---|---|---|---|",
  ];
  const all = [];
  for (const [key, rows] of Object.entries(results)) {
    const s = stats(rows);
    all.push(...rows);
    lines.push(`| ${LABELS[key]} | ${s.refs} | ${s.found} (${pct(s.found, s.refs)}) | ${s.via} | ${s.perf} (${pct(s.perf, s.refs)}) | ${s.withheld} | ${s.avgFilled} | ${s.errors} |`);
  }
  const t = stats(all);
  lines.push(`| **Total** | **${t.refs}** | **${t.found} (${pct(t.found, t.refs)})** | | **${t.perf} (${pct(t.perf, t.refs)})** | **${t.withheld}** | **${t.avgFilled}** | **${t.errors}** |`, "");

  for (const [key, rows] of Object.entries(results)) {
    const missed = rows.filter((r) => !r.found).map((r) => r.q + (r.error ? ` (error: ${r.error})` : ""));
    lines.push(`<details><summary><b>${LABELS[key]}</b>: ${rows.length - missed.length} of ${rows.length} found</summary>`, "");
    if (missed.length) lines.push(`Missed: ${missed.join(", ")}`, "");
    lines.push("| Query | Found | Matched part | Source | Performance score | Filled spec rows |", "|---|---|---|---|---|---|");
    for (const r of rows) {
      lines.push(`| ${r.q} | ${r.found ? "✓" : "✗"} | ${r.name ?? ""} | ${r.source ?? ""} | ${r.scores?.join("; ") ?? ""} | ${r.found ? `${r.filled}/${r.rows}` : ""} |`);
    }
    lines.push("", "</details>", "");
  }
  return lines.join("\n");
}

async function compare(a, b) {
  const load = async (l) => JSON.parse(await readFile(new URL(`coverage-${l}.json`, OUT), "utf8"));
  const [A, B] = [await load(a), await load(b)];
  const lines = [
    `| Category | Reference parts | Found (${a} → ${b}) | With performance score (${a} → ${b}) | Avg. filled spec rows (${a} → ${b}) | Found via (${b}) |`,
    "|---|---|---|---|---|---|",
  ];
  const gained = {}, lost = {}, allA = [], allB = [];
  const add = (groups, key, q) => (groups[LABELS[key]] ??= []).push(q);
  const list = (title, groups) => {
    const total = Object.values(groups).flat().length;
    return [`${title} (${total}):`, ...(total ? Object.entries(groups).map(([c, qs]) => `- **${c} (${qs.length}):** ${qs.join(", ")}`) : ["- none"])];
  };
  for (const key of Object.keys(B.results)) {
    const [ra, rb] = [A.results[key] ?? [], B.results[key]];
    allA.push(...ra); allB.push(...rb);
    const [sa, sb] = [stats(ra), stats(rb)];
    lines.push(`| ${LABELS[key]} | ${sb.refs} | ${sa.found} → ${sb.found} | ${sa.perf} → ${sb.perf} | ${sa.avgFilled} → ${sb.avgFilled} | ${sb.via} |`);
    rb.forEach((r, i) => {
      const before = ra.find((x) => x.q === r.q);
      if (r.found && !before?.found) add(gained, key, r.q);
      if (!r.found && before?.found) add(lost, key, r.q);
    });
  }
  const [ta, tb] = [stats(allA), stats(allB)];
  lines.push(
    `| **Total** | **${tb.refs}** | **${ta.found} (${pct(ta.found, ta.refs)}) → ${tb.found} (${pct(tb.found, tb.refs)})** | **${ta.perf} (${pct(ta.perf, ta.refs)}) → ${tb.perf} (${pct(tb.perf, tb.refs)})** | **${ta.avgFilled} → ${tb.avgFilled}** | |`,
    "", ...list("Newly found", gained), "", ...list("No longer found", lost)
  );
  console.log(lines.join("\n"));
}

const args = process.argv.slice(2);
if (args[0] === "--compare") await compare(args[1], args[2]);
else {
  const app = args.indexOf("--app");
  await run(args[0] ?? "run", app >= 0 ? args[app + 1] : undefined);
}
