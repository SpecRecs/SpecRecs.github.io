// M2 acceptance: every rule has a pass and a fail test, missing data gives "unknown", and the
// fixture edge cases produce exactly the expected violation.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDGE_CASES, fixtureCatalog as catalog } from "../../fixtures/catalog.ts";
import { allocateConnectors, checkBuild, DEFAULT_CONFIG, evaluate, gpuFitsCase, overall, psuPowers, requiredPsuW } from "../../src/compatibility/index.ts";
import type { BuildParts, RuleId, RuleResult } from "../../src/types/compatibility.ts";
import type { Case, Cooler, Cpu, GpuVariant, Memory, Motherboard, Psu, Storage } from "../../src/types/parts.ts";
import { RULE_IDS } from "../../src/types/compatibility.ts";
import type { Check } from "../../src/types/validate.ts";
import { isValid } from "../../src/types/validate.ts";
import * as v from "../../src/types/validators.ts";

const find = <T extends { id: string }>(list: T[], id: string): T => {
  const x = list.find((p) => p.id === id);
  assert.ok(x, `fixture ${id}`);
  return structuredClone(x);
};
const cpu = (id: string) => find<Cpu>(catalog.cpus, id);
const gpu = (id: string) => find<GpuVariant>(catalog.gpu_variants, id);
const board = (id: string) => find<Motherboard>(catalog.motherboards, id);
const kit = (id: string) => find<Memory>(catalog.memory, id);
const psu = (id: string) => find<Psu>(catalog.psus, id);
const pcCase = (id: string) => find<Case>(catalog.cases, id);
const cooler = (id: string) => find<Cooler>(catalog.coolers, id);
const drive = (id: string) => find<Storage>(catalog.storage, id);

const ruleOf = (parts: BuildParts, rule: RuleId): RuleResult | undefined => evaluate(parts).find((r) => r.rule === rule);
const status = (parts: BuildParts, rule: RuleId) => ruleOf(parts, rule)?.status ?? "n/a";

// A complete build that passes every rule with no unknowns.
const goodBuild = (): Required<BuildParts> => ({
  cpu: cpu("ryzen-5-7600"),
  motherboard: board("gigabyte-b650-aorus-elite-ax"),
  memory: kit("gskill-flare-x5-32gb-ddr5-6000"),
  gpu: gpu("rx-9070-xt--powercolor-reaper"),
  psu: psu("corsair-rm850e"),
  case: pcCase("fractal-design-north"),
  cooler: cooler("thermalright-peerless-assassin-120-se"),
  storage: [drive("samsung-990-pro-2tb")],
});

describe("checkBuild", () => {
  it("passes a good build with every rule checked", () => {
    const report = checkBuild(goodBuild());
    assert.deepEqual(report, { valid: true, violations: [], unknown: [], notes: [] });
    // Everything but radiator_fit (air cooler) applies.
    assert.deepEqual(evaluate(goodBuild()).map((r) => r.rule), RULE_IDS.filter((r) => r !== "radiator_fit"));
  });

  it("checks only the rules whose parts are present", () => {
    assert.deepEqual(checkBuild({}), { valid: true, violations: [], unknown: [], notes: [] });
    assert.deepEqual(evaluate({ gpu: gpu("rtx-5070--msi-ventus-2x-oc") }), []);
  });

  it("doesn't mutate its input", () => {
    const build = goodBuild();
    const before = structuredClone(build);
    checkBuild(build);
    assert.deepEqual(build, before);
  });

  it("unknown results don't invalidate a build", () => {
    const report = checkBuild({ ...goodBuild(), gpu: gpu(EDGE_CASES.unknown_gpu_length) });
    assert.equal(report.valid, true);
    assert.deepEqual(report.unknown.map((r) => r.rule), ["gpu_length"]);
  });
});

