// PSU sizing. A build needs the larger of:
//   - estimated draw × (1 + psu_headroom), where draw = base_system_w + CPU TDP + GPU TDP
//   - the GPU maker's recommended PSU wattage
// Only parts present in the build count, so checking a PSU against a lone GPU works.
import type { BuildParts, CompatibilityConfig } from "../types/compatibility.ts";

export interface PsuRequirement {
  // The highest requirement known so far. Unknown TDPs only make the real figure higher, so a PSU
  // below this fails even when the estimate is incomplete.
  min_w: number;
  // False when a present part's power is unknown, so min_w may be too low.
  complete: boolean;
  missing: string[]; // e.g. ["cpu.tdp_w"]
}

export function estimateDrawW({ cpu, gpu }: BuildParts, config: CompatibilityConfig): { draw_w: number; missing: string[] } {
  const missing: string[] = [];
  let draw = config.base_system_w;
  if (cpu) cpu.tdp_w === null ? missing.push("cpu.tdp_w") : (draw += cpu.tdp_w);
  if (gpu) gpu.tdp_w === null ? missing.push("gpu.tdp_w") : (draw += gpu.tdp_w);
  return { draw_w: draw, missing };
}

export function requiredPsuW(parts: BuildParts, config: CompatibilityConfig): PsuRequirement {
  const { draw_w, missing } = estimateDrawW(parts, config);
  const candidates = [Math.ceil(draw_w * (1 + config.psu_headroom))];
  const recommended = parts.gpu?.recommended_psu_w;
  if (recommended != null) candidates.push(recommended);
  return { min_w: Math.max(...candidates), complete: missing.length === 0, missing };
}
