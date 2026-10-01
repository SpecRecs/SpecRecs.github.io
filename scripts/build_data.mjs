// Refreshes data/*.json from the docyx/pc-part-dataset (MIT) on GitHub.
// Drops price/color, removes exact duplicates, and adds a stable id. Node 18+, no dependencies.
// Usage: node scripts/build_data.mjs
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json";
const OUT = new URL("../data/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const DATASETS = {
  memory: { src: "memory", keep: ["name", "speed", "modules", "cas_latency", "first_word_latency"] },
  motherboard: { src: "motherboard", keep: ["name", "socket", "form_factor", "max_memory", "memory_slots"] },
  psu: { src: "power-supply", keep: ["name", "type", "efficiency", "wattage", "modular"] },
};

for (const [file, { src, keep }] of Object.entries(DATASETS)) {
  const res = await fetch(`${BASE}/${src}.json`);
  if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
  const raw = await res.json();

  const seen = new Set();
  const rows = [];
  for (const r of raw) {
    const row = Object.fromEntries(keep.map((k) => [k, r[k] ?? null]));
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: createHash("sha1").update(key).digest("hex").slice(0, 10), ...row });
  }

  writeFileSync(new URL(`${file}.json`, OUT), JSON.stringify(rows));
  console.log(`${file}: ${raw.length} raw -> ${rows.length} unique`);
}
