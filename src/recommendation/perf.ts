// The performance model (docs/agent-plan.md §2): estimated FPS = min(CPU cap, GPU FPS at the
// resolution). CPU single/multi and GPU ray tracing are normalized indexes.
import type { Cpu, GpuFamily } from "../types/parts.ts";
import type { GamingEstimate, PerfEstimate, PerfMetric } from "../types/recommendation.ts";
import type { Resolution } from "../types/request.ts";

export interface System {
  cpu?: Cpu;
  gpu?: GpuFamily;
}

const FPS_FIELD = { "1080p": "r1080_fps", "1440p": "r1440_fps", "4k": "r4k_fps" } as const;

export function gamingEstimate({ cpu, gpu }: System, resolution: Resolution): GamingEstimate | null {
  const cpuCap = cpu?.perf.gaming_fps ?? null;
  const gpuCap = gpu?.perf[FPS_FIELD[resolution]] ?? null;
  if (cpuCap === null || gpuCap === null) return null;
  return {
    resolution,
    fps: Math.min(cpuCap, gpuCap),
    cpu_cap_fps: cpuCap,
    gpu_cap_fps: gpuCap,
    limited_by: cpuCap < gpuCap ? "cpu" : "gpu",
  };
}

export function perfEstimate(system: System, resolution: Resolution): PerfEstimate {
  return {
    gaming: gamingEstimate(system, resolution),
    single: system.cpu?.perf.single ?? null,
    multi: system.cpu?.perf.multi ?? null,
  };
}

export function metric(system: System, m: PerfMetric, resolution: Resolution): number | null {
  switch (m) {
    case "gaming_fps": return gamingEstimate(system, resolution)?.fps ?? null;
    case "single": return system.cpu?.perf.single ?? null;
    case "multi": return system.cpu?.perf.multi ?? null;
    case "rt": return system.gpu?.perf.rt ?? null;
  }
}

// Percent gain, to one decimal. null when either side is unknown.
export function gainPct(before: number | null, after: number | null): number | null {
  if (before === null || after === null || before <= 0) return null;
  return Math.round((after / before - 1) * 1000) / 10;
}