describe("fixture edge cases: exactly one violation each", () => {
  const only = (parts: BuildParts, rule: RuleId) => {
    const report = checkBuild(parts);
    assert.equal(report.valid, false);
    assert.deepEqual(report.violations.map((v) => v.rule), [rule]);
    return report.violations[0];
  };

  it("oversized GPU", () => {
    const { gpu: g, case: c } = EDGE_CASES.oversized_gpu;
    const v = only({ gpu: gpu(g), case: pcCase(c) }, "gpu_length");
    assert.equal(v.detail, "GPU is 358 mm; case fits 330 mm");
    assert.deepEqual(v.components, ["gpu", "case"]);
  });

  it("DDR4/DDR5 mismatch", () => {
    const { memory: m, motherboard: b } = EDGE_CASES.memory_mismatch;
    assert.equal(only({ memory: kit(m), motherboard: board(b) }, "memory_type").detail, "kit is DDR4; board takes DDR5");
  });

  it("underpowered PSU", () => {
    const { psu: p, gpu: g } = EDGE_CASES.underpowered_psu;
    assert.equal(only({ psu: psu(p), gpu: gpu(g) }, "psu_wattage").detail, "450 W PSU; build needs 650 W");
  });
});

describe("rules", () => {
  it("socket", () => {
    assert.equal(status({ cpu: cpu("ryzen-5-7600"), motherboard: board("gigabyte-b650-aorus-elite-ax") }, "socket"), "pass");
    assert.equal(status({ cpu: cpu("ryzen-5-5600x"), motherboard: board("gigabyte-b650-aorus-elite-ax") }, "socket"), "fail");
  });

  it("cpu_board_support", () => {
    const b550 = board("msi-mag-b550-tomahawk");
    assert.equal(status({ cpu: cpu("ryzen-5-5600x"), motherboard: b550 }, "cpu_board_support"), "pass"); // listed
    assert.equal(status({ cpu: cpu("ryzen-5-7600"), motherboard: board("gigabyte-b650-aorus-elite-ax") }, "cpu_board_support"), "pass"); // "socket"
    assert.equal(status({ cpu: cpu("ryzen-5-5600x"), motherboard: { ...b550, supported_cpu_ids: ["ryzen-7-5700x3d"] } }, "cpu_board_support"), "fail");
    assert.equal(status({ cpu: cpu("core-i5-12400f"), motherboard: board(EDGE_CASES.uncurated_cpu_support) }, "cpu_board_support"), "unknown");
    // Skipped on a socket mismatch, which already fails.
    assert.equal(status({ cpu: cpu("ryzen-5-7600"), motherboard: b550 }, "cpu_board_support"), "n/a");
  });

  it("memory_type", () => {
    const ddr4Board = board("msi-pro-b760m-a-ddr4");
    assert.equal(status({ memory: kit("corsair-vengeance-lpx-32gb-ddr4-3600"), motherboard: ddr4Board }, "memory_type"), "pass");
    assert.equal(status({ memory: kit("gskill-flare-x5-32gb-ddr5-6000"), motherboard: ddr4Board }, "memory_type"), "fail");
    // The CPU must support the board's type.
    assert.equal(status({ cpu: cpu("core-i5-12400f"), motherboard: ddr4Board }, "memory_type"), "pass");
    assert.equal(status({ cpu: { ...cpu("core-i5-12400f"), memory_types: ["DDR5"] }, motherboard: ddr4Board }, "memory_type"), "fail");
    // Without a board, the CPU must support the kit.
    assert.equal(status({ cpu: cpu("ryzen-5-5600x"), memory: kit("gskill-flare-x5-32gb-ddr5-6000") }, "memory_type"), "fail");
    assert.equal(status({ memory: kit("gskill-flare-x5-32gb-ddr5-6000") }, "memory_type"), "n/a");
  });

  it("memory_slots", () => {
    const itx = board("asus-rog-strix-b650e-i");
    assert.equal(status({ memory: kit("gskill-flare-x5-32gb-ddr5-6000"), motherboard: itx }, "memory_slots"), "pass");
    assert.equal(status({ memory: kit("kingston-fury-beast-rgb-64gb-ddr5-6000"), motherboard: itx }, "memory_slots"), "fail");
  });

  it("board_case_form_factor", () => {
    const nr200p = pcCase("cooler-master-nr200p");
    assert.equal(status({ motherboard: board("asus-rog-strix-b650e-i"), case: nr200p }, "board_case_form_factor"), "pass");
    assert.equal(status({ motherboard: board("msi-mag-b550-tomahawk"), case: nr200p }, "board_case_form_factor"), "fail");
  });

  it("gpu_length", () => {
    const north = pcCase("fractal-design-north");
    assert.equal(overall(gpuFitsCase(gpu("rtx-5070--msi-ventus-2x-oc"), north)), "pass");
    assert.equal(overall(gpuFitsCase(gpu("rtx-5090--asus-rog-astral"), north)), "fail"); // 358 > 355
    assert.equal(overall(gpuFitsCase(gpu(EDGE_CASES.unknown_gpu_length), north)), "unknown");
    assert.equal(overall(gpuFitsCase(gpu("rtx-5070--msi-ventus-2x-oc"), { ...north, max_gpu_length_mm: null })), "unknown");
  });

  it("cooler_socket", () => {
    const lowProfile = cooler("noctua-nh-l9a-am5");
    assert.equal(status({ cooler: lowProfile, cpu: cpu("ryzen-5-7600") }, "cooler_socket"), "pass");
    assert.equal(status({ cooler: lowProfile, cpu: cpu("ryzen-5-5600x") }, "cooler_socket"), "fail");
    // Falls back to the board's socket.
    assert.equal(status({ cooler: lowProfile, motherboard: board("msi-mag-b550-tomahawk") }, "cooler_socket"), "fail");
  });

  it("cooler_height", () => {
    const nr200p = pcCase("cooler-master-nr200p"); // 155 mm
    assert.equal(status({ cooler: cooler("thermalright-peerless-assassin-120-se"), case: nr200p }, "cooler_height"), "pass"); // exactly 155
    assert.equal(status({ cooler: cooler("cooler-master-hyper-212"), case: nr200p }, "cooler_height"), "fail"); // 159
    const air = cooler("cooler-master-hyper-212");
    assert.equal(status({ cooler: { ...air, height_mm: null } as Cooler, case: nr200p }, "cooler_height"), "unknown");
    assert.equal(status({ cooler: cooler("arctic-liquid-freezer-iii-360"), case: nr200p }, "cooler_height"), "n/a"); // AIO
  });

  it("radiator_fit", () => {
    const aio = cooler("arctic-liquid-freezer-iii-360");
    assert.equal(status({ cooler: aio, case: pcCase("fractal-design-north") }, "radiator_fit"), "pass");
    assert.equal(status({ cooler: aio, case: pcCase("cooler-master-nr200p") }, "radiator_fit"), "fail");
    assert.equal(status({ cooler: aio, case: { ...pcCase("fractal-design-north"), radiator_mm_supported: null } }, "radiator_fit"), "unknown");
    assert.equal(status({ cooler: aio, case: { ...pcCase("fractal-design-north"), radiator_mm_supported: [] } }, "radiator_fit"), "fail");
  });

  it("psu_wattage", () => {
    const p = psu("corsair-rm850e");
    assert.equal(overall(psuPowers(p, { gpu: gpu("rtx-5070-ti--asus-prime-oc") })), "pass");
    assert.equal(overall(psuPowers(psu("corsair-cx450"), { gpu: gpu("rtx-5070-ti--asus-prime-oc") }).filter((r) => r.rule === "psu_wattage")), "fail");
    // Unknown power can only raise the requirement: a known shortfall still fails, a pass becomes unknown.
    assert.equal(status({ psu: p, cpu: { ...cpu("ryzen-5-7600"), tdp_w: null }, gpu: gpu("rtx-5070-ti--asus-prime-oc") }, "psu_wattage"), "unknown");
    assert.equal(status({ psu: psu("corsair-cx450"), gpu: { ...gpu("rtx-5070-ti--asus-prime-oc"), tdp_w: null } }, "psu_wattage"), "fail");
    // Without a CPU or GPU there's nothing to size against.
    assert.equal(status({ psu: p, case: pcCase("fractal-design-north") }, "psu_wattage"), "n/a");
  });

  it("psu_wattage uses the larger of estimated draw and the GPU's recommendation", () => {
    // 75 base + 120 CPU + 600 GPU = 795 W × 1.3 = 1034 W, above the card's 1000 W recommendation.
    const need = requiredPsuW({ cpu: cpu("ryzen-7-9800x3d"), gpu: gpu("rtx-5090--asus-rog-astral") }, DEFAULT_CONFIG);
    assert.deepEqual(need, { min_w: 1034, complete: true, missing: [] });
    assert.equal(status({ psu: psu("msi-mag-a1000gl"), cpu: cpu("ryzen-7-9800x3d"), gpu: gpu("rtx-5090--asus-rog-astral") }, "psu_wattage"), "fail");
    // The recommendation wins for a lighter build: 75 + 65 + 250 = 390 × 1.3 = 507 < 650.
    assert.equal(requiredPsuW({ cpu: cpu("ryzen-5-7600"), gpu: gpu("rtx-5070--msi-ventus-2x-oc") }, DEFAULT_CONFIG).min_w, 650);
  });

  it("psu_connectors", () => {
    const sf750 = psu("corsair-sf750"); // 4× 8-pin, no 12V-2x6
    assert.equal(status({ psu: sf750, gpu: gpu("rx-9070-xt--powercolor-reaper") }, "psu_connectors"), "pass"); // 2× 8-pin
    // 12V-2x6 through the adapter: a 300 W card takes two 8-pins, a 575 W card four.
    assert.equal(status({ psu: sf750, gpu: gpu("rtx-5070-ti--asus-prime-oc") }, "psu_connectors"), "pass");
    assert.equal(status({ psu: sf750, gpu: gpu("rtx-5090--founders-edition") }, "psu_connectors"), "pass");
    assert.equal(status({ psu: psu("corsair-cx450"), gpu: gpu("rtx-5090--founders-edition") }, "psu_connectors"), "fail"); // 2 < 4
    assert.equal(status({ psu: { ...sf750, connectors: { pcie_8pin: 1 } }, gpu: gpu("rx-9070-xt--powercolor-reaper") }, "psu_connectors"), "fail");
    assert.equal(status({ psu: { ...sf750, connectors: null }, gpu: gpu("rx-9070-xt--powercolor-reaper") }, "psu_connectors"), "unknown");
    assert.equal(status({ psu: sf750, gpu: { ...gpu("rx-9070-xt--powercolor-reaper"), power_connectors: null } }, "psu_connectors"), "unknown");
    // An adapter whose 8-pin count depends on unknown GPU power.
    assert.equal(status({ psu: sf750, gpu: { ...gpu("rtx-5070-ti--asus-prime-oc"), tdp_w: null } }, "psu_connectors"), "unknown");
  });

  it("allocateConnectors: 6-pin sockets take 6-pin cables, then spare 6+2s", () => {
    assert.ok(allocateConnectors({ pcie_6pin: 2 }, { pcie_6pin: 1, pcie_8pin: 1 }, 150).ok);
    assert.ok(!allocateConnectors({ pcie_6pin: 1, pcie_8pin: 1 }, { pcie_8pin: 1 }, 225).ok);
    assert.ok(allocateConnectors({ "12v_2x6": 1 }, { "12v_2x6": 1 }, 575).ok);
    assert.equal(allocateConnectors({ "12v_2x6": 1 }, { "12v_2x6": 1 }, 575).adapter, false);
  });

  it("psu_form_factor", () => {
    const nr200p = pcCase("cooler-master-nr200p");
    assert.equal(status({ psu: psu("corsair-sf750"), case: nr200p }, "psu_form_factor"), "pass");
    assert.equal(status({ psu: psu("corsair-rm850e"), case: nr200p }, "psu_form_factor"), "fail");
  });

  it("m2_slots", () => {
    const b = board("gigabyte-b650-aorus-elite-ax"); // 2 slots
    const nvme = [drive("samsung-990-pro-2tb"), drive("wd-black-sn850x-1tb")];
    assert.equal(status({ motherboard: b, storage: nvme }, "m2_slots"), "pass");
    assert.equal(status({ motherboard: b, storage: [...nvme, drive("crucial-p3-plus-1tb")] }, "m2_slots"), "fail");
    // SATA drives don't use M.2 slots.
    assert.equal(status({ motherboard: b, storage: [...nvme, drive("samsung-870-evo-1tb")] }, "m2_slots"), "pass");
    assert.equal(status({ motherboard: b, storage: [drive("samsung-870-evo-1tb")] }, "m2_slots"), "n/a");
    assert.equal(status({ motherboard: { ...b, m2_slots: null }, storage: nvme }, "m2_slots"), "unknown");
  });
});

