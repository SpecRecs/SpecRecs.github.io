// Runtime validators for every shared entity, plus validateCatalog() for cross-file checks.
// The pipeline runs these before publishing (agent-plan §6, M5); tests run them on the fixtures.
import type { Catalog, Manifest, Price } from "./catalog.ts";
import { CATALOG_FILES } from "./catalog.ts";
import {
  BOARD_FORM_FACTORS, MEMORY_TYPES, PART_CATEGORIES, POWER_CONNECTORS, PSU_FORM_FACTORS, SIZE_CLASSES, SOCKETS, STYLE_TAGS,
} from "./common.ts";
import type { CompatibilityConfig } from "./compatibility.ts";
import { RULE_IDS } from "./compatibility.ts";
import type {
  AioCooler, AirCooler, Case, Cooler, Cpu, CpuPerf, GpuFamily, GpuPerf, GpuVariant, Memory, Motherboard, Psu, Storage,
} from "./parts.ts";
import type { GamingEstimate, PerfEstimate, Reason, Recommendation, RecommendedPart, Warning } from "./recommendation.ts";
import type { CurrentPart, CurrentSystem, UserRequest } from "./request.ts";
import type { Check, Issue, Shape } from "./validate.ts";
import {
  anyOf, arr, bool, count, id, isoDate, literal, nullable, num, obj, oneOf, optional, positive, record, str, tagged, validate,
} from "./validate.ts";

const year = () => num({ min: 1990, max: 2100, int: true });
const connectors = () => record(POWER_CONNECTORS, count());
const category = () => oneOf(PART_CATEGORIES);
const RESOLUTIONS = ["1080p", "1440p", "4k"] as const;
const METRICS = ["gaming_fps", "single", "multi", "rt"] as const;

const base = { id: id(), name: str(), manufacturer: str(), source: str() };

export const cpuPerf = obj<CpuPerf>({
  gaming_fps: nullable(positive()),
  single: nullable(positive()),
  multi: nullable(positive()),
  source: str(),
});

export const cpu = obj<Cpu>({
  ...base,
  socket: oneOf(SOCKETS),
  memory_types: arr(oneOf(MEMORY_TYPES), { nonEmpty: true }),
  cores: positive({ int: true }),
  threads: positive({ int: true }),
  tdp_w: nullable(positive()),
  integrated_graphics: nullable(bool()),
  release_year: nullable(year()),
  perf: cpuPerf,
});

export const gpuPerf = obj<GpuPerf>({
  r1080_fps: nullable(positive()),
  r1440_fps: nullable(positive()),
  r4k_fps: nullable(positive()),
  rt: nullable(positive()),
  source: str(),
});

export const gpuFamily = obj<GpuFamily>({
  ...base,
  vram_gb: positive(),
  upscaler: nullable(str()),
  release_year: nullable(year()),
  perf: gpuPerf,
});

export const gpuVariant = obj<GpuVariant>({
  ...base,
  family_id: id(),
  length_mm: nullable(positive()),
  slot_width: nullable(positive()),
  tdp_w: nullable(positive()),
  power_connectors: nullable(connectors()),
  recommended_psu_w: nullable(positive()),
});

export const motherboard = obj<Motherboard>({
  ...base,
  socket: oneOf(SOCKETS),
  chipset: str(),
  form_factor: oneOf(BOARD_FORM_FACTORS),
  memory_type: oneOf(MEMORY_TYPES),
  memory_slots: positive({ int: true }),
  max_memory_gb: nullable(positive()),
  m2_slots: nullable(count()),
  wifi: nullable(bool()),
  supported_cpu_ids: nullable(anyOf<string[] | "socket">('"socket" or an array of CPU IDs', literal("socket"), arr(id()))),
});

export const memory = obj<Memory>({
  ...base,
  memory_type: oneOf(MEMORY_TYPES),
  capacity_gb: positive(),
  module_count: positive({ int: true }),
  speed_mt_s: positive(),
  cas_latency: nullable(positive()),
  rgb: nullable(bool()),
});

export const psu = obj<Psu>({
  ...base,
  wattage_w: positive(),
  form_factor: oneOf(PSU_FORM_FACTORS),
  efficiency: nullable(oneOf(["white", "bronze", "silver", "gold", "platinum", "titanium"])),
  modular: nullable(oneOf(["full", "semi", "none"])),
  connectors: nullable(connectors()),
});

export const pcCase = obj<Case>({
  ...base,
  size_class: oneOf(SIZE_CLASSES),
  supported_mb_form_factors: arr(oneOf(BOARD_FORM_FACTORS), { nonEmpty: true }),
  supported_psu_form_factors: arr(oneOf(PSU_FORM_FACTORS), { nonEmpty: true }),
  max_gpu_length_mm: nullable(positive()),
  max_cooler_height_mm: nullable(positive()),
  radiator_mm_supported: nullable(arr(positive())),
  style_tags: arr(oneOf(STYLE_TAGS)),
});

