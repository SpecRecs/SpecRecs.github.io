// One function per hard rule (RuleId). Each returns null when the build lacks a part the rule needs,
// and "unknown" (never "pass") when a needed field is null. Pure functions, no I/O.
import type { ConnectorCounts, PartCategory } from "../types/common.ts";
import type { BuildParts, CompatibilityConfig, CompatibilityNote, RuleId, RuleResult } from "../types/compatibility.ts";
import { requiredPsuW } from "./power.ts";

type Rule = (parts: BuildParts, config: CompatibilityConfig) => RuleResult | null;

const pass = (rule: RuleId, components: PartCategory[], detail: string): RuleResult => ({ rule, status: "pass", components, detail });
const fail = (rule: RuleId, components: PartCategory[], detail: string): RuleResult => ({ rule, status: "fail", components, detail });
const unknown = (rule: RuleId, components: PartCategory[], detail: string): RuleResult => ({ rule, status: "unknown", components, detail });

const socket: Rule = ({ cpu, motherboard }) => {
  if (!cpu || !motherboard) return null;
  const c: PartCategory[] = ["cpu", "motherboard"];
  return cpu.socket === motherboard.socket
    ? pass("socket", c, `CPU and board are both ${cpu.socket}`)
    : fail("socket", c, `CPU is ${cpu.socket}; board is ${motherboard.socket}`);
};

// Only checked when the sockets match; a socket mismatch is already a failure.
const cpuBoardSupport: Rule = ({ cpu, motherboard }) => {
  if (!cpu || !motherboard || cpu.socket !== motherboard.socket) return null;
  const c: PartCategory[] = ["cpu", "motherboard"];
  const list = motherboard.supported_cpu_ids;
  if (list === null) return unknown("cpu_board_support", c, `${motherboard.name} has no curated CPU support list`);
  if (list === "socket" || list.includes(cpu.id)) return pass("cpu_board_support", c, `${motherboard.name} supports ${cpu.name}`);
  return fail("cpu_board_support", c, `${motherboard.name} doesn't list ${cpu.name}`);
};

// The kit must match the board, and the CPU must support the board's memory type. Without a board,
// the CPU must support the kit's type.
const memoryType: Rule = ({ cpu, motherboard, memory }) => {
  const type = motherboard?.memory_type ?? memory?.memory_type;
  const present = [cpu && "cpu", motherboard && "motherboard", memory && "memory"].filter(Boolean) as PartCategory[];
  if (!type || present.length < 2) return null;
  if (motherboard && memory && memory.memory_type !== motherboard.memory_type) {
    return fail("memory_type", ["motherboard", "memory"], `kit is ${memory.memory_type}; board takes ${motherboard.memory_type}`);
  }
  if (cpu && !cpu.memory_types.includes(type)) {
    return fail("memory_type", present, `${cpu.name} supports ${cpu.memory_types.join("/")}, not ${type}`);
  }
  return pass("memory_type", present, `all ${type}`);
};

const memorySlots: Rule = ({ motherboard, memory }) => {
  if (!motherboard || !memory) return null;
  const c: PartCategory[] = ["motherboard", "memory"];
  return memory.module_count <= motherboard.memory_slots
    ? pass("memory_slots", c, `${memory.module_count} modules, ${motherboard.memory_slots} slots`)
    : fail("memory_slots", c, `kit has ${memory.module_count} modules; board has ${motherboard.memory_slots} slots`);
};

const boardCaseFormFactor: Rule = ({ motherboard, case: pcCase }) => {
  if (!motherboard || !pcCase) return null;
  const c: PartCategory[] = ["motherboard", "case"];
  return pcCase.supported_mb_form_factors.includes(motherboard.form_factor)
    ? pass("board_case_form_factor", c, `case fits ${motherboard.form_factor}`)
    : fail("board_case_form_factor", c, `${motherboard.form_factor} board; case fits ${pcCase.supported_mb_form_factors.join(", ")}`);
};

