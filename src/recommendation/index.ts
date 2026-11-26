// M4: the recommendation engine (docs/agent-plan.md §6). Deterministic: the same request and
// catalog always give the same recommendations. Pipeline: candidate builds that pass every hard
// rule and fit the budget (builds.ts) -> score and pick per category (rank.ts) -> reasons.
import type { Catalog } from "../types/catalog.ts";
import type { Recommendation } from "../types/recommendation.ts";
import type { UserRequest } from "../types/request.ts";
import { candidates, makeContext } from "./builds.ts";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "./config.ts";
import { score, select, toRecommendation } from "./rank.ts";

export { explain } from "../explanations/index.ts";
export { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "./config.ts";

// 1-3 distinct builds, in best_fit, best_value, performance order. Empty when nothing fits the
// budget (or, for upgrades, nothing beats the current system by config.min_gain_pct).
export function recommend(request: UserRequest, catalog: Catalog, config: EngineConfig = DEFAULT_ENGINE_CONFIG): Recommendation[] {
  const ctx = makeContext(request, catalog, config);
  return select(score(ctx, candidates(ctx))).map(({ s, categories }) => toRecommendation(ctx, s, categories));
}
