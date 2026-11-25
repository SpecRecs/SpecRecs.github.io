// M2: the compatibility engine (docs/agent-plan.md §6). checkBuild() runs every hard rule that
// applies to the parts given, and collects soft notes. Pure: no I/O beyond the bundled config.
import defaults from "../../config/compatibility.json" with { type: "json" };
import type { Case, Cooler, Cpu, GpuVariant, Memory, Motherboard, Psu } from "../types/parts.ts";
import type { BuildParts, CompatibilityConfig, CompatibilityReport, RuleResult } from "../types/compatibility.ts";
import { assertValid } from "../types/validate.ts";
import { compatibilityConfig } from "../types/validators.ts";
import { RULES, softNotes } from "./rules.ts";

export { allocateConnectors } from "./rules.ts";
export { estimateDrawW, requiredPsuW } from "./power.ts";

assertValid(compatibilityConfig, defaults, "config/compatibility.json");
export const DEFAULT_CONFIG: CompatibilityConfig = defaults;

// Every applicable rule's result, in RuleId order.
export function evaluate(parts: BuildParts, config: CompatibilityConfig = DEFAULT_CONFIG): RuleResult[] {
  return Object.values(RULES).flatMap((rule) => rule(parts, config) ?? []);
}

export function checkBuild(parts: BuildParts, config: CompatibilityConfig = DEFAULT_CONFIG): CompatibilityReport {
  const results = evaluate(parts, config);
  const violations = results.filter((r) => r.status === "fail");
  return {
    valid: violations.length === 0,
    violations,
    unknown: results.filter((r) => r.status === "unknown"),
    notes: softNotes(parts, config),
  };
}

// Per-pair helpers: the rules between two parts, for filtering candidates one pair at a time.
export const cpuFitsBoard = (cpu: Cpu, motherboard: Motherboard) => evaluate({ cpu, motherboard });
export const memoryFitsBoard = (memory: Memory, motherboard: Motherboard) => evaluate({ memory, motherboard });
export const boardFitsCase = (motherboard: Motherboard, pcCase: Case) => evaluate({ motherboard, case: pcCase });
export const gpuFitsCase = (gpu: GpuVariant, pcCase: Case) => evaluate({ gpu, case: pcCase });
export const coolerFitsCpu = (cooler: Cooler, cpu: Cpu) => evaluate({ cooler, cpu });
export const coolerFitsCase = (cooler: Cooler, pcCase: Case) => evaluate({ cooler, case: pcCase });
export const psuFitsCase = (psu: Psu, pcCase: Case) => evaluate({ psu, case: pcCase });
// PSU against the parts that draw power: wattage and connectors.
export const psuPowers = (psu: Psu, parts: { cpu?: Cpu; gpu?: GpuVariant }, config: CompatibilityConfig = DEFAULT_CONFIG) =>
  evaluate({ psu, ...parts }, config);

// "pass" only when every result passes; "fail" when any fails; otherwise "unknown".
export function overall(results: RuleResult[]): RuleResult["status"] {
  if (results.some((r) => r.status === "fail")) return "fail";
  return results.every((r) => r.status === "pass") ? "pass" : "unknown";
}