// Shared shape of the "part size <= case limit" rules.
function fits(rule: RuleId, components: PartCategory[], what: string, size: number | null, limit: number | null): RuleResult {
  if (size === null) return unknown(rule, components, `${what} size unknown`);
  if (limit === null) return unknown(rule, components, `case limit for ${what} unknown`);
  return size <= limit
    ? pass(rule, components, `${what} is ${size} mm; case fits ${limit} mm`)
    : fail(rule, components, `${what} is ${size} mm; case fits ${limit} mm`);
}

const gpuLength: Rule = ({ gpu, case: pcCase }) =>
  gpu && pcCase ? fits("gpu_length", ["gpu", "case"], "GPU", gpu.length_mm, pcCase.max_gpu_length_mm) : null;

// Uses the CPU's socket, or the board's when there's no CPU.
const coolerSocket: Rule = ({ cooler, cpu, motherboard }) => {
  const s = cpu?.socket ?? motherboard?.socket;
  if (!cooler || !s) return null;
  const c: PartCategory[] = ["cooler", cpu ? "cpu" : "motherboard"];
  return cooler.supported_sockets.includes(s)
    ? pass("cooler_socket", c, `cooler supports ${s}`)
    : fail("cooler_socket", c, `cooler supports ${cooler.supported_sockets.join(", ")}, not ${s}`);
};

const coolerHeight: Rule = ({ cooler, case: pcCase }) =>
  cooler?.type === "air" && pcCase ? fits("cooler_height", ["cooler", "case"], "cooler", cooler.height_mm, pcCase.max_cooler_height_mm) : null;

const radiatorFit: Rule = ({ cooler, case: pcCase }) => {
  if (cooler?.type !== "aio" || !pcCase) return null;
  const c: PartCategory[] = ["cooler", "case"];
  const sizes = pcCase.radiator_mm_supported;
  if (sizes === null) return unknown("radiator_fit", c, "case radiator support unknown");
  return sizes.includes(cooler.radiator_mm)
    ? pass("radiator_fit", c, `case mounts a ${cooler.radiator_mm} mm radiator`)
    : fail("radiator_fit", c, `${cooler.radiator_mm} mm radiator; case mounts ${sizes.length ? sizes.join(", ") + " mm" : "none"}`);
};

const psuWattage: Rule = (parts, config) => {
  const { psu, cpu, gpu } = parts;
  if (!psu || (!cpu && !gpu)) return null;
  const c = ["psu", ...(cpu ? ["cpu"] : []), ...(gpu ? ["gpu"] : [])] as PartCategory[];
  const need = requiredPsuW(parts, config);
  // A known minimum the PSU misses is a failure even when the full estimate is incomplete.
  if (psu.wattage_w < need.min_w) return fail("psu_wattage", c, `${psu.wattage_w} W PSU; build needs ${need.min_w} W`);
  if (!need.complete) return unknown("psu_wattage", c, `power draw unknown (missing ${need.missing.join(", ")})`);
  return pass("psu_wattage", c, `${psu.wattage_w} W PSU; build needs ${need.min_w} W`);
};

// Whether a PSU's cables cover a GPU's sockets. A 12V-2x6 socket without a native cable is fed from
// 8-pin cables through the card's adapter, one per 150 W of GPU power (at least two). A 6-pin
// socket takes a 6-pin cable or a spare 6+2.
export function allocateConnectors(needs: ConnectorCounts, has: ConnectorCounts, gpuTdpW: number | null) {
  const hvShort = Math.max(0, (needs["12v_2x6"] ?? 0) - (has["12v_2x6"] ?? 0));
  const perAdapter = gpuTdpW === null ? null : Math.max(2, Math.ceil(gpuTdpW / 150));
  const sixShort = Math.max(0, (needs.pcie_6pin ?? 0) - (has.pcie_6pin ?? 0));
  const eightNeeded = (needs.pcie_8pin ?? 0) + hvShort * (perAdapter ?? 0) + sixShort;
  return {
    ok: (has.pcie_8pin ?? 0) >= eightNeeded,
    adapter: hvShort > 0,
    // false when an adapter is needed but GPU power is unknown, so its 8-pin count is too
    known: hvShort === 0 || perAdapter !== null,
  };
}

