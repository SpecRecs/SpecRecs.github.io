// Labels and lookups for the results page. Display only: every number shown comes from recommend().
import { fixtureCatalog } from "../../../fixtures/catalog.ts";
import type { EngineConfig } from "../../recommendation/index.ts";
import type { Catalog } from "../../types/catalog.ts";
import type { PartCategory } from "../../types/common.ts";
import type { RecommendationCategory } from "../../types/recommendation.ts";
import type { Resolution, UserRequest } from "../../types/request.ts";
import { usd } from "../../explanations/index.ts";

// The catalog the page recommends from. Until M5 publishes a snapshot, it's the hand-written fixture
// catalog, so every part and price shown is sample data and the page says so.
export const CATALOG: Catalog = fixtureCatalog;
export const CATALOG_IS_SAMPLE = true;

export const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  best_fit: "Best fit", best_value: "Best value", performance: "Top performance",
};

export const COMPONENT_LABEL: Record<PartCategory, string> = {
  cpu: "CPU", gpu: "GPU", motherboard: "Motherboard", memory: "Memory",
  psu: "Power supply", case: "Case", cooler: "CPU cooler", storage: "Storage",
};

export const RESOLUTION_LABEL: Record<Resolution, string> = { "1080p": "1080p", "1440p": "1440p", "4k": "4K" };

export const isGaming = (r: UserRequest) => r.purpose === "gaming" || r.purpose === "gaming_streaming";

// Product ID -> display name, for every part in the catalog. Unknown IDs fall back to the ID.
export function partNames(catalog: Catalog): (id: string) => string {
  const names = new Map<string, string>();
  const { prices: _, ...lists } = catalog;
  for (const list of Object.values(lists)) for (const p of list) names.set(p.id, p.name);
  return (id) => names.get(id) ?? id;
}

// Why recommend() came back empty, in the engine's own terms (see its doc comment).
export function emptyMessage(request: UserRequest, config: EngineConfig): string {
  const budget = request.budget_max_usd !== undefined ? usd(request.budget_max_usd) : "your budget";
  return request.mode === "upgrade"
    ? `Nothing in our catalog beats your current system by at least ${config.min_gain_pct}% for ${budget}. Try a bigger budget, or check your current parts.`
    : `No complete build fits in ${budget}. Try a bigger budget.`;
}
