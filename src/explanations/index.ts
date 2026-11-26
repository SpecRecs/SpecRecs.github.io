// Turns reason and warning objects into sentences (plan.md §23). Templates only: no LLM, no scoring.
import type { PartCategory } from "../types/common.ts";
import type { RuleId } from "../types/compatibility.ts";
import type { PerfMetric, Reason, Warning } from "../types/recommendation.ts";

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

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
// "2026-11-20" -> "Nov 20, 2026". Read as UTC so the day doesn't shift with the viewer's time zone.
export const date = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
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

// What each rule checks, for "couldn't confirm ..." sentences.
const RULE: Record<RuleId, string> = {
  socket: "the CPU fits the motherboard's socket",
  cpu_board_support: "the motherboard supports this CPU",
  memory_type: "the memory type matches the motherboard and CPU",
  memory_slots: "the motherboard has enough memory slots",
  board_case_form_factor: "the motherboard fits the case",
  gpu_length: "the GPU fits in the case",
  cooler_socket: "the CPU cooler fits the socket",
  cooler_height: "the CPU cooler fits in the case",
  radiator_fit: "the radiator fits in the case",
  psu_wattage: "the power supply has enough wattage",
  psu_connectors: "the power supply has the GPU's power connectors",
  psu_form_factor: "the power supply fits the case",
  m2_slots: "the motherboard has enough M.2 slots",
};

const FIELD: Record<string, string> = {
  wattage_w: "wattage", socket: "socket", memory_type: "memory type",
  supported_sockets: "socket support", max_gpu_length_mm: "GPU clearance",
};

// nameOf turns a product ID into a display name; by default the ID is shown.
export function explainWarning(warning: Warning, nameOf: (id: string) => string = (id) => id): string {
  switch (warning.type) {
    case "missing_info":
      return warning.field === "model"
        ? `We couldn't identify your ${PART[warning.component]}, so the gain over it can't be estimated.`
        : `We don't know your ${PART[warning.component]}'s ${FIELD[warning.field] ?? warning.field}, so this assumes it works.`;
    case "compatibility_unknown":
      return `We couldn't confirm ${RULE[warning.rule]}: our data is missing a spec. Check the manufacturer's specs before buying.`;
    case "imbalance":
      return warning.limited_by === "cpu"
        ? "The CPU holds this build back: it caps FPS well below what the GPU can reach."
        : "The GPU holds this build back: it caps FPS well below what the CPU can reach.";
    case "over_preferred_budget":
      return `Costs ${usd(warning.total_cost_usd)}, more than your preferred ${usd(warning.budget_preferred_usd)}.`;
    case "price_stale":
      return `The ${nameOf(warning.product_id)} price was last checked ${date(warning.last_checked)}, so it may have changed.`;
  }
}
