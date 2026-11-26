// Tunable numbers for the engine, from config/. Validated on load so a bad edit fails loudly.
import general from "../../config/recommendation.json" with { type: "json" };
import workloads from "../../config/workload_weights.json" with { type: "json" };
import type { PerfMetric } from "../types/recommendation.ts";
import type { Purpose, Resolution } from "../types/request.ts";
import { arr, assertValid, num, obj, oneOf, record } from "../types/validate.ts";

// Score terms. Each is normalized to 0-1 across the builds being compared (1 = best of them).
//   primary  the workload's main metric (FPS at the target resolution, or a CPU index)
//   value    new builds: primary per dollar; upgrades: % gain per dollar
//   rt, vram GPU ray-tracing index and VRAM
//   single, multi, gaming  CPU indexes and FPS, as secondary terms
export const TERMS = ["primary", "value", "rt", "vram", "single", "multi", "gaming"] as const;
export type Term = (typeof TERMS)[number];

export interface Workload {
  primary: PerfMetric;
  weights: Partial<Record<Term, number>>;
}

export interface EngineConfig {
  workloads: Record<Purpose, Workload>;
  default_purpose: Purpose;
  default_resolution: Resolution;
  // Upgrades below this gain on the primary metric are not recommended (plan.md §19: "negligible").
  min_gain_pct: number;
  // CPU cap below GPU FPS by this ratio or more gets an imbalance warning.
  imbalance_ratio: number;
  // Prices older than this, relative to the newest price in the catalog, get a price_stale warning.
  stale_price_days: number;
  // New builds get the cheapest drive at least this big.
  min_storage_gb: number;
  // Memory bought must be at least `gb`, using the last tier whose from_budget_usd <= budget_max_usd.
  min_memory_gb: { from_budget_usd: number; gb: number }[];
  // Each "unknown" compatibility result multiplies a build's score and value by (1 - penalty).
  unknown_penalty: number;
}

const PURPOSES = ["gaming", "gaming_streaming", "general", "productivity"] as const;
const workload = obj<Workload>({
  primary: oneOf(["gaming_fps", "single", "multi", "rt"]),
  weights: record(TERMS, num({ min: 0, max: 1 })),
});

assertValid(obj<Record<Purpose, Workload>>({ gaming: workload, gaming_streaming: workload, general: workload, productivity: workload }), workloads, "config/workload_weights.json");
assertValid(
  obj<Omit<EngineConfig, "workloads">>({
    default_purpose: oneOf(PURPOSES),
    default_resolution: oneOf(["1080p", "1440p", "4k"]),
    min_gain_pct: num({ min: 0 }),
    imbalance_ratio: num({ min: 1 }),
    stale_price_days: num({ min: 0 }),
    min_storage_gb: num({ min: 0 }),
    min_memory_gb: arr(obj<EngineConfig["min_memory_gb"][number]>({ from_budget_usd: num({ min: 0 }), gb: num({ min: 0 }) }), { nonEmpty: true }),
    unknown_penalty: num({ min: 0, max: 1 }),
  }),
  general,
  "config/recommendation.json",
);

export const DEFAULT_ENGINE_CONFIG: EngineConfig = { ...general, workloads } as EngineConfig;
