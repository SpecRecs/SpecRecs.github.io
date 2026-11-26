// Turns reason objects into sentences (plan.md §23). Templates only: no LLM, no scoring.
import type { PartCategory } from "../types/common.ts";
import type { PerfMetric, Reason } from "../types/recommendation.ts";

const PART: Record<PartCategory | "system", string> = {
  cpu: "CPU", gpu: "GPU", motherboard: "motherboard", memory: "memory", psu: "power supply",
  case: "case", cooler: "CPU cooler", storage: "storage", system: "system",
};

const METRIC: Record<PerfMetric, string> = {
  gaming_fps: "gaming FPS",
  single: "single-thread score",
  multi: "multi-thread score",
  rt: "ray-tracing score",
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

export function explain(reason: Reason): string {
  switch (reason.type) {
    case "performance_gain":
      return `Upgrading the ${PART[reason.component]} raises estimated ${METRIC[reason.metric]} from ${reason.old_value} to ${reason.new_value} (${pct(reason.percent_gain)}).`;
    case "price_performance":
      return `The ${PART[reason.component]} delivers ${reason.value} ${METRIC[reason.metric]} for ${usd(reason.price_usd)}.`;
    case "upgrade_value":
      return `${pct(reason.percent_gain)} for ${usd(reason.cost_usd)}: the most improvement per dollar.`;
    case "platform_change":
      return `The new CPU also needs a new ${list(reason.requires.map((k) => PART[k]))}, so the full upgrade costs ${usd(reason.cost_usd)}.`;
    case "keep_part":
      return `Your ${reason.part_name} stays: it isn't what's holding this system back.`;
    case "budget_fit":
      return `Uses ${usd(reason.total_cost_usd)} of your ${usd(reason.budget_max_usd)} budget.`;
    case "preference_match":
      return `The ${PART[reason.component]} matches your ${reason.preference} preference (${reason.value}).`;
  }
}
