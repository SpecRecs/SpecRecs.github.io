// M4 unit tests: behavior the scenarios (test/scenarios/) don't pin down. Config knobs, warnings,
// preferences, empty results and explanations.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixtureCatalog } from "../../fixtures/catalog.ts";
import { newBuild1080p, upgrade5600x3060 } from "../../fixtures/requests.ts";
import { DEFAULT_ENGINE_CONFIG, explain, recommend } from "../../src/recommendation/index.ts";
import type { Catalog } from "../../src/types/catalog.ts";
import type { Reason, Recommendation } from "../../src/types/recommendation.ts";
import type { UserRequest } from "../../src/types/request.ts";

const catalog = (): Catalog => structuredClone(fixtureCatalog);
const partId = (r: Recommendation, component: string) => r.parts.find((p) => p.component === component)?.part_id;
const memoryGb = (r: Recommendation) => fixtureCatalog.memory.find((m) => m.id === partId(r, "memory"))!.capacity_gb;
const bestFit = (recs: Recommendation[]) => recs.find((r) => r.categories.includes("best_fit"))!;

describe("recommend", () => {
  it("returns nothing when no complete build fits the budget", () => {
    // The cheapest complete build with a GPU is about $850.
    assert.deepEqual(recommend({ ...newBuild1080p, budget_max_usd: 500 }, fixtureCatalog), []);
  });

  it("returns nothing when no upgrade clears min_gain_pct", () => {
    const top: UserRequest = {
      mode: "upgrade", purpose: "gaming", budget_max_usd: 600, resolution: "1440p",
      current_system: {
        cpu: { name: "Ryzen 7 9800X3D", lookup_id: null, candidate_id: "ryzen-7-9800x3d", specs: {} },
        gpu: { name: "RTX 5070 Ti", lookup_id: null, candidate_id: "rtx-5070-ti", specs: {} },
      },
    };
    assert.deepEqual(recommend(top, fixtureCatalog), []);
  });

  it("doesn't mutate its inputs", () => {
    const c = catalog();
    const r = structuredClone(upgrade5600x3060);
    recommend(r, c);
    assert.deepEqual(c, fixtureCatalog);
    assert.deepEqual(r, upgrade5600x3060);
  });

  it("buys memory by the budget tiers in min_memory_gb", () => {
    for (const r of recommend({ ...newBuild1080p, budget_max_usd: 1000 }, fixtureCatalog)) assert.ok(memoryGb(r) >= 32);
    // Under $1,000 the 16 GB kit is allowed, and the cheapest build uses it.
    assert.equal(memoryGb(bestFit(recommend({ ...newBuild1080p, budget_max_usd: 950 }, fixtureCatalog))), 16);
  });

  it("penalizes unknown compatibility results by unknown_penalty", () => {
    // With the penalty, the verified 5600X + B550 build beats the cheaper i5-12400F on the
    // B760M, whose CPU list isn't curated. Without it, the cheaper build wins.
    assert.equal(partId(bestFit(recommend(newBuild1080p, fixtureCatalog)), "motherboard"), "msi-mag-b550-tomahawk");
    const noPenalty = recommend(newBuild1080p, fixtureCatalog, { ...DEFAULT_ENGINE_CONFIG, unknown_penalty: 0 });
    const best = bestFit(noPenalty);
    assert.equal(partId(best, "motherboard"), "msi-pro-b760m-a-ddr4");
    assert.ok(best.warnings.some((w) => w.type === "compatibility_unknown" && w.rule === "cpu_board_support"));
  });

  it("performance breaks FPS ties upward instead of by price", () => {
    // At 4K the RX 9070 XT and RTX 5070 Ti tie on FPS; performance takes the faster RT card.
    const recs = recommend({ mode: "new", purpose: "gaming", budget_max_usd: 2500, resolution: "4k" }, fixtureCatalog);
    const perf = recs.find((r) => r.categories.includes("performance"))!;
    assert.deepEqual(perf.categories, ["performance"]);
    assert.equal(partId(perf, "gpu"), "rtx-5070-ti--asus-prime-oc");
    assert.ok(perf.total_cost_usd > bestFit(recs).total_cost_usd);
  });

  it("prefers a case matching the style preference when one fits", () => {
    const best = bestFit(recommend({ ...newBuild1080p, style_pref: "rgb" }, fixtureCatalog));
    assert.equal(partId(best, "case"), "lian-li-lancool-216");
    assert.ok(best.reasons.some((r) => r.type === "preference_match" && r.preference === "style" && r.value === "rgb"));
  });

  it("keeps the current part when it fits, and replaces it when it doesn't", () => {
    // "general" ranks by single-thread, where the 9800X3D is the fastest CPU that has a board, so it's
    // the performance pick. Moving to AM5 replaces the board and the DDR4 kit; the RM850e and case stay.
    const recs = recommend({ ...upgrade5600x3060, purpose: "general", budget_max_usd: 1000 }, fixtureCatalog);
    const amd = recs.find((r) => r.categories.includes("performance"))!;
    assert.equal(partId(amd, "cpu"), "ryzen-7-9800x3d");
    assert.ok(partId(amd, "motherboard") && partId(amd, "memory"));
    assert.ok(!partId(amd, "psu") && !partId(amd, "case"));
    assert.equal(amd.parts.find((p) => p.component === "memory")!.replaces, "Corsair Vengeance LPX 32GB DDR4-3600");
  });
});

