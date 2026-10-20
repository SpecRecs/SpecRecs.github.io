import { EFFICIENCY, fmt, fmtCache, fmtCap, fmtMem } from "./format.ts";
import type {
  DocyxCpu, DocyxMemory, DocyxMotherboard, DocyxPsu, DocyxStorage, GpuArkRow, TpuCpu, TpuGpu, TpuSsd,
} from "./raw.ts";
import type { Part, Source } from "./types.ts";

const TPU = "https://www.techpowerup.com";

// Offline fallbacks for the TechPowerUp categories, searched alongside the API. TechPowerUp's free
// tier withholds most matches, so these fill the gaps. Built by scripts/build_data.mjs.
const mapGpuArk = (r: GpuArkRow): Part => ({
  id: r.id,
  name: r.name,
  subtitle: [r.maker, r.arch, r.year].filter(Boolean).join(" · "),
  source: "GPU Ark",
  perf: null,
  specs: [
    ["Shaders", fmt(r.cores)],
    ["Base / boost clock", `${fmt(r.base_clock)} / ${fmt(r.boost_clock, " MHz")}`],
    ["VRAM", `${fmtMem(r.mem_mb)} ${r.mem_type ?? ""}`.trim()],
    ["Memory bus", fmt(r.bus_width, "-bit")],
    ["Memory bandwidth", fmt(r.bandwidth, " GB/s")],
    ["RT / Tensor cores", `${fmt(r.rt_cores)} / ${fmt(r.tensor_cores)}`],
    ["FP32", fmt(r.fp32_tflops, " TFLOPS")],
    ["TDP", fmt(r.tdp, " W")],
    ["Interface", r.interface ?? "—"],
  ],
});

const mapDocyxCpu = (r: DocyxCpu): Part => ({
  id: r.id,
  name: r.name,
  subtitle: [r.microarchitecture, r.core_count && `${r.core_count} cores`].filter(Boolean).join(" · "),
  source: "docyx",
  perf: null,
  specs: [
    ["Cores", fmt(r.core_count)],
    ["Base / boost clock", `${r.core_clock ?? "—"} / ${fmt(r.boost_clock, " GHz")}`],
    ["Microarchitecture", r.microarchitecture ?? "—"],
    ["Integrated graphics", r.graphics ?? "None"],
    ["TDP", fmt(r.tdp, " W")],
  ],
});

const mapDocyxStorage = (r: DocyxStorage): Part => {
  const type = r.type == null ? null : r.type === "SSD" ? "SSD" : `HDD · ${r.type} RPM`;
  const formFactor = typeof r.form_factor === "number" ? `${r.form_factor}"` : r.form_factor; // 3.5 -> 3.5"
  return {
    id: r.id,
    name: r.capacity ? `${r.name} ${fmtCap(r.capacity)}` : r.name,
    subtitle: [type, formFactor, r.interface].filter(Boolean).join(" · "),
    source: "docyx",
    perf: null,
    specs: [
      ["Capacity", fmtCap(r.capacity)],
      ["Type", type ?? "—"],
      ["Cache", fmtMem(r.cache)],
      ["Form factor", formFactor ?? "—"],
      ["Interface", r.interface ?? "—"],
    ],
  };
};

// One entry per component category. kind "tpu" searches the TechPowerUp API, plus an optional local
// fallback; kind "dataset" searches a local data/<file>.json (built by scripts/build_data.mjs); kind
// "manual" shows a form. Dataset sources also keep their manual form as a fallback. bench names the
// Blender score list (data/bench.json) to attach. To add a data source, add an entry.
export const SOURCES = {
  gpu: {
    label: "GPU",
    kind: "tpu",
    endpoint: `${TPU}/gpu-specs/api/v1/cards`,
    fallback: { file: "gpu", mapResult: mapGpuArk },
    bench: "gpu",
    example: "RTX 4070",
    mapResult: (r: TpuGpu): Part => ({
      id: String(r.id),
      name: r.name,
      subtitle: [r.manufacturer, r.chip?.architecture, r.released].filter(Boolean).join(" · "),
      url: r.url,
      source: "TechPowerUp",
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
    fallback: { file: "cpu", mapResult: mapDocyxCpu },
    bench: "cpu",
    example: "Ryzen 7 7800X3D",
    mapResult: (r: TpuCpu): Part => ({
      id: String(r.id),
      name: r.name,
      subtitle: [r.manufacturer, r.codename, r.released].filter(Boolean).join(" · "),
      url: r.url,
      source: "TechPowerUp",
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
    fallback: { file: "storage", mapResult: mapDocyxStorage },
    example: "990 Pro",
    mapResult: (r: TpuSsd): Part => ({
      id: String(r.id),
      name: `${r.manufacturer} ${r.name} ${fmtCap(r.capacityGB)}`,
      subtitle: [r.formFactor, r.interface, r.released].filter(Boolean).join(" · "),
      url: r.url,
      source: "TechPowerUp",
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
    mapResult: (r: DocyxMemory): Part => {
      // speed is [generation, MT/s]; a few old records have a bare number with no generation.
      const [gen, mts] = Array.isArray(r.speed) ? r.speed : [null, r.speed];
      const [count, gb] = Array.isArray(r.modules) ? r.modules : [];
      const ddr = gen && mts ? `DDR${gen}-${mts}` : mts ? `${mts} MT/s` : null;
      const kit = count && gb ? `${count}×${gb} GB` : null;
      return {
        id: r.id,
        name: r.name,
        subtitle: [ddr, kit, r.cas_latency && `CL${r.cas_latency}`].filter(Boolean).join(" · "),
        source: "docyx",
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
    mapResult: (r: DocyxMotherboard): Part => ({
      id: r.id,
      name: r.name,
      subtitle: [r.socket, r.form_factor].filter(Boolean).join(" · "),
      source: "docyx",
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
    mapResult: (r: DocyxPsu): Part => {
      const eff = r.efficiency ? (EFFICIENCY[r.efficiency] ?? r.efficiency) : null;
      const modular = r.modular === false ? "Non-modular" : r.modular ? `${r.modular} modular` : null;
      return {
        id: r.id,
        name: r.name,
        subtitle: [r.wattage && `${r.wattage} W`, eff, modular].filter(Boolean).join(" · "),
        source: "docyx",
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
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;
