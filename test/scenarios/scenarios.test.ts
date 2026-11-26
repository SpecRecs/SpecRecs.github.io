// M4 scenario tests: the contract between the engine and the frontend (docs/agent-plan.md §6, M4).
// The expected outcomes are decisions made by hand. Agents implement against them; they don't edit
// them. Exact picks follow from the fixture prices and FPS (fixtures/catalog.ts), so a fixture
// change can legitimately move them. Re-derive the expectation rather than loosening the assertion.
//
// These tests skip until src/recommendation/ and src/compatibility/ exist.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDGE_CASES, fixtureCatalog as catalog } from "../../fixtures/catalog.ts";
import * as requests from "../../fixtures/requests.ts";
import type { BuildParts, CompatibilityConfig, CompatibilityReport } from "../../src/types/compatibility.ts";
import type { Reason, Recommendation, RecommendationCategory } from "../../src/types/recommendation.ts";
import type { UserRequest } from "../../src/types/request.ts";
import type { Catalog } from "../../src/types/catalog.ts";
import { validate } from "../../src/types/validate.ts";
import * as v from "../../src/types/validators.ts";

interface Engine {
  recommend(request: UserRequest, catalog: Catalog): Recommendation[];
  explain(reason: Reason): string;
}
interface Compatibility {
  checkBuild(parts: BuildParts, config?: CompatibilityConfig): CompatibilityReport;
}

async function load<T>(path: string): Promise<T | null> {
  try {
    return (await import(path)) as T;
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_MODULE_NOT_FOUND") return null;
    throw e;
  }
}

const engine = await load<Engine>("../../src/recommendation/index.ts");
const compat = await load<Compatibility>("../../src/compatibility/index.ts");
const skip = !engine ? "M4 not built yet (src/recommendation/index.ts)" : !compat ? "M2 not built yet (src/compatibility/index.ts)" : false;

// --- lookups and helpers ---------------------------------------------------------------------

const ALL_PARTS = [
  ...catalog.cpus, ...catalog.gpu_variants, ...catalog.motherboards, ...catalog.memory,
  ...catalog.psus, ...catalog.cases, ...catalog.coolers, ...catalog.storage,
];
const byId = new Map(ALL_PARTS.map((p) => [p.id, p]));
const priceOf = (id: string) => Math.min(...catalog.prices.filter((p) => p.product_id === id).map((p) => p.price_usd));

const part = (rec: Recommendation, component: string) => rec.parts.find((p) => p.component === component);
const gpuFamily = (rec: Recommendation) => catalog.gpu_variants.find((g) => g.id === part(rec, "gpu")?.part_id)?.family_id;
const withCategory = (recs: Recommendation[], c: RecommendationCategory) => {
  const found = recs.filter((r) => r.categories.includes(c));
  assert.equal(found.length, 1, `exactly one recommendation is ${c}`);
  return found[0];
};

// The full build a recommendation describes: its parts, plus the current parts it keeps (upgrades).
function buildOf(rec: Recommendation, request: UserRequest): BuildParts {
  const get = <T>(id: string | null | undefined) => (id ? (byId.get(id) as T | undefined) : undefined);
  const current = request.current_system ?? {};
  const pick = <K extends keyof BuildParts>(k: K) => {
    const bought = rec.parts.find((p) => p.component === k)?.part_id;
    if (bought) return get<BuildParts[K]>(bought);
    if (k === "gpu") return undefined; // the current GPU is a family; there's no variant to check
    const kept = current[k as keyof typeof current];
    return kept && !Array.isArray(kept) ? get<BuildParts[K]>(kept.candidate_id) : undefined;
  };
  return {
    cpu: pick("cpu"), motherboard: pick("motherboard"), memory: pick("memory"), gpu: pick("gpu"),
    psu: pick("psu"), case: pick("case"), cooler: pick("cooler"),
    storage: rec.parts.filter((p) => p.component === "storage").map((p) => get(p.part_id)!),
  };
}

const NEW_BUILD_CATEGORIES = ["cpu", "motherboard", "memory", "gpu", "psu", "case", "cooler", "storage"];

// --- invariants: hold for every scenario --------------------------------------------------------

