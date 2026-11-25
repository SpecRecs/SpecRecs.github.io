// The M4 contract: recommend(request, snapshot) -> Recommendation[], and explain(reason) -> string.
// The frontend only renders these; it never computes scores (docs/agent-plan.md §3).
import type { Id, IsoDate, PartCategory } from "./common.ts";
import type { RuleId } from "./compatibility.ts";
import type { Mode, Resolution } from "./request.ts";

export type RecommendationCategory = "best_fit" | "best_value" | "performance";

// A part to buy. A GPU's part_id is a GpuVariant ID.
export interface RecommendedPart {
  component: PartCategory;
  part_id: Id;
  price_usd: number;
  retailer: string;
  last_checked: IsoDate;
  // Upgrades only: the current part's name, when this replaces one.
  replaces: string | null;
}

export type PerfMetric = "gaming_fps" | "single" | "multi" | "rt";

export interface GamingEstimate {
  resolution: Resolution;
  // min(cpu_cap_fps, gpu_cap_fps). No bottleneck percentage is derived from these.
  fps: number;
  cpu_cap_fps: number;
  gpu_cap_fps: number;
  limited_by: "cpu" | "gpu";
}

export interface PerfEstimate {
  gaming: GamingEstimate | null; // null for non-gaming purposes or missing scores
  single: number | null; // index
  multi: number | null; // index
}

export type Reason =
  | { type: "performance_gain"; component: PartCategory | "system"; metric: PerfMetric; old_value: number; new_value: number; percent_gain: number }
  | { type: "price_performance"; component: PartCategory; metric: PerfMetric; value: number; price_usd: number }
  | { type: "upgrade_value"; component: PartCategory; percent_gain: number; cost_usd: number }
  // A CPU change that needs a new board and/or memory; cost_usd is the full cascading cost.
  | { type: "platform_change"; requires: PartCategory[]; cost_usd: number }
  | { type: "keep_part"; component: PartCategory; part_name: string }
  | { type: "budget_fit"; total_cost_usd: number; budget_max_usd: number }
  | { type: "preference_match"; preference: "size" | "style"; component: PartCategory; value: string };

export type ReasonType = Reason["type"];

export type Warning =
  // The engine needs a field the user didn't give, e.g. { component: "psu", field: "wattage_w" }.
  | { type: "missing_info"; component: PartCategory; field: string }
  | { type: "compatibility_unknown"; rule: RuleId; components: PartCategory[] }
  | { type: "imbalance"; limited_by: "cpu" | "gpu" }
  | { type: "over_preferred_budget"; total_cost_usd: number; budget_preferred_usd: number }
  | { type: "price_stale"; product_id: Id; last_checked: IsoDate };

export interface Recommendation {
  category: RecommendationCategory;
  mode: Mode;
  parts: RecommendedPart[];
  total_cost_usd: number;
  perf_estimate: PerfEstimate;
  // Upgrades: gain over the current system on the request's main metric. null for new builds.
  gain_pct: number | null;
  // At least one per recommendation.
  reasons: Reason[];
  warnings: Warning[];
}
