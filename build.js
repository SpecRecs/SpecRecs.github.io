"use strict";

const TPU = "https://www.techpowerup.com";
const STORAGE_KEY = "specrecs.build.v1";

const fmt = (n, unit = "") => (n == null ? "—" : `${Number(n).toLocaleString()}${unit}`);
const fmtMem = (mb) => (mb == null ? "—" : mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`);
const fmtCache = (kb) => (kb == null ? "—" : kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`);
const fmtCap = (gb) => (gb == null ? "—" : gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`);

const EFFICIENCY = {
  plus: "80+", bronze: "80+ Bronze", silver: "80+ Silver", gold: "80+ Gold",
  platinum: "80+ Platinum", titanium: "80+ Titanium",
};

// One entry per component category. kind "tpu" searches the TechPowerUp API; kind "dataset"
// searches a local data/<file>.json (built by scripts/build_data.mjs); kind "manual" shows a
// form. Dataset sources also keep their manual form as a fallback. To add a data source, add an entry.
const SOURCES = {
  gpu: {
    label: "GPU",
    kind: "tpu",
    endpoint: `${TPU}/gpu-specs/api/v1/cards`,
    example: "RTX 4070",
    mapResult: (r) => ({
      id: String(r.id),
      name: r.name,
      subtitle: [r.manufacturer, r.chip?.architecture, r.released].filter(Boolean).join(" · "),
      url: r.url,
      perf: r.relativePerformance?.score != null
        ? { label: "Relative performance", value: r.relativePerformance.score, max: 200,
            note: r.relativePerformance.isEstimated ? "estimated" : "" }
        : null,
      specs: [
        ["Shaders", fmt(r.shaders)],
        ["Base / boost clock", `${fmt(r.baseClock)} / ${fmt(r.boostClock, " MHz")}`],
        ["VRAM", `${fmtMem(r.memSize)} ${r.memType ?? ""}`.trim()],
        ["Memory bus", fmt(r.memBusWidth, "-bit")],
        ["Memory bandwidth", fmt(r.memBandwidth, " GB/s")],
        ["RT / Tensor cores", `${fmt(r.rtCores)} / ${fmt(r.tensorCores)}`],
        ["TDP", fmt(r.tdp, " W")],
        ["Interface", r.interface ?? "—"],
      ],
    }),
  },
  cpu: {
    label: "CPU",
    kind: "tpu",
    endpoint: `${TPU}/cpu-specs/api/v1/chips`,
    example: "Ryzen 7 7800X3D",
    mapResult: (r) => ({
      id: String(r.id),
      name: r.name,
      subtitle: [r.manufacturer, r.codename, r.released].filter(Boolean).join(" · "),
      url: r.url,
      perf: null,
      specs: [
        ["Cores / threads", `${fmt(r.cores)} / ${fmt(r.threads)}`],
        ["Base clock", fmt(r.baseClockMhz, " MHz")],
        ["L3 cache", fmtCache(r.cacheL3Kb)],
        ["Process", fmt(r.processNm, " nm")],
        ["Memory", `${fmt(r.memChannels)}ch @ ${fmt(r.memSpeedMhz, " MHz")}`],
        ["TDP", fmt(r.tdpW, " W")],
        ["Socket", r.socket ?? "—"],
      ],
    }),
  },
  storage: {
    label: "Storage",
    kind: "tpu",
    multiple: true,
    endpoint: `${TPU}/ssd-specs/api/v1/drives`,
    example: "990 Pro",
    mapResult: (r) => ({
      id: String(r.id),
      name: `${r.manufacturer} ${r.name} ${fmtCap(r.capacityGB)}`,
      subtitle: [r.formFactor, r.interface, r.released].filter(Boolean).join(" · "),
      url: r.url,
      perf: null,
      specs: [
        ["Capacity", fmtCap(r.capacityGB)],
        ["Seq. read", fmt(r.seqReadMbs, " MB/s")],
        ["Seq. write", fmt(r.seqWriteMbs, " MB/s")],
        ["Interface", [r.interface, r.protocol].filter(Boolean).join(" · ") || "—"],
        ["Endurance", fmt(r.enduranceTbw, " TBW")],
        ["Flash", [r.flash?.type, r.flash?.layers].filter(Boolean).join(" ") || "—"],
        ["DRAM cache", r.dram == null ? "—" : r.dram ? "Yes" : "No"],
      ],
    }),
  },
  ram: {
    label: "RAM",
    kind: "dataset",
    file: "memory",
    example: "Vengeance 6000",
    mapResult: (r) => {
      // speed is [generation, MT/s]; a few old records have a bare number with no generation.
      const [gen, mts] = Array.isArray(r.speed) ? r.speed : [null, r.speed];
      const [count, gb] = Array.isArray(r.modules) ? r.modules : [];
      const ddr = gen && mts ? `DDR${gen}-${mts}` : mts ? `${mts} MT/s` : null;
      const kit = count && gb ? `${count}×${gb} GB` : null;
      return {
        id: r.id,
        name: r.name,
        subtitle: [ddr, kit, r.cas_latency && `CL${r.cas_latency}`].filter(Boolean).join(" · "),
        perf: null,
        specs: [
          ["Type", gen ? `DDR${gen}` : "—"],
          ["Speed", fmt(mts, " MT/s")],
          ["Kit", kit ?? "—"],
          ["Total", count && gb ? `${count * gb} GB` : "—"],
          ["CAS latency", r.cas_latency ? `CL${r.cas_latency}` : "—"],
          ["First-word latency", fmt(r.first_word_latency, " ns")],
        ],
      };
    },
    fields: [
      { key: "type", label: "Type", options: ["DDR5", "DDR4", "DDR3"] },
      { key: "capacity", label: "Total capacity (GB)", type: "number" },
      { key: "speed", label: "Speed (MT/s)", type: "number" },
      { key: "kit", label: "Kit (e.g. 2x16 GB)", type: "text" },
    ],
    summarize: (v) => ({
      name: `${v.capacity || "?"} GB ${v.type || ""}`.trim(),
      subtitle: v.kit || "",
      specs: [["Type", v.type], ["Capacity", v.capacity && `${v.capacity} GB`], ["Speed", v.speed && `${v.speed} MT/s`], ["Kit", v.kit]],
    }),
  },
  motherboard: {
    label: "Motherboard",
    kind: "dataset",
    file: "motherboard",
    example: "B650",
    mapResult: (r) => ({
      id: r.id,
      name: r.name,
      subtitle: [r.socket, r.form_factor].filter(Boolean).join(" · "),
      perf: null,
      specs: [
        ["Socket", r.socket ?? "—"],
        ["Form factor", r.form_factor ?? "—"],
        ["Memory slots", fmt(r.memory_slots)],
        ["Max memory", fmt(r.max_memory, " GB")],
      ],
    }),
    fields: [
      { key: "model", label: "Model", type: "text" },
      { key: "chipset", label: "Chipset (e.g. B650)", type: "text" },
      { key: "socket", label: "Socket (e.g. AM5)", type: "text" },
      { key: "formFactor", label: "Form factor", options: ["ATX", "Micro-ATX", "Mini-ITX", "E-ATX"] },
    ],
    summarize: (v) => ({
      name: v.model || "Motherboard",
      subtitle: [v.chipset, v.socket].filter(Boolean).join(" · "),
      specs: [["Chipset", v.chipset], ["Socket", v.socket], ["Form factor", v.formFactor]],
    }),
  },
  psu: {
    label: "PSU",
    kind: "dataset",
    file: "psu",
    example: "RM850",
    mapResult: (r) => {
      const eff = r.efficiency ? (EFFICIENCY[r.efficiency] ?? r.efficiency) : null;
      const modular = r.modular === false ? "Non-modular" : r.modular ? `${r.modular} modular` : null;
      return {
        id: r.id,
        name: r.name,
        subtitle: [r.wattage && `${r.wattage} W`, eff, modular].filter(Boolean).join(" · "),
        perf: null,
        specs: [
          ["Wattage", fmt(r.wattage, " W")],
          ["Efficiency", eff ?? "—"],
          ["Modular", modular ?? "—"],
          ["Form factor", r.type ?? "—"],
        ],
      };
    },
    fields: [
      { key: "model", label: "Model", type: "text" },
      { key: "wattage", label: "Wattage (W)", type: "number" },
      { key: "efficiency", label: "Efficiency", options: ["80+ White", "80+ Bronze", "80+ Silver", "80+ Gold", "80+ Platinum", "80+ Titanium"] },
    ],
    summarize: (v) => ({
      name: v.model || `${v.wattage || "?"} W PSU`,
      subtitle: v.efficiency || "",
      specs: [["Wattage", v.wattage && `${v.wattage} W`], ["Efficiency", v.efficiency]],
    }),
  },
};

// ---- state ----
// build[category] = array of parts: { id?, name, subtitle, url?, perf?, specs }
let build = loadBuild();

function loadBuild() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && typeof raw === "object") return raw;
  } catch {}
  return {};
}
function saveBuild() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(build)); } catch {}
}

// ---- DOM helpers ----
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

function renderSummary() {
  const summary = document.getElementById("summary");
  summary.replaceChildren(
    ...Object.entries(SOURCES).map(([key, src]) => {
      const n = (build[key] || []).length;
      return el("span", { class: `chip${n ? " done" : ""}` }, `${src.label}${n ? ` ✓${n > 1 ? ` ×${n}` : ""}` : ""}`);
    })
  );
}

function renderParts(key, container) {
  const src = SOURCES[key];
  const parts = build[key] || [];
  container.replaceChildren(
    ...parts.map((part, i) => {
      const rows = part.specs.filter(([, v]) => v != null && v !== "" && v !== false);
      return el("div", { class: "part" },
        el("div", { class: "part-head" },
          el("div", {},
            part.url
              ? el("a", { class: "part-name", href: part.url, target: "_blank", rel: "noopener", style: "color:inherit" }, part.name)
              : el("div", { class: "part-name" }, part.name),
            part.subtitle && el("div", { class: "part-sub" }, part.subtitle)),
          el("button", { type: "button", "aria-label": `Remove ${part.name}`, onclick: () => {
            parts.splice(i, 1);
            build[key] = parts;
            saveBuild();
            renderParts(key, container);
            renderSummary();
          } }, "Remove")),
        part.perf && el("div", { class: "perf" },
          `${part.perf.label}: ${part.perf.value}${part.perf.note ? ` (${part.perf.note})` : ""}`,
          el("div", { class: "perf-bar" },
            el("div", { style: `width:${Math.min(100, (part.perf.value / part.perf.max) * 100)}%` }))),
        el("dl", { class: "specs" }, ...rows.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, String(v))])));
    })
  );
}

function setPart(key, part, container) {
  const src = SOURCES[key];
  build[key] = src.multiple ? [...(build[key] || []), part] : [part];
  saveBuild();
  renderParts(key, container);
  renderSummary();
}

// ---- search sources ----
const MAX_RESULTS = 15;
const normalize = (s) => s.toLowerCase().replace(/×/g, "x");

// Dataset files load once on first use. Each row is mapped up front with a lowercase
// "haystack" of name + variant text, so queries like "6000" or "2x16" match memory variants.
const datasetCache = {};
function loadDataset(file) {
  datasetCache[file] ??= fetch(`data/${file}.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((rows) =>
      rows.map((row) => {
        const part = SOURCES_BY_FILE[file].mapResult(row);
        return { part, hay: normalize(`${part.name} ${part.subtitle}`) };
      })
    )
    .catch((err) => {
      delete datasetCache[file];
      throw err;
    });
  return datasetCache[file];
}
const SOURCES_BY_FILE = Object.fromEntries(
  Object.values(SOURCES).filter((s) => s.file).map((s) => [s.file, s])
);