function checkInvariants(name: string, request: UserRequest, recs: Recommendation[]) {
  assert.ok(recs.length >= 1 && recs.length <= 3, `${name}: 1-3 recommendations`);

  // Valid against the contract, with at least one reason each.
  for (const rec of recs) assert.deepEqual(validate(v.recommendation, rec), [], `${name}: matches the Recommendation type`);

  // Distinct builds; every category appears exactly once across the list.
  const keys = recs.map((r) => r.parts.map((p) => p.part_id).sort().join(","));
  assert.equal(new Set(keys).size, recs.length, `${name}: no duplicate builds`);
  const cats = recs.flatMap((r) => r.categories).sort();
  assert.deepEqual(cats, ["best_fit", "best_value", "performance"], `${name}: each category exactly once`);

  for (const rec of recs) {
    const label = `${name} [${rec.categories.join("+")}]`;
    assert.equal(rec.mode, request.mode);

    // Budget, and a total that matches the parts' prices.
    assert.ok(rec.total_cost_usd <= request.budget_max_usd!, `${label}: within budget`);
    const sum = rec.parts.reduce((t, p) => t + p.price_usd, 0);
    assert.equal(rec.total_cost_usd, sum, `${label}: total = sum of parts`);

    // Candidate parts only, at a real fixture price, and never the unpriced part.
    for (const p of rec.parts) {
      assert.ok(byId.has(p.part_id), `${label}: ${p.part_id} is a candidate part`);
      assert.ok(catalog.prices.some((x) => x.product_id === p.part_id && x.price_usd === p.price_usd), `${label}: ${p.part_id} at a listed price`);
    }
    assert.ok(!rec.parts.some((p) => p.part_id === EDGE_CASES.missing_price), `${label}: excludes unpriced parts`);

    // New builds are complete.
    if (request.mode === "new") {
      for (const c of NEW_BUILD_CATEGORIES) assert.ok(part(rec, c), `${label}: includes a ${c}`);
    }

    // Compatible: no failed rule, and every unknown rule is flagged as a warning (unknowns are
    // allowed, not excluded).
    const report = compat!.checkBuild(buildOf(rec, request));
    assert.deepEqual(report.violations, [], `${label}: no compatibility violations`);
    for (const u of report.unknown) {
      assert.ok(rec.warnings.some((w) => w.type === "compatibility_unknown" && w.rule === u.rule), `${label}: warns about unknown ${u.rule}`);
    }

    // Upgrades: changing the CPU socket brings the board with it, and changing the memory type
    // brings the memory. The platform_change reason carries that whole cost, including a cooler
    // bought because the old one doesn't fit the new socket.
    if (request.mode === "upgrade") {
      const current = request.current_system!;
      const cpu = part(rec, "cpu");
      const oldBoard = byId.get(current.motherboard?.candidate_id ?? "") as BuildParts["motherboard"];
      if (cpu && oldBoard && (byId.get(cpu.part_id) as BuildParts["cpu"])!.socket !== oldBoard.socket) {
        const board = part(rec, "motherboard");
        assert.ok(board, `${label}: a new socket includes a motherboard`);
        const oldMemory = byId.get(current.memory?.candidate_id ?? "") as BuildParts["memory"];
        const newBoard = byId.get(board.part_id) as BuildParts["motherboard"];
        if (oldMemory && newBoard!.memory_type !== oldMemory.memory_type) assert.ok(part(rec, "memory"), `${label}: a new memory type includes memory`);
        const platform = rec.reasons.find((r) => r.type === "platform_change");
        assert.ok(platform, `${label}: has a platform_change reason`);
        const platformCost = rec.parts.filter((p) => ["cpu", "motherboard", "memory", "cooler"].includes(p.component)).reduce((t, p) => t + p.price_usd, 0);
        assert.equal(platform.cost_usd, platformCost, `${label}: platform_change costs CPU + board + memory + cooler in full`);
      }
    }

    // Every reason can be explained.
    for (const r of rec.reasons) assert.ok(engine!.explain(r).trim().length > 0, `${label}: explains ${r.type}`);
  }
}

function run(name: string, request: UserRequest) {
  const recs = engine!.recommend(request, catalog);
  checkInvariants(name, request, recs);
  // Deterministic: same input, same output.
  assert.deepEqual(engine!.recommend(structuredClone(request), structuredClone(catalog)), recs, `${name}: deterministic`);
  return recs;
}

// --- scenarios ------------------------------------------------------------------------------