describe("missing data is never a pass", () => {
  // Null out each nullable field of the good build in turn. Removing data must never create a
  // failure, and fields a rule depends on must turn that rule "unknown".
  const DEPENDS: Partial<Record<keyof BuildParts, Record<string, RuleId>>> = {
    cpu: { tdp_w: "psu_wattage" },
    motherboard: { m2_slots: "m2_slots", supported_cpu_ids: "cpu_board_support" },
    gpu: { length_mm: "gpu_length", tdp_w: "psu_wattage", power_connectors: "psu_connectors" },
    psu: { connectors: "psu_connectors" },
    case: { max_gpu_length_mm: "gpu_length", max_cooler_height_mm: "cooler_height" },
    cooler: { height_mm: "cooler_height" },
  };

  const VALIDATOR: Record<string, Check<unknown>> = {
    cpu: v.cpu, motherboard: v.motherboard, memory: v.memory, gpu: v.gpuVariant, psu: v.psu, case: v.pcCase, cooler: v.cooler,
  };
  const build = goodBuild();
  for (const key of ["cpu", "motherboard", "memory", "gpu", "psu", "case", "cooler"] as const) {
    const part = build[key] as unknown as Record<string, unknown>;
    // Only fields the validators allow to be null; required ones can't be missing in valid data.
    const nullable = Object.keys(part).filter((f) => isValid(VALIDATOR[key], { ...part, [f]: null }));
    for (const field of nullable) {
      it(`${key}.${field} = null`, () => {
        const report = checkBuild({ ...goodBuild(), [key]: { ...part, [field]: null } } as BuildParts);
        const rule = DEPENDS[key]?.[field];
        assert.deepEqual(report.violations, []);
        assert.deepEqual(report.unknown.map((r) => r.rule), rule ? [rule] : []);
      });
    }
  }

  it("covers every nullable field a rule reads", () => {
    for (const [key, fields] of Object.entries(DEPENDS)) {
      const part = goodBuild()[key as keyof BuildParts] as unknown as Record<string, unknown>;
      for (const f of Object.keys(fields!)) assert.ok(isValid(VALIDATOR[key], { ...part, [f]: null }), `${key}.${f} is nullable`);
    }
  });
});