const psuConnectors: Rule = ({ psu, gpu }) => {
  if (!psu || !gpu) return null;
  const c: PartCategory[] = ["psu", "gpu"];
  if (gpu.power_connectors === null) return unknown("psu_connectors", c, "GPU power connectors unknown");
  if (psu.connectors === null) return unknown("psu_connectors", c, "PSU connectors unknown");
  const a = allocateConnectors(gpu.power_connectors, psu.connectors, gpu.tdp_w);
  if (!a.known) return unknown("psu_connectors", c, "needs a 12V-2x6 adapter; GPU power unknown, so the 8-pin count is too");
  const want = describeConnectors(gpu.power_connectors);
  const have = describeConnectors(psu.connectors);
  return a.ok ? pass("psu_connectors", c, `GPU needs ${want}; PSU has ${have}`) : fail("psu_connectors", c, `GPU needs ${want}; PSU has ${have}`);
};

function describeConnectors(counts: ConnectorCounts): string {
  const parts = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${n}× ${k}`);
  return parts.length ? parts.join(", ") : "none";
}

const psuFormFactor: Rule = ({ psu, case: pcCase }) => {
  if (!psu || !pcCase) return null;
  const c: PartCategory[] = ["psu", "case"];
  return pcCase.supported_psu_form_factors.includes(psu.form_factor)
    ? pass("psu_form_factor", c, `case fits ${psu.form_factor}`)
    : fail("psu_form_factor", c, `${psu.form_factor} PSU; case fits ${pcCase.supported_psu_form_factors.join(", ")}`);
};

const m2Slots: Rule = ({ motherboard, storage }) => {
  const m2 = storage?.filter((s) => s.form_factor === "M.2-2280").length ?? 0;
  if (!motherboard || m2 === 0) return null;
  const c: PartCategory[] = ["motherboard", "storage"];
  if (motherboard.m2_slots === null) return unknown("m2_slots", c, "board M.2 slot count unknown");
  return m2 <= motherboard.m2_slots
    ? pass("m2_slots", c, `${m2} M.2 drives, ${motherboard.m2_slots} slots`)
    : fail("m2_slots", c, `${m2} M.2 drives; board has ${motherboard.m2_slots} slots`);
};

export const RULES: Record<RuleId, Rule> = {
  socket,
  cpu_board_support: cpuBoardSupport,
  memory_type: memoryType,
  memory_slots: memorySlots,
  board_case_form_factor: boardCaseFormFactor,
  gpu_length: gpuLength,
  cooler_socket: coolerSocket,
  cooler_height: coolerHeight,
  radiator_fit: radiatorFit,
  psu_wattage: psuWattage,
  psu_connectors: psuConnectors,
  psu_form_factor: psuFormFactor,
  m2_slots: m2Slots,
};

// Soft findings. They never fail a build.
export function softNotes(parts: BuildParts, config: CompatibilityConfig): CompatibilityNote[] {
  const notes: CompatibilityNote[] = [];
  const { psu, cpu, gpu, cooler, motherboard } = parts;

  const need = psu && (cpu || gpu) ? requiredPsuW(parts, config) : null;
  if (psu && need?.complete && psu.wattage_w >= need.min_w && psu.wattage_w < need.min_w * (1 + config.psu_note_margin)) {
    notes.push({ code: "psu_headroom_low", components: ["psu"], detail: `${psu.wattage_w} W is just above the ${need.min_w} W this build needs` });
  }
  if (psu?.connectors && gpu?.power_connectors && allocateConnectors(gpu.power_connectors, psu.connectors, gpu.tdp_w).adapter) {
    notes.push({ code: "uses_power_adapter", components: ["psu", "gpu"], detail: "PSU has no 12V-2x6 cable; the GPU runs from 8-pin cables through its adapter" });
  }
  if (cooler && cpu && cooler.rated_tdp_w !== null && cpu.tdp_w !== null && cooler.rated_tdp_w < cpu.tdp_w) {
    notes.push({ code: "cooler_tdp_low", components: ["cooler", "cpu"], detail: `cooler is rated for ${cooler.rated_tdp_w} W; CPU TDP is ${cpu.tdp_w} W` });
  }
  if (motherboard?.wifi === false) notes.push({ code: "no_wifi", components: ["motherboard"], detail: `${motherboard.name} has no Wi-Fi` });
  return notes;
}
