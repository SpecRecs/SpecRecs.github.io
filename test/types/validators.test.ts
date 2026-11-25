// M0 acceptance: every fixture passes the validators, and the validators reject bad data.
// Run with `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDGE_CASES, fixtureCatalog } from "../../fixtures/catalog.ts";
import * as requests from "../../fixtures/requests.ts";
import type { Catalog } from "../../src/types/catalog.ts";
import { isId, slugify, variantId } from "../../src/types/ids.ts";
import type { Recommendation } from "../../src/types/recommendation.ts";
import { assertValid, validate } from "../../src/types/validate.ts";
import * as v from "../../src/types/validators.ts";

// A deep copy the test can break without touching the fixture.
const copy = (): Catalog => structuredClone(fixtureCatalog);
const messages = (issues: { path: string; message: string }[]) => issues.map((i) => `${i.path}: ${i.message}`);

describe("fixtures", () => {
  it("pass validateCatalog", () => {
    assert.deepEqual(messages(v.validateCatalog(fixtureCatalog)), []);
  });

  it("have the sizes agent-plan §5 asks for", () => {
    const c = fixtureCatalog;
    assert.equal(c.cpus.length, 8);
    assert.equal(c.gpu_families.length, 8);
    for (const f of c.gpu_families) assert.equal(c.gpu_variants.filter((x) => x.family_id === f.id).length, 2, f.id);
    for (const k of ["motherboards", "memory", "psus", "cases", "coolers", "storage"] as const) assert.equal(c[k].length, 4, k);
  });

  it("include every edge case", () => {
    const c = fixtureCatalog;
    const gpu = (id: string) => c.gpu_variants.find((x) => x.id === id)!;
    const { oversized_gpu, memory_mismatch, underpowered_psu, missing_price } = EDGE_CASES;

    const pcCase = c.cases.find((x) => x.id === oversized_gpu.case)!;
    assert.ok(gpu(oversized_gpu.gpu).length_mm! > pcCase.max_gpu_length_mm!);

    const kit = c.memory.find((x) => x.id === memory_mismatch.memory)!;
    const board = c.motherboards.find((x) => x.id === memory_mismatch.motherboard)!;
    assert.notEqual(kit.memory_type, board.memory_type);

    const supply = c.psus.find((x) => x.id === underpowered_psu.psu)!;
    assert.ok(supply.wattage_w < gpu(underpowered_psu.gpu).recommended_psu_w!);

    assert.ok(gpu(missing_price));
    assert.ok(!c.prices.some((p) => p.product_id === missing_price));
  });

  it("use the reference parts for normalized scores", () => {
    const ref = fixtureCatalog.cpus.find((x) => x.id === "ryzen-5-5600x")!;
    assert.equal(ref.perf.single, 100);
    assert.equal(ref.perf.multi, 100);
    assert.equal(fixtureCatalog.gpu_families.find((x) => x.id === "rtx-3060-12gb")!.perf.rt, 100);
  });

  it("requests pass validation", () => {
    for (const [name, request] of Object.entries(requests)) assert.deepEqual(messages(validate(v.userRequest, request)), [], name);
  });
});

