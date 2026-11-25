// Sample requests: the inputs of the M4 scenarios in docs/agent-plan.md §6. Expected outcomes are
// written by hand in test/scenarios/, not here.
import type { UserRequest } from "../src/types/request.ts";

// 5600X + RTX 3060, $600, 1440p gaming.
export const upgrade5600x3060: UserRequest = {
  mode: "upgrade",
  purpose: "gaming",
  budget_max_usd: 600,
  resolution: "1440p",
  size_pref: "none",
  style_pref: "none",
  current_system: {
    cpu: { name: "AMD Ryzen 5 5600X", lookup_id: null, candidate_id: "ryzen-5-5600x", specs: {} },
    gpu: { name: "NVIDIA GeForce RTX 3060 12GB", lookup_id: null, candidate_id: "rtx-3060-12gb", specs: { length_mm: 235 } },
    motherboard: { name: "MSI MAG B550 TOMAHAWK", lookup_id: null, candidate_id: "msi-mag-b550-tomahawk", specs: {} },
    memory: { name: "Corsair Vengeance LPX 32GB DDR4-3600", lookup_id: null, candidate_id: "corsair-vengeance-lpx-32gb-ddr4-3600", specs: {} },
    psu: { name: "Corsair RM850e", lookup_id: null, candidate_id: "corsair-rm850e", specs: {} },
    case: { name: "Fractal Design North", lookup_id: null, candidate_id: "fractal-design-north", specs: {} },
  },
  completed_at: "2026-11-25T12:00:00Z",
};

// The same system with no PSU entered: the engine should still recommend, and ask for the PSU.
export const upgradeMissingPsu: UserRequest = {
  ...upgrade5600x3060,
  current_system: { ...upgrade5600x3060.current_system, psu: undefined },
};

export const newBuild1080p: UserRequest = { mode: "new", purpose: "gaming", budget_max_usd: 1000, resolution: "1080p" };
export const newBuild4k: UserRequest = { mode: "new", purpose: "gaming", budget_max_usd: 2500, resolution: "4k" };
export const newBuildItx: UserRequest = { mode: "new", purpose: "gaming", budget_max_usd: 1500, resolution: "1440p", size_pref: "small" };