function searchLocal(entries, q) {
  const tokens = normalize(q).split(/\s+/).filter(Boolean);
  const first = tokens[0];
  const hits = entries.filter((e) => tokens.every((t) => e.hay.includes(t)));
  hits.sort((a, b) =>
    (b.hay.startsWith(first) - a.hay.startsWith(first)) || a.part.name.length - b.part.name.length
  );
  return hits;
}

// Resolves to { parts, more } where more is a note shown under the list (or "").
async function runSearch(src, q, signal) {
  if (src.kind === "dataset") {
    const hits = searchLocal(await loadDataset(src.file), q);
    return {
      parts: hits.slice(0, MAX_RESULTS).map((e) => e.part),
      more: hits.length > MAX_RESULTS ? `Showing ${MAX_RESULTS} of ${hits.length.toLocaleString()}. Keep typing to narrow.` : "",
    };
  }
  const res = await fetch(`${src.endpoint}?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const all = json.results || [];
  const real = all.filter((r) => r._type !== "withheld");
  return {
    parts: real.slice(0, MAX_RESULTS).map(src.mapResult),
    more: all.length > real.length ? "More results exist beyond the free dataset." : "",
    freeTierOnly: all.length > real.length,
  };
}

// ---- manual-entry form (standalone card for "manual" sources, fallback for "dataset" ones) ----
function buildManualForm(key, src, parts) {
  const form = el("form", { class: "manual" },
    ...src.fields.map((f) => {
      const control = f.options
        ? el("select", { name: f.key }, el("option", { value: "" }, "—"), ...f.options.map((o) => el("option", { value: o }, o)))
        : el("input", { name: f.key, type: f.type || "text" });
      return el("label", {}, f.label, control);
    }),
    el("button", { type: "submit", class: "primary" }, "Save"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (!Object.values(values).some(Boolean)) return;
    setPart(key, src.summarize(values), parts);
    form.reset();
  });
  return form;
}

// ---- search card (tpu + dataset sources) ----
function buildSearchCard(key, src) {
  const input = el("input", { type: "text", placeholder: `Search ${src.label} (e.g. ${src.example})`, "aria-label": `Search ${src.label}`, autocomplete: "off" });
  const results = el("ul", { class: "results", role: "listbox" });
  const parts = el("div", { class: "parts" });
  let timer, controller;

  const showNote = (msg) => results.replaceChildren(el("li", { class: "note" }, msg));

  async function search(q) {
    controller?.abort();
    controller = new AbortController();
    showNote(src.kind === "dataset" && !datasetCache[src.file] ? "Loading parts…" : "Searching…");
    try {
      const { parts: found, more, freeTierOnly } = await runSearch(src, q, controller.signal);
      if (controller.signal.aborted) return;
      if (!found.length) return showNote(freeTierOnly ? "No matches in the free dataset." : "No matches.");
      const items = found.map((part) =>
        el("li", { tabindex: "0", role: "option", onclick: () => pick(part), onkeydown: (e) => { if (e.key === "Enter") pick(part); } },
          part.name, el("small", {}, part.subtitle)));
      if (more) items.push(el("li", { class: "note" }, more));
      results.replaceChildren(...items);
    } catch (err) {
      if (err.name === "AbortError") return;
      showNote(src.kind === "dataset" ? "Couldn't load the parts list. Try again." : "Couldn't reach TechPowerUp. Check your connection and try again.");
    }
  }

  function pick(part) {
    setPart(key, part, parts);
    results.replaceChildren();
    input.value = "";
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { controller?.abort(); results.replaceChildren(); return; }
    timer = setTimeout(() => search(q), src.kind === "dataset" ? 150 : 300);
  });

  renderParts(key, parts);
  return el("section", { class: "card" },
    el("h2", {}, src.label),
    el("div", { class: "search" }, input, results),
    parts,
    src.multiple && el("p", { class: "hint" }, "Search again to add more drives."),
    src.fields && el("details", { class: "fallback" },
      el("summary", {}, "Can't find it? Enter manually"),
      buildManualForm(key, src, parts)));
}

function buildManualCard(key, src) {
  const parts = el("div", { class: "parts" });
  renderParts(key, parts);
  return el("section", { class: "card" }, el("h2", {}, src.label),
    el("p", { class: "hint" }, "Not in a parts database yet. Enter manually."),
    buildManualForm(key, src, parts), parts);
}

// ---- init ----
const main = document.getElementById("categories");
for (const [key, src] of Object.entries(SOURCES)) {
  main.append(src.kind === "manual" ? buildManualCard(key, src) : buildSearchCard(key, src));
}
renderSummary();