describe("entity validators", () => {
  const cpu = fixtureCatalog.cpus[0];

  it("reject a wrong type, naming the path", () => {
    const issues = validate(v.cpu, { ...cpu, cores: "six" });
    assert.deepEqual(messages(issues), ['$.cores: expected a number, got string']);
  });

  it("reject a missing key (null must be explicit)", () => {
    const { tdp_w: _, ...rest } = cpu;
    assert.match(messages(validate(v.cpu, rest)).join(), /\$\.tdp_w: expected a number, got undefined/);
  });

  it("accept null for nullable fields", () => {
    assert.deepEqual(validate(v.cpu, { ...cpu, tdp_w: null, perf: { ...cpu.perf, gaming_fps: null } }), []);
  });

  it("reject unknown keys", () => {
    assert.deepEqual(messages(validate(v.cpu, { ...cpu, tdp: 65 })), ["$.tdp: unexpected key"]);
  });

  it("reject values outside an enum", () => {
    assert.match(messages(validate(v.cpu, { ...cpu, socket: "AM6" })).join(), /\$\.socket: expected one of AM4, AM5/);
  });

  it("reject non-positive numbers", () => {
    assert.equal(validate(v.cpu, { ...cpu, tdp_w: 0 }).length, 1);
    assert.equal(validate(v.price, { ...fixtureCatalog.prices[0], price_usd: -5 }).length, 1);
  });

  it("reject IDs that aren't model slugs", () => {
    assert.equal(validate(v.cpu, { ...cpu, id: "Ryzen 5 5600X" }).length, 1);
  });

  it("validate cooler variants by type", () => {
    const aio = fixtureCatalog.coolers.find((c) => c.type === "aio")!;
    assert.deepEqual(validate(v.cooler, aio), []);
    assert.match(messages(validate(v.cooler, { ...aio, type: "air" })).join(), /radiator_mm: unexpected key/);
    assert.match(messages(validate(v.cooler, { ...aio, type: "water" })).join(), /\$\.type: expected one of air, aio/);
  });

  it("validate connector counts", () => {
    const psu = fixtureCatalog.psus[0];
    assert.equal(validate(v.psu, { ...psu, connectors: { pcie_8pin: 2, molex: 1 } }).length, 1);
    assert.equal(validate(v.psu, { ...psu, connectors: { pcie_8pin: 1.5 } }).length, 1);
  });

  it("validate a board's CPU list as 'socket' or IDs", () => {
    const board = fixtureCatalog.motherboards[0];
    assert.deepEqual(validate(v.motherboard, { ...board, supported_cpu_ids: "socket" }), []);
    assert.equal(validate(v.motherboard, { ...board, supported_cpu_ids: "all" }).length, 1);
  });

  it("check prices' dates", () => {
    assert.equal(validate(v.price, { ...fixtureCatalog.prices[0], last_checked: "11/20/2026" }).length, 1);
    assert.equal(validate(v.price, { ...fixtureCatalog.prices[0], last_checked: "2026-13-45" }).length, 1);
  });

  it("require at least one reason per recommendation", () => {
    const rec: Recommendation = {
      category: "best_fit", mode: "upgrade",
      parts: [{ component: "gpu", part_id: "rtx-5070--msi-ventus-2x-oc", price_usd: 839, retailer: "Newegg", last_checked: "2026-11-20", replaces: "RTX 3060" }],
      total_cost_usd: 839,
      perf_estimate: { gaming: { resolution: "1440p", fps: 106, cpu_cap_fps: 140, gpu_cap_fps: 106, limited_by: "gpu" }, single: 100, multi: 100 },
      gain_pct: 121,
      reasons: [{ type: "performance_gain", component: "gpu", metric: "gaming_fps", old_value: 48, new_value: 106, percent_gain: 121 }],
      warnings: [{ type: "missing_info", component: "psu", field: "wattage_w" }],
    };
    assert.deepEqual(messages(validate(v.recommendation, rec)), []);
    assert.match(messages(validate(v.recommendation, { ...rec, reasons: [] })).join(), /reasons: expected at least one item/);
    assert.equal(validate(v.recommendation, { ...rec, reasons: [{ type: "vibes" }] }).length, 1);
  });

  it("assertValid throws with every issue listed", () => {
    assert.throws(() => assertValid(v.cpu, { ...cpu, cores: -1, threads: "x" }, "cpus[0]"), /cpus\[0\]\.cores[\s\S]*cpus\[0\]\.threads/);
  });
});

describe("validateCatalog links", () => {
  it("rejects a missing file", () => {
    const { prices: _, ...rest } = copy();
    assert.match(messages(v.validateCatalog(rest)).join(), /prices: expected an array/);
  });

  it("rejects duplicate IDs across files", () => {
    const c = copy();
    c.psus[0].id = c.cpus[0].id;
    assert.match(messages(v.validateCatalog(c)).join(), /psus\[0\]\.id: duplicate ID "ryzen-5-5600x" \(first at cpus\[0\]\.id\)/);
  });

  it("rejects a variant whose family doesn't exist", () => {
    const c = copy();
    c.gpu_variants[0].family_id = "rtx-9999";
    assert.match(messages(v.validateCatalog(c)).join(), /no GPU family "rtx-9999"/);
  });

  it("rejects a board listing a missing CPU or one on another socket", () => {
    const c = copy();
    c.motherboards[0].supported_cpu_ids = ["ryzen-5-7600", "ryzen-9-9999"];
    const out = messages(v.validateCatalog(c)).join("\n");
    assert.match(out, /CPU "ryzen-5-7600" is AM5; board is AM4/);
    assert.match(out, /no CPU "ryzen-9-9999"/);
  });

  it("rejects a price for an unknown part or a GPU family", () => {
    const c = copy();
    c.prices[0].product_id = "rtx-5070";
    c.prices[1].product_id = "nothing-here";
    const out = messages(v.validateCatalog(c)).join("\n");
    assert.match(out, /prices\[0\][^\n]*GPU family; price a variant instead/);
    assert.match(out, /prices\[1\][^\n]*no purchasable part "nothing-here"/);
  });
});

describe("ids", () => {
  it("slugify", () => {
    assert.equal(slugify("MSI Ventus 2X OC"), "msi-ventus-2x-oc");
    assert.equal(slugify("  G.Skill Flare X5 (2x16GB) "), "g-skill-flare-x5-2x16gb");
    assert.equal(slugify("80+ Gold"), "80-plus-gold");
    assert.equal(slugify("Radeon™ RX 9070 XT"), "radeon-rx-9070-xt");
  });

  it("variantId joins family and board with --", () => {
    assert.equal(variantId("rtx-5070", "MSI Ventus 2X OC"), "rtx-5070--msi-ventus-2x-oc");
    assert.ok(isId(variantId("rtx-5070", "MSI Ventus 2X OC")));
  });

  it("isId", () => {
    for (const ok of ["ryzen-5-7600", "rtx-4070--asus-dual", "b580"]) assert.ok(isId(ok), ok);
    for (const bad of ["RTX-4070", "rtx 4070", "-rtx", "rtx-", "a--b--c", "a---b", ""]) assert.ok(!isId(bad), bad);
  });
});
