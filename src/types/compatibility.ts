// The M2 contract: checkBuild(parts, config) -> CompatibilityReport. Defined here so M4 can build
// against it before M2 lands.
import type { PartCategory } from "./common.ts";
import type { Case, Cooler, Cpu, GpuVariant, Memory, Motherboard, Psu, Storage } from "./parts.ts";

// Any subset of a build. Missing parts skip the rules that need them.
export interface BuildParts {
  cpu?: Cpu;
  motherboard?: Motherboard;
  memory?: Memory;
  gpu?: GpuVariant;
  psu?: Psu;
  case?: Case;
  cooler?: Cooler;
  storage?: Storage[];
}

// Hard rules (docs/agent-plan.md §6, M2).
export const RULE_IDS = [
  "socket", // CPU socket = board socket
  "cpu_board_support", // board lists the CPU
  "memory_type", // kit type = board memory type, and the CPU supports it
  "memory_slots", // kit modules <= board slots
  "board_case_form_factor",
  "gpu_length",
  "cooler_socket",
  "cooler_height", // air coolers
  "radiator_fit", // AIO coolers
  "psu_wattage",
  "psu_connectors",
  "psu_form_factor",
  "m2_slots",
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export interface RuleResult {
  rule: RuleId;
  // "unknown" when a field the rule needs is null. It's never reported as a pass.
  status: "pass" | "fail" | "unknown";
  components: PartCategory[];
  // e.g. "GPU is 357 mm; case fits 330 mm". For a reader, not for parsing.
  detail: string;
}

// Soft findings. They never invalidate a build.
export interface CompatibilityNote {
  code: "psu_headroom_low" | "cooler_tdp_low" | "no_wifi" | "memory_speed_above_rated";
  components: PartCategory[];
  detail: string;
}

export interface CompatibilityReport {
  // True when no rule failed. Unknown results don't make a build invalid; the engine decides what to
  // do with them (e.g. ask the user for the missing field).
  valid: boolean;
  violations: RuleResult[]; // status "fail"
  unknown: RuleResult[]; // status "unknown"
  notes: CompatibilityNote[];
}

// Tunable numbers, loaded from config/ by the caller.
export interface CompatibilityConfig {
  // Required PSU wattage = estimated system draw × (1 + headroom). e.g. 0.3 for 30%.
  psu_headroom: number;
}
