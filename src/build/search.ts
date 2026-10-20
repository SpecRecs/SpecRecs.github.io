// Search over TechPowerUp and the local data files. No DOM access, so test/coverage.mjs can import
// this module in Node and call runSearch() exactly as the search box does.
import { modelKey, withoutMemSize } from "./format.ts";
import type { BenchFile, BenchRow, TpuResponse } from "./raw.ts";
import type { BenchKind, Mapper, Part, SearchResult, Source, TpuSource } from "./types.ts";

export const MAX_RESULTS = 15;
// "Western Digital" also matches "WD", the name people search by.
const normalize = (s: string) => s.toLowerCase().replace(/×/g, "x").replace(/western digital/g, "western digital wd");

// Data files are served from public/data/. BASE_URL is undefined when this runs under Node.
const dataUrl = (file: string) => `${import.meta.env?.BASE_URL ?? "/"}data/${file}.json`;

export const isAbort = (err: unknown) => (err as Error | undefined)?.name === "AbortError";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

interface Entry {
  part: Part;
  hay: string;
}

// Dataset files load once on first use. Each row is mapped up front with a lowercase
// "haystack" of name + variant text, so queries like "6000" or "2x16" match memory variants.
const datasetCache: Record<string, Promise<Entry[]>> = {};
export const isDatasetLoaded = (file: string) => file in datasetCache;

function loadDataset(file: string, mapResult: Mapper): Promise<Entry[]> {
  datasetCache[file] ??= fetchJson<unknown[]>(dataUrl(file))
    .then((rows) =>
      rows.map((row) => {
        const part = mapResult(row);
        return { part, hay: normalize(`${part.name} ${part.subtitle}`) };
      })
    )
    .catch((err) => {
      delete datasetCache[file];
      throw err;
    });
  return datasetCache[file];
}

function searchLocal(entries: Entry[], q: string): Entry[] {
  const tokens = normalize(q).split(/\s+/).filter(Boolean);
  const first = tokens[0];
  const hits = entries.filter((e) => tokens.every((t) => e.hay.includes(t)));
  hits.sort((a, b) =>
    (Number(b.hay.startsWith(first)) - Number(a.hay.startsWith(first))) || a.part.name.length - b.part.name.length
  );
  return hits;
}

// Blender render scores, indexed by model key. If there is no exact match, names are compared
// without memory sizes ("RTX 3060 8 GB" vs "RTX 3060"), preferring the device with the most runs;
// Blender doesn't record VRAM, so those matches are flagged as approximate.
// Bars are scaled to the fastest mainstream desktop part, since workstation and server chips score
// far higher (EPYC about 10x a Ryzen 9). Anything faster fills the bar.
const BAR_REFERENCE: Record<BenchKind, string> = { cpu: "AMD Ryzen 9 9950X3D", gpu: "NVIDIA GeForce RTX 5090" };

interface BenchIndex {
  exact: Map<string, BenchRow>;
  loose: Map<string, BenchRow>;
  max: number;
  scale: string;
}

let benchCache: Promise<{ version: string } & Record<BenchKind, BenchIndex>> | undefined;
function loadBench() {
  benchCache ??= fetchJson<BenchFile>(dataUrl("bench"))
    .then(({ version, ...lists }) => {
      const index = { version } as { version: string } & Record<BenchKind, BenchIndex>;
      for (const [kind, rows] of Object.entries(lists) as [BenchKind, BenchRow[]][]) {
        const exact = new Map<string, BenchRow>(), loose = new Map<string, BenchRow>();
        for (const row of rows) {
          const key = modelKey(row[0]);
          for (const [map, k] of [[exact, key], [loose, withoutMemSize(key)]] as const) {
            const prev = map.get(k);
            if (!prev || row[2] > prev[2]) map.set(k, row);
          }
        }
        const ref = exact.get(modelKey(BAR_REFERENCE[kind]));
        const max = ref ? ref[1] : Math.max(...rows.map((r) => r[1]));
        const scale = ref ? `Bar: 100% = ${BAR_REFERENCE[kind]}` : "";
        index[kind] = { exact, loose, max, scale };
      }
      return index;
    })
    .catch((err) => {
      benchCache = undefined;
      throw err;
    });
  return benchCache;
}

async function attachBench(kind: BenchKind, parts: Part[]): Promise<Part[]> {
  let index;
  try { index = await loadBench(); } catch { return parts; }
  const { exact, loose, max, scale } = index[kind];
  return parts.map((part) => {
    const key = modelKey(part.name);
    const row = exact.get(key) ?? loose.get(withoutMemSize(key));
    if (!row) return part;
    const [scoredAs, score, runs, computeType] = row;
    const via = kind === "gpu" ? `, ${computeType}` : "";
    const approx = exact.has(key) ? "" : `, approximate: scored as ${scoredAs}`;
    return {
      ...part,
      bench: {
        label: "Blender render score", value: Math.round(score), max, scale,
        note: `median of ${runs.toLocaleString()} run${runs === 1 ? "" : "s"}, Blender ${index.version}${via}${approx}`,
      },
    };
  });
}

async function searchTpu(src: TpuSource, q: string, signal?: AbortSignal) {
  const all = (await fetchJson<TpuResponse<unknown>>(`${src.endpoint}?q=${encodeURIComponent(q)}`, signal)).results || [];
  const real = all.filter((r) => (r as { _type?: string })._type !== "withheld");
  return { parts: real.slice(0, MAX_RESULTS).map(src.mapResult), withheld: all.length > real.length };
}

// TechPowerUp results come first, then local fallback parts it didn't return.
export async function runSearch(src: Source, q: string, signal?: AbortSignal): Promise<SearchResult> {
  if (src.kind === "manual") return { parts: [], more: "" };
  if (src.kind === "dataset") {
    const hits = searchLocal(await loadDataset(src.file, src.mapResult), q);
    return {
      parts: hits.slice(0, MAX_RESULTS).map((e) => e.part),
      more: hits.length > MAX_RESULTS ? `Showing ${MAX_RESULTS} of ${hits.length.toLocaleString()}. Keep typing to narrow.` : "",
    };
  }
  const { fallback } = src;
  const [online, offline] = await Promise.allSettled([
    searchTpu(src, q, signal),
    fallback ? loadDataset(fallback.file, fallback.mapResult).then((e) => searchLocal(e, q)) : [],
  ]);
  if (online.status === "rejected" && (isAbort(online.reason) || offline.status === "rejected")) {
    throw online.reason;
  }
  const tpu = online.status === "fulfilled" ? online.value : { parts: [], withheld: false };
  const shown = new Set(tpu.parts.map((p) => modelKey(p.name)));
  const extra = offline.status === "fulfilled" ? offline.value.filter((e) => !shown.has(modelKey(e.part.name))) : [];
  const total = tpu.parts.length + extra.length;
  let parts = [...tpu.parts, ...extra.map((e) => e.part)].slice(0, MAX_RESULTS);
  if (src.bench) parts = await attachBench(src.bench, parts);

  const notes = [];
  if (online.status === "rejected") notes.push("TechPowerUp didn't respond, so these are offline results only.");
  if (total > MAX_RESULTS) notes.push(`Showing ${MAX_RESULTS} of ${total.toLocaleString()}. Keep typing to narrow.`);
  else if (tpu.withheld && !fallback) notes.push("More results exist beyond the free dataset.");
  return { parts, more: notes.join(" "), freeTierOnly: tpu.withheld };
}