describe("warnings", () => {
  it("price_stale for prices older than stale_price_days before the newest", () => {
    const c = catalog();
    c.prices.find((p) => p.product_id === "arc-b580--limited-edition")!.last_checked = "2026-10-01";
    const best = bestFit(recommend(newBuild1080p, c));
    assert.equal(partId(best, "gpu"), "arc-b580--limited-edition");
    assert.ok(best.warnings.some((w) => w.type === "price_stale" && w.product_id === "arc-b580--limited-edition"));
    assert.ok(!bestFit(recommend(newBuild1080p, fixtureCatalog)).warnings.some((w) => w.type === "price_stale"));
  });

  it("imbalance when the CPU caps FPS well below the GPU", () => {
    const c = catalog();
    for (const cpu of c.cpus) cpu.perf.gaming_fps = 50; // B580 does 76 at 1080p: ratio 1.52
    const best = bestFit(recommend(newBuild1080p, c));
    assert.equal(best.perf_estimate.gaming?.limited_by, "cpu");
    assert.ok(best.warnings.some((w) => w.type === "imbalance" && w.limited_by === "cpu"));
  });

  it("over_preferred_budget above budget_preferred_usd", () => {
    const best = bestFit(recommend({ ...newBuild1080p, budget_preferred_usd: 900 }, fixtureCatalog));
    assert.ok(best.warnings.some((w) => w.type === "over_preferred_budget" && w.budget_preferred_usd === 900));
  });
});

describe("explain", () => {
  const samples: Reason[] = [
    { type: "performance_gain", component: "gpu", metric: "gaming_fps", old_value: 48, new_value: 74, percent_gain: 54.2 },
    { type: "price_performance", component: "gpu", metric: "gaming_fps", value: 76, price_usd: 329 },
    { type: "upgrade_value", component: "gpu", percent_gain: 39.6, cost_usd: 329 },
    { type: "platform_change", requires: ["motherboard", "memory"], cost_usd: 497 },
    { type: "keep_part", component: "cpu", part_name: "AMD Ryzen 5 5600X" },
    { type: "budget_fit", total_cost_usd: 1442, budget_max_usd: 2500 },
    { type: "preference_match", preference: "size", component: "case", value: "small" },
  ];

  it("has a sentence for every reason type", () => {
    assert.deepEqual(samples.map(explain), [
      "Upgrading the GPU raises estimated gaming FPS from 48 to 74 (+54.2%).",
      "The GPU delivers 76 gaming FPS for $329.",
      "+39.6% for $329: the most improvement per dollar.",
      "The new CPU also needs a new motherboard and memory, so the full upgrade costs $497.",
      "Your AMD Ryzen 5 5600X stays: it isn't what's holding this system back.",
      "Uses $1,442 of your $2,500 budget.",
      "The case matches your size preference (small).",
    ]);
  });
});