describe("scenarios", { skip }, () => {
  it("5600X + RTX 3060, $600, 1440p gaming: favors a GPU upgrade", () => {
    const recs = run("upgrade 1440p", requests.upgrade5600x3060);

    // The 5600X caps at 140 FPS and the 3060 gets 48 at 1440p, so the GPU is the bottleneck. No
    // recommendation touches the CPU platform.
    for (const rec of recs) {
      assert.ok(!part(rec, "cpu") && !part(rec, "motherboard"), "GPU-bound: no CPU or board change");
      assert.ok(part(rec, "gpu"), "every option upgrades the GPU");
    }

    // Biggest 1440p gain under $600: RX 9060 XT 16GB, 74 FPS vs 48 (+54%) for $499. It's also the
    // fastest option in budget, so it's both best_fit and performance.
    const best = withCategory(recs, "best_fit");
    assert.equal(gpuFamily(best), "rx-9060-xt-16gb");
    assert.deepEqual(best.categories, ["best_fit", "performance"]);
    assert.ok(Math.abs(best.gain_pct! - 54.2) < 1, `gain ≈ 54%, got ${best.gain_pct}`);
    assert.equal(best.perf_estimate.gaming?.fps, 74);
    assert.equal(best.perf_estimate.gaming?.limited_by, "gpu");

    // Best gain per dollar: Arc B580, +40% for $329 (0.12%/$ vs the 9060 XT's 0.11%/$).
    const value = withCategory(recs, "best_value");
    assert.equal(gpuFamily(value), "arc-b580");
    assert.equal(part(value, "gpu")!.part_id, "arc-b580--limited-edition"); // the cheaper B580
  });

  it("5600X + RTX 3060, $600, productivity: costs the platform change in full", () => {
    const recs = run("upgrade productivity", requests.upgradeProductivity);

    // Biggest multi-thread gain under $600: Core i5-14600K (index 221, +121%) on the B760M DDR4
    // board, which reuses the current DDR4 kit: $229 + $119 = $348. (7600 on AM5 is +34% for $497;
    // 5700X3D drop-in is +25% for $199.) It also has the best gain per dollar.
    const best = withCategory(recs, "best_fit");
    assert.deepEqual(best.categories.slice(0, 2), ["best_fit", "best_value"]);
    assert.equal(part(best, "cpu")?.part_id, "core-i5-14600k");
    assert.equal(part(best, "motherboard")?.part_id, "msi-pro-b760m-a-ddr4");
    assert.ok(!part(best, "memory"), "DDR4 board: keeps the current DDR4 kit");
    const platform = best.reasons.find((r) => r.type === "platform_change");
    assert.equal(platform?.cost_usd, priceOf("core-i5-14600k") + priceOf("msi-pro-b760m-a-ddr4"));
    assert.ok(Math.abs(best.gain_pct! - 121) < 1, `gain ≈ 121%, got ${best.gain_pct}`);

    // The B760M's CPU list isn't curated: allowed, with a warning.
    assert.ok(best.warnings.some((w) => w.type === "compatibility_unknown" && w.rule === "cpu_board_support"));
  });

  it("$1,000 new build, 1080p gaming", () => {
    const recs = run("new 1080p", requests.newBuild1080p);

    // The cheapest complete build without a GPU is $518 (12400F + B760M DDR4 + 16 GB DDR4 + CX450
    // + 4000D + Hyper 212 + P3 Plus), so the RX 9060 XT ($499) can't fit. The Arc B580 (76 FPS at
    // 1080p) is the fastest GPU that does, and every fixture CPU caps above 76.
    const best = withCategory(recs, "best_fit");
    assert.equal(gpuFamily(best), "arc-b580");
    assert.equal(best.perf_estimate.gaming?.fps, 76);
    assert.equal(best.perf_estimate.gaming?.limited_by, "gpu");
    assert.equal(best.gain_pct, null);
  });

  it("$2,500 new build, 4K gaming: same FPS for less wins", () => {
    const recs = run("new 4K", requests.newBuild4k);

    // The RX 9070 XT and RTX 5070 Ti both get 80 FPS at 4K. The 9070 XT is $321 cheaper; ray tracing
    // is only a tie-breaker, so the 9070 XT is best_fit. Only the PowerColor card has a price.
    const best = withCategory(recs, "best_fit");
    assert.equal(part(best, "gpu")?.part_id, "rx-9070-xt--powercolor-reaper");
    assert.equal(best.perf_estimate.gaming?.fps, 80);
    assert.equal(best.perf_estimate.gaming?.resolution, "4k");
  });

  it("small size preference: every result fits Mini-ITX", () => {
    const recs = run("new ITX", requests.newBuildItx);
    for (const rec of recs) {
      const build = buildOf(rec, requests.newBuildItx);
      assert.equal(build.motherboard?.form_factor, "Mini-ITX");
      assert.equal(build.case?.size_class, "small");
      assert.ok(build.case!.supported_mb_form_factors.includes("Mini-ITX"));
      assert.ok(build.case!.supported_psu_form_factors.includes(build.psu!.form_factor));
      assert.ok(build.memory!.module_count <= build.motherboard!.memory_slots);
    }
  });

  it("upgrade with no PSU entered: recommends anyway, and asks for the PSU", () => {
    const recs = run("upgrade no PSU", requests.upgradeMissingPsu);

    // The engine assumes the PSU is adequate, so the pick matches the full-information scenario
    // and no PSU is added to the cost.
    assert.equal(gpuFamily(withCategory(recs, "best_fit")), "rx-9060-xt-16gb");
    for (const rec of recs) {
      assert.ok(!part(rec, "psu"), "doesn't buy a PSU it can't prove is needed");
      assert.ok(rec.warnings.some((w) => w.type === "missing_info" && w.component === "psu" && w.field === "wattage_w"), "asks for PSU wattage");
    }
  });
});
