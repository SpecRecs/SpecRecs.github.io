// M6: the results page's pure parts. Matching My PC parts to candidates, labels, and warning text.
// The page itself only renders recommend() output (docs/agent-plan.md §3).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixtureCatalog } from "../../fixtures/catalog.ts";
import { upgrade5600x3060 } from "../../fixtures/requests.ts";
import type { Build, Part } from "../../src/build/types.ts";
import { matchCurrent } from "../../src/pages/results/current.ts";
import { emptyMessage, partNames } from "../../src/pages/results/view.ts";
import { DEFAULT_ENGINE_CONFIG, explainWarning, recommend } from "../../src/recommendation/index.ts";
import type { Warning } from "../../src/types/recommendation.ts";

const part = (name: string, specs: Part["specs"] = []): Part => ({ id: "lookup-id", name, subtitle: "", specs });

// The 5600X + RTX 3060 scenario as the My PC page saves it: names and spec strings as the lookup
// catalog and its mappers (src/build/sources.ts) produce them, not the fixture names.
const myPc: Build = {
  cpu: [part("AMD Ryzen 5 5600X")],
  gpu: [part("NVIDIA GeForce RTX 3060 12 GB")],
  motherboard: [part("MSI MAG B550 TOMAHAWK")],
  ram: [part("Corsair Vengeance LPX 32 GB", [["Type", "DDR4"], ["Speed", "3,600 MT/s"], ["Total", "32 GB"]])],
  psu: [part("Corsair RM850e (2023)", [["Wattage", "850 W"]])],
  storage: [part("Samsung 990 Pro 2 TB")],
};

describe("matchCurrent", () => {
  it("matches lookup names to candidates", () => {
    const { system, unmatched } = matchCurrent(myPc, fixtureCatalog);
    assert.deepEqual(unmatched, []);
    assert.deepEqual(
      Object.fromEntries(Object.entries(system).map(([k, v]) => [k, Array.isArray(v) ? v.map((p) => p.candidate_id) : v.candidate_id])),
      {
        cpu: "ryzen-5-5600x", gpu: "rtx-3060-12gb", motherboard: "msi-mag-b550-tomahawk",
        memory: "corsair-vengeance-lpx-32gb-ddr4-3600", psu: "corsair-rm850e", storage: ["samsung-990-pro-2tb"],
      },
    );
    assert.equal(system.cpu?.name, "AMD Ryzen 5 5600X");
    assert.equal(system.cpu?.lookup_id, "lookup-id");
  });

  it("reproduces the upgrade scenario through the My PC page", () => {
    // The scenario also names a case, which the My PC page doesn't ask for yet, so drop it from both.
    const scenario = { ...upgrade5600x3060, current_system: { ...upgrade5600x3060.current_system, case: undefined } };
    const ids = (r: ReturnType<typeof recommend>) => r.map((x) => [x.categories, x.parts.map((p) => p.part_id), x.gain_pct]);
    const viaPage = recommend({ ...upgrade5600x3060, current_system: matchCurrent(myPc, fixtureCatalog).system }, fixtureCatalog);
    assert.ok(viaPage.length > 0);
    assert.deepEqual(ids(viaPage), ids(recommend(scenario, fixtureCatalog)));
  });

  it("matches a GPU by board-partner name to its family", () => {
    const { system } = matchCurrent({ gpu: [part("Sapphire Pulse Radeon RX 9060 XT 16GB")] }, fixtureCatalog);
    assert.equal(system.gpu?.candidate_id, "rx-9060-xt-16gb");
  });

  it("never matches a different model that shares a prefix", () => {
    const { system, unmatched } = matchCurrent({ cpu: [part("AMD Ryzen 5 5600X3D")], gpu: [part("NVIDIA GeForce RTX 5070 Ti SUPER")] }, fixtureCatalog);
    assert.equal(system.cpu?.candidate_id, null);
    assert.equal(system.gpu?.candidate_id, null);
    assert.deepEqual(unmatched, ["AMD Ryzen 5 5600X3D", "NVIDIA GeForce RTX 5070 Ti SUPER"]);
  });

  it("checks specs before matching memory and PSUs by name prefix", () => {
    const slow = matchCurrent({ ram: [part("Corsair Vengeance LPX 32 GB", [["Type", "DDR4"], ["Speed", "3,200 MT/s"]])] }, fixtureCatalog);
    assert.equal(slow.system.memory?.candidate_id, null);
    const smaller = matchCurrent({ psu: [part("Corsair RM850e", [["Wattage", "750 W"]])] }, fixtureCatalog);
    assert.equal(smaller.system.psu?.candidate_id, null);
  });

  it("leaves out categories the user didn't enter", () => {
    assert.deepEqual(matchCurrent({}, fixtureCatalog), { system: {}, matched: [], unmatched: [] });
    assert.deepEqual(Object.keys(matchCurrent({ cpu: [part("AMD Ryzen 5 5600X")], storage: [] }, fixtureCatalog).system), ["cpu"]);
  });
});

describe("view", () => {
  it("names every part, including GPU variants", () => {
    const nameOf = partNames(fixtureCatalog);
    assert.equal(nameOf("arc-b580--limited-edition"), "Intel Arc B580 Limited Edition");
    assert.equal(nameOf("corsair-rm850e"), "Corsair RM850e 850W 80+ Gold");
    assert.equal(nameOf("not-a-part"), "not-a-part");
  });

  it("explains an empty result by mode", () => {
    assert.match(emptyMessage({ mode: "new", budget_max_usd: 500 }, DEFAULT_ENGINE_CONFIG), /No complete build fits in \$500/);
    assert.match(emptyMessage({ mode: "upgrade", budget_max_usd: 600 }, DEFAULT_ENGINE_CONFIG), /at least 15% for \$600/);
  });
});

describe("explainWarning", () => {
  it("has a sentence for every warning type", () => {
    const samples: Warning[] = [
      { type: "missing_info", component: "psu", field: "wattage_w" },
      { type: "missing_info", component: "gpu", field: "model" },
      { type: "compatibility_unknown", rule: "cpu_board_support", components: ["cpu", "motherboard"] },
      { type: "imbalance", limited_by: "cpu" },
      { type: "over_preferred_budget", total_cost_usd: 972, budget_preferred_usd: 900 },
      { type: "price_stale", product_id: "arc-b580--limited-edition", last_checked: "2026-10-01" },
    ];
    assert.deepEqual(samples.map((w) => explainWarning(w, partNames(fixtureCatalog))), [
      "We don't know your power supply's wattage, so this assumes it works.",
      "We couldn't identify your GPU, so the gain over it can't be estimated.",
      "We couldn't confirm the motherboard supports this CPU: our data is missing a spec. Check the manufacturer's specs before buying.",
      "The CPU holds this build back: it caps FPS well below what the GPU can reach.",
      "Costs $972, more than your preferred $900.",
      "The Intel Arc B580 Limited Edition price was last checked Oct 1, 2026, so it may have changed.",
    ]);
  });
});
