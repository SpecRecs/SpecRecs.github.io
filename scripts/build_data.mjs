// Refreshes data/*.json from three open sources. Node 18+, no dependencies.
//   docyx/pc-part-dataset (MIT): memory, motherboard, psu, cpu, storage. Drops price/color, removes duplicates.
//   GPU Ark (CC BY 4.0, gpuark.com): reference GPUs only (no board-partner cards), units parsed to numbers.
//   Blender Open Data (public domain): median render score per CPU and GPU for one Blender version.
// Every row gets a stable 10-character id. Usage: node scripts/build_data.mjs
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const DOCYX = "https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json";
const GPUARK = "https://huggingface.co/datasets/Intelion/gpuark-gpu-dataset/resolve/main/gpuark-gpu-specs.csv";
const BLENDER = "https://opendata.blender.org/benchmarks/query/";
const BLENDER_VERSION = "4.5.0"; // the version with the most CPUs and GPUs tested; scores differ between versions
const GPU_BACKENDS = ["OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"];
const OUT = new URL("../public/data/", import.meta.url); // served by Vite as /data/
mkdirSync(OUT, { recursive: true });

const DOCYX_SETS = {
  memory: { src: "memory", keep: ["name", "speed", "modules", "cas_latency", "first_word_latency"] },
  motherboard: { src: "motherboard", keep: ["name", "socket", "form_factor", "max_memory", "memory_slots"] },
  psu: { src: "power-supply", keep: ["name", "type", "efficiency", "wattage", "modular"] },
  cpu: { src: "cpu", keep: ["name", "core_count", "core_clock", "boost_clock", "microarchitecture", "tdp", "graphics"] },
  storage: { src: "internal-hard-drive", keep: ["name", "capacity", "type", "cache", "form_factor", "interface"] },
};

async function get(url, as = "json") {
  const res = await fetch(url, { headers: { "user-agent": "SpecRecs-build-data/0.1" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return as === "json" ? res.json() : res.text();
}

// Removes exact duplicates and prefixes each row with an id derived from its content.
function withIds(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: createHash("sha1").update(key).digest("hex").slice(0, 10), ...row });
  }
  return out;
}

function write(file, data, note) {
  writeFileSync(new URL(`${file}.json`, OUT), JSON.stringify(data));
  console.log(`${file}: ${note}`);
}

// ---- docyx ----
for (const [file, { src, keep }] of Object.entries(DOCYX_SETS)) {
  const raw = await get(`${DOCYX}/${src}.json`);
  const rows = withIds(raw.map((r) => Object.fromEntries(keep.map((k) => [k, r[k] ?? null]))));
  write(file, rows, `${raw.length} raw -> ${rows.length} unique`);
}

// ---- GPU Ark ----
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const num = (s) => {
  const n = parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const MAKERS = { NVIDIA: "NVIDIA", AMD: "AMD", ATI: "ATI", INTEL: "Intel", MOORE: "Moore Threads", MATROX: "Matrox" };

const gpuArk = parseCsv(await get(GPUARK, "text"));
// A reference GPU is either not a retail board or has a chip-vendor tag; some reference cards
// (e.g. "AMD Radeon RX 6700 XT") are wrongly flagged as retail boards.
const isReference = (r) => r.is_retail_board === "False" || r.vendor !== "";
const gpus = withIds(
  gpuArk.filter(isReference).map((r) => {
    const year = Number(r.card_release_date.slice(0, 4));
    const validYear = year >= 1998 && year <= 2026 ? year : null;
    // VRAM is stored in MB on older cards and GB on newer ones (see the dataset's README).
    const ram = num(r.ram);
    const memMb = ram == null ? null : (validYear && validYear < 2018 ? ram >= 64 : ram >= 1024) ? ram : ram * 1024;
    return {
      name: r.name,
      maker: MAKERS[r.manufacturer] ?? r.manufacturer,
      arch: r.arch_name || null,
      year: validYear,
      cores: num(r.cores),
      rt_cores: num(r.rt_cores),
      tensor_cores: num(r.tensor_cores),
      base_clock: num(r.base_clock),
      boost_clock: num(r.boost_clock),
      mem_mb: memMb,
      mem_type: r.ram_type || null,
      bus_width: num(r.bus_width),
      bandwidth: num(r.ram_bandwidth),
      fp32_tflops: num(r.fp32_performance),
      tdp: num(r.tdp),
      interface: r.bus_interface || null,
    };
  })
);
write("gpu", gpus, `${gpuArk.length} raw -> ${gpus.length} reference GPUs`);

// ---- Blender Open Data ----
// One row per device: [device name, median score (samples/min), number of runs, compute type].
// A GPU keeps the backend with the most runs (usually OptiX for NVIDIA, HIP for AMD, oneAPI for Intel).
// Taking the highest median instead lets single-run outliers win, e.g. one CUDA run over 62 OptiX runs.
async function blenderMedians(computeType) {
  const url = `${BLENDER}?compute_type=${computeType}&blender_version=${BLENDER_VERSION}&group_by=device_name&response_type=datatables`;
  const { rows } = await get(url);
  return rows.map(([name, score, runs]) => [name.replace(/\s+/g, " ").trim(), Math.round(score * 10) / 10, runs, computeType]);
}
const cpuScores = await blenderMedians("CPU");
const bestGpu = new Map();
for (const backend of GPU_BACKENDS) {
  for (const row of await blenderMedians(backend)) {
    const prev = bestGpu.get(row[0]);
    if (!prev || row[2] > prev[2] || (row[2] === prev[2] && row[1] > prev[1])) bestGpu.set(row[0], row);
  }
}
const gpuScores = [...bestGpu.values()];
write("bench", { version: BLENDER_VERSION, cpu: cpuScores, gpu: gpuScores },
  `Blender ${BLENDER_VERSION}: ${cpuScores.length} CPUs, ${gpuScores.length} GPUs`);