const coolerBase = { ...base, supported_sockets: arr(oneOf(SOCKETS), { nonEmpty: true }), rated_tdp_w: nullable(positive()) };

export const cooler = tagged<Cooler>("type", {
  air: obj<AirCooler>({ ...coolerBase, type: literal("air"), height_mm: nullable(positive()) }),
  aio: obj<AioCooler>({ ...coolerBase, type: literal("aio"), radiator_mm: positive() }),
});

export const storage = obj<Storage>({
  ...base,
  interface: oneOf(["NVMe", "SATA"]),
  form_factor: oneOf(["M.2-2280", "2.5in", "3.5in"]),
  capacity_gb: positive(),
  pcie_gen: nullable(positive({ int: true })),
  read_mb_s: nullable(positive()),
});

export const price = obj<Price>({
  product_id: id(),
  price_usd: positive(),
  retailer: str(),
  condition: oneOf(["new", "used"]),
  last_checked: isoDate(),
  url: nullable(str({ test: (s) => /^https?:\/\//.test(s), what: "an http(s) URL" })),
  source: str(),
});

export const manifest = obj<Manifest>({
  version: str(),
  built_at: isoDate(),
  counts: obj<Manifest["counts"]>(Object.fromEntries(CATALOG_FILES.map((f) => [f, count()])) as Shape<Manifest["counts"]>),
  sources: arr(obj<Manifest["sources"][number]>({ name: str(), url: nullable(str()), license: nullable(str()) })),
});

// specs are partial and come from loosely-typed lookup records, so only their container is checked.
const specsObject: Check<object> = (v, path, issues) => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) issues.push({ path, message: "expected an object" });
};

const currentPartLoose = obj<CurrentPart<object>>({
  name: str(),
  lookup_id: nullable(str()),
  candidate_id: nullable(id()),
  specs: specsObject,
});

export const currentSystem = obj<CurrentSystem>({
  cpu: optional(currentPartLoose),
  gpu: optional(currentPartLoose),
  motherboard: optional(currentPartLoose),
  memory: optional(currentPartLoose),
  psu: optional(currentPartLoose),
  case: optional(currentPartLoose),
  cooler: optional(currentPartLoose),
  storage: optional(arr(currentPartLoose)),
});

export const userRequest = obj<UserRequest>({
  mode: optional(oneOf(["new", "upgrade"])),
  purpose: optional(oneOf(["gaming", "gaming_streaming", "general", "productivity"])),
  budget_max_usd: optional(positive()),
  budget_preferred_usd: optional(positive()),
  resolution: optional(oneOf(RESOLUTIONS)),
  size_pref: optional(oneOf(["small", "medium", "large", "none"])),
  style_pref: optional(oneOf(["rgb", "minimal", "clean", "value", "none"])),
  current_system: optional(currentSystem),
  completed_at: optional(isoDate()),
});

export const compatibilityConfig = obj<CompatibilityConfig>({ psu_headroom: num({ min: 0, max: 2 }) });

const recommendedPart = obj<RecommendedPart>({
  component: category(),
  part_id: id(),
  price_usd: positive(),
  retailer: str(),
  last_checked: isoDate(),
  replaces: nullable(str()),
});

const gamingEstimate = obj<GamingEstimate>({
  resolution: oneOf(RESOLUTIONS),
  fps: positive(),
  cpu_cap_fps: positive(),
  gpu_cap_fps: positive(),
  limited_by: oneOf(["cpu", "gpu"]),
});

const perfEstimate = obj<PerfEstimate>({
  gaming: nullable(gamingEstimate),
  single: nullable(positive()),
  multi: nullable(positive()),
});

type Of<U, T> = Extract<U, { type: T }>;
const usd = () => num({ min: 0 });

export const reason = tagged<Reason>("type", {
  performance_gain: obj<Of<Reason, "performance_gain">>({
    type: literal("performance_gain"), component: oneOf([...PART_CATEGORIES, "system"]), metric: oneOf(METRICS),
    old_value: positive(), new_value: positive(), percent_gain: num(),
  }),
  price_performance: obj<Of<Reason, "price_performance">>({
    type: literal("price_performance"), component: category(), metric: oneOf(METRICS), value: positive(), price_usd: positive(),
  }),
  upgrade_value: obj<Of<Reason, "upgrade_value">>({
    type: literal("upgrade_value"), component: category(), percent_gain: num(), cost_usd: usd(),
  }),
  platform_change: obj<Of<Reason, "platform_change">>({
    type: literal("platform_change"), requires: arr(category(), { nonEmpty: true }), cost_usd: usd(),
  }),
  keep_part: obj<Of<Reason, "keep_part">>({ type: literal("keep_part"), component: category(), part_name: str() }),
  budget_fit: obj<Of<Reason, "budget_fit">>({ type: literal("budget_fit"), total_cost_usd: usd(), budget_max_usd: positive() }),
  preference_match: obj<Of<Reason, "preference_match">>({
    type: literal("preference_match"), preference: oneOf(["size", "style"]), component: category(), value: str(),
  }),
});

export const warning = tagged<Warning>("type", {
  missing_info: obj<Of<Warning, "missing_info">>({ type: literal("missing_info"), component: category(), field: str() }),
  compatibility_unknown: obj<Of<Warning, "compatibility_unknown">>({
    type: literal("compatibility_unknown"), rule: oneOf(RULE_IDS), components: arr(category()),
  }),
  imbalance: obj<Of<Warning, "imbalance">>({ type: literal("imbalance"), limited_by: oneOf(["cpu", "gpu"]) }),
  over_preferred_budget: obj<Of<Warning, "over_preferred_budget">>({
    type: literal("over_preferred_budget"), total_cost_usd: usd(), budget_preferred_usd: positive(),
  }),
  price_stale: obj<Of<Warning, "price_stale">>({ type: literal("price_stale"), product_id: id(), last_checked: isoDate() }),
});

export const recommendation = obj<Recommendation>({
  category: oneOf(["best_fit", "best_value", "performance"]),
  mode: oneOf(["new", "upgrade"]),
  parts: arr(recommendedPart),
  total_cost_usd: usd(),
  perf_estimate: perfEstimate,
  gain_pct: nullable(num()),
  reasons: arr(reason, { nonEmpty: true }),
  warnings: arr(warning),
});

const ENTITY: { [K in keyof Catalog]: Check<Catalog[K][number]> } = {
  cpus: cpu,
  gpu_families: gpuFamily,
  gpu_variants: gpuVariant,
  motherboards: motherboard,
  memory,
  psus: psu,
  cases: pcCase,
  coolers: cooler,
  storage,
  prices: price,
};

// Every entity in every file, then the links between files: IDs are unique across the catalog,
// each variant's family exists, each board's CPU list names real CPUs on its socket, and each
// price names a purchasable part (not a GPU family).
export function validateCatalog(catalog: unknown): Issue[] {
  const issues: Issue[] = [];
  if (typeof catalog !== "object" || catalog === null) return [{ path: "$", message: "expected a catalog object" }];
  const c = catalog as Partial<Record<keyof Catalog, unknown>>;
  for (const file of CATALOG_FILES) issues.push(...validate(arr(ENTITY[file] as Check<unknown>), c[file], file));
  if (issues.length) return issues; // the link checks below assume well-formed records

  const cat = catalog as Catalog;
  const seen = new Map<string, string>();
  for (const file of CATALOG_FILES) {
    if (file === "prices") continue;
    cat[file].forEach((part, i) => {
      const where = `${file}[${i}].id`;
      const first = seen.get(part.id);
      if (first) issues.push({ path: where, message: `duplicate ID "${part.id}" (first at ${first})` });
      else seen.set(part.id, where);
    });
  }

  const families = new Set(cat.gpu_families.map((f) => f.id));
  cat.gpu_variants.forEach((v, i) => {
    if (!families.has(v.family_id)) issues.push({ path: `gpu_variants[${i}].family_id`, message: `no GPU family "${v.family_id}"` });
  });

  const cpuSockets = new Map(cat.cpus.map((x) => [x.id, x.socket]));
  cat.motherboards.forEach((b, i) => {
    if (!Array.isArray(b.supported_cpu_ids)) return;
    b.supported_cpu_ids.forEach((cpuId, j) => {
      const path = `motherboards[${i}].supported_cpu_ids[${j}]`;
      const socket = cpuSockets.get(cpuId);
      if (!socket) issues.push({ path, message: `no CPU "${cpuId}"` });
      else if (socket !== b.socket) issues.push({ path, message: `CPU "${cpuId}" is ${socket}; board is ${b.socket}` });
    });
  });

  const purchasable = new Set([...seen.keys()].filter((k) => !families.has(k)));
  cat.prices.forEach((p, i) => {
    if (!purchasable.has(p.product_id)) {
      const hint = families.has(p.product_id) ? " (that's a GPU family; price a variant instead)" : "";
      issues.push({ path: `prices[${i}].product_id`, message: `no purchasable part "${p.product_id}"${hint}` });
    }
  });
  return issues;
}