describe("notes", () => {
  const codes = (parts: BuildParts) => checkBuild(parts).notes.map((n) => n.code);

  it("psu_headroom_low when the PSU is within 10% of the requirement", () => {
    // RTX 5070 Ti recommends 750 W; the SF750 is exactly 750.
    assert.deepEqual(codes({ psu: psu("corsair-sf750"), gpu: gpu("rtx-5070-ti--asus-prime-oc") }), ["psu_headroom_low", "uses_power_adapter"]);
    assert.deepEqual(codes({ psu: psu("corsair-rm850e"), gpu: gpu("rtx-5070-ti--asus-prime-oc") }), []);
  });

  it("cooler_tdp_low and no_wifi", () => {
    assert.deepEqual(codes({ cooler: cooler("noctua-nh-l9a-am5"), cpu: cpu("ryzen-7-9800x3d") }), ["cooler_tdp_low"]);
    assert.deepEqual(codes({ motherboard: board("msi-mag-b550-tomahawk") }), ["no_wifi"]);
  });

  it("never affect validity", () => {
    const report = checkBuild({ ...goodBuild(), cpu: cpu("ryzen-7-9800x3d"), cooler: cooler("noctua-nh-l9a-am5") });
    assert.equal(report.valid, true);
    assert.deepEqual(report.notes.map((n) => n.code), ["cooler_tdp_low"]);
  });
});
