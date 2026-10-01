// Test: GPU specs from the official TechPowerUp database API (no key needed; attribution appreciated).
// NOTE: this API returns specs/benchmarks only, not prices. Use it to enrich price data from retailers.
// Usage: node test/techpowerup_gpus.mjs ["rtx 5070"]
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("./out/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const query = process.argv[2] ?? "rtx 5070";
const url = `https://www.techpowerup.com/gpu-specs/api/v1/cards?q=${encodeURIComponent(query)}`;

const res = await fetch(url, { headers: { "user-agent": "SpecRecs-test/0.1 (+https://github.com/SpecRecs/SpecRecs.github.io)" } });
console.log(`HTTP ${res.status} ${url}`);
if (!res.ok) process.exit(1);

const json = await res.json();
writeFileSync(new URL("techpowerup.json", OUT), JSON.stringify(json, null, 2));
console.log(`${json.matches} matches of ${json.totalQueried} cards (${json.queryTimeMs} ms)\n`);

// Free tier returns only a couple of full records, then a {_type:"withheld"} marker for the rest.
const withheld = json.results.find((r) => r._type === "withheld");
const cards = json.results.filter((r) => r._type !== "withheld");
if (withheld) console.log(`Free tier: showing ${cards.length} of ${json.matches} matches. "${withheld.message}"
`);

const gpus = cards.map((g) => ({
  id: g.id, name: g.name, maker: g.manufacturer, released: g.released,
  chip: g.chip?.name, arch: g.chip?.architecture, vramGB: g.memSize / 1024, memType: g.memType,
  boostMHz: g.boostClock, tdpW: g.tdp, power: g.powerPlugs, perf: g.relativePerformance?.score, url: g.url,
}));
console.table(gpus.map(({ url, id, ...rest }) => rest));

// Does any field look like a price?
const priceKeys = JSON.stringify(json).match(/"[A-Za-z]*(price|msrp|cost|usd)[A-Za-z]*"/gi);
console.log(priceKeys ? `Price-like keys: ${[...new Set(priceKeys)].join(", ")}` : "No price/MSRP fields in the response.");
