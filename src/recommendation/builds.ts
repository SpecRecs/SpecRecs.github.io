// Candidate builds. Every CPU × GPU choice gets the cheapest set of supporting parts (board,
// memory, case, cooler, PSU, and storage for new builds) that passes every hard rule. In an
// upgrade, a current part that still fits costs nothing, so it's kept; one that doesn't is
// replaced, which is how platform changes get their full cascading cost.
import { checkBuild, evaluate } from "../compatibility/index.ts";
import type { Catalog, Price } from "../types/catalog.ts";
import type { Id, PartCategory } from "../types/common.ts";
import type { BuildParts, CompatibilityReport } from "../types/compatibility.ts";
import type { Case, Cooler, Cpu, GpuFamily, GpuVariant, Memory, Motherboard, Psu, Storage } from "../types/parts.ts";
import type { CurrentPart, Mode, Purpose, Resolution, UserRequest } from "../types/request.ts";
import type { EngineConfig } from "./config.ts";

// A part in a build: bought (at `price`) or already owned.
export interface Slot<T> {
  part: T;
  price: Price | null; // null = owned
}

export interface Current {
  cpu?: Cpu;
  gpu?: GpuFamily;
  motherboard?: Motherboard;
  memory?: Memory;
  psu?: Psu;
  case?: Case;
  cooler?: Cooler;
  storage: Storage[];
}

export interface Context {
  request: UserRequest;
  mode: Mode;
  purpose: Purpose;
  resolution: Resolution;
  budget: number;
  config: EngineConfig;
  catalog: Catalog;
  prices: Map<Id, Price>; // cheapest new listing per part
  families: Map<Id, GpuFamily>;
  current: Current;
  // Memoized sub-results of solve(); see memo().
  cache: Map<string, unknown>;
}

export interface Candidate {
  cpu?: Slot<Cpu>;
  gpu?: Slot<GpuVariant>; // absent when the current GPU is kept (it's a family, not a card)
  gpuFamily?: GpuFamily;
  motherboard?: Slot<Motherboard>;
  memory?: Slot<Memory>;
  psu?: Slot<Psu>;
  case?: Slot<Case>;
  cooler?: Slot<Cooler>;
  storage?: Slot<Storage>;
  cost_usd: number;
  report: CompatibilityReport;
  key: string; // sorted bought IDs: identifies the build and breaks ties
}

type Support = "motherboard" | "memory" | "psu" | "case" | "cooler";

export function makeContext(request: UserRequest, catalog: Catalog, config: EngineConfig): Context {
  const prices = new Map<Id, Price>();
  for (const p of catalog.prices) {
    if (p.condition !== "new") continue;
    const best = prices.get(p.product_id);
    if (!best || p.price_usd < best.price_usd || (p.price_usd === best.price_usd && p.retailer < best.retailer)) prices.set(p.product_id, p);
  }
  const families = new Map(catalog.gpu_families.map((f) => [f.id, f]));
  const mode = request.mode ?? "new";
  return {
    request, mode, config, catalog, prices, families,
    purpose: request.purpose ?? config.default_purpose,
    resolution: request.resolution ?? config.default_resolution,
    budget: request.budget_max_usd ?? Infinity,
    current: mode === "upgrade" ? resolveCurrent(request, catalog, families) : { storage: [] },
    cache: new Map(),
  };
}

// A current part is usable when it maps to a candidate; its specs fill or override that record.
function resolveCurrent(request: UserRequest, catalog: Catalog, families: Map<Id, GpuFamily>): Current {
  const cs = request.current_system ?? {};
  const resolve = <T extends { id: Id }>(list: T[], p: CurrentPart<T> | undefined): T | undefined => {
    const base = p?.candidate_id ? list.find((x) => x.id === p.candidate_id) : undefined;
    return base && { ...base, ...p!.specs, id: base.id };
  };
  const gpu = cs.gpu?.candidate_id ? families.get(cs.gpu.candidate_id) : undefined;
  return {
    cpu: resolve(catalog.cpus, cs.cpu),
    gpu,
    motherboard: resolve(catalog.motherboards, cs.motherboard),
    memory: resolve(catalog.memory, cs.memory),
    psu: resolve(catalog.psus, cs.psu),
    case: resolve(catalog.cases, cs.case),
    cooler: resolve(catalog.coolers, cs.cooler as CurrentPart<Cooler> | undefined),
    storage: (cs.storage ?? []).map((s) => resolve(catalog.storage, s)).filter((s): s is Storage => !!s),
  };
}

// Priced parts, cheapest first, ties by ID.
function priced<T extends { id: Id }>(ctx: Context, list: T[]): Slot<T>[] {
  return list
    .filter((p) => ctx.prices.has(p.id))
    .map((p) => ({ part: p, price: ctx.prices.get(p.id)! }))
    .sort((a, b) => a.price!.price_usd - b.price!.price_usd || (a.part.id < b.part.id ? -1 : 1));
}

// Choices for a supporting category. In an upgrade: the current part first (free), then purchases;
// if the current part is unknown, a single null ("assume it's adequate; don't buy one").
function options<T extends { id: Id }>(ctx: Context, cat: Support, list: T[], allow: (p: T) => boolean = () => true): (Slot<T> | null)[] {
  const buy = priced(ctx, list.filter(allow));
  if (ctx.mode === "new") return buy;
  const owned = ctx.current[cat] as T | undefined;
  if (!owned) return [null];
  return [{ part: owned, price: null }, ...buy.filter((s) => s.part.id !== owned.id)];
}

const fits = (parts: BuildParts) => !evaluate(parts).some((r) => r.status === "fail");
const cost = (s: Slot<unknown> | null | undefined) => s?.price?.price_usd ?? 0;

// The first option (cheapest) that passes, or undefined when none does. null options always pass.
function first<T>(opts: (Slot<T> | null)[], test: (part: T | undefined) => boolean): Slot<T> | null | undefined {
  return opts.find((o) => test(o?.part));
}

// solve() runs for every CPU × GPU pair, but each supporting choice depends on only a few inputs
// (the cooler on socket and case, the PSU on CPU power, GPU and case), so results are cached by
// those inputs. Without this, a 40-CPU × 80-GPU catalog takes seconds.
function memo<T>(ctx: Context, key: string, compute: () => T): T {
  if (!ctx.cache.has(key)) ctx.cache.set(key, compute());
  return ctx.cache.get(key) as T;
}

const idOf = (x: { id: Id } | undefined) => x?.id ?? "-";

interface Primary {
  cpu: Slot<Cpu> | null; // null = unknown current CPU, kept
  gpu: Slot<GpuVariant> | null; // null = current GPU kept
  gpuFamily: GpuFamily | undefined;
}

function solve(ctx: Context, p: Primary, styleOnly: boolean): Candidate | null {
  const { request, catalog, config } = ctx;
  const cpu = p.cpu?.part;
  const gpu = p.gpu?.part;
  const size = request.size_pref && request.size_pref !== "none" ? request.size_pref : null;
  const style = request.style_pref && request.style_pref !== "none" ? request.style_pref : null;

  const minMemory = config.min_memory_gb.filter((t) => t.from_budget_usd <= ctx.budget).at(-1)?.gb ?? 0;
  const boards = memo(ctx, "opts:board", () => options(ctx, "motherboard", catalog.motherboards, (b) => size !== "small" || b.form_factor === "Mini-ITX"));
  const kits = memo(ctx, "opts:memory", () => options(ctx, "memory", catalog.memory, (m) => m.capacity_gb >= minMemory));
  const cases = memo(ctx, `opts:case:${styleOnly}`, () =>
    options(ctx, "case", catalog.cases, (c) => (!size || c.size_class === size) && (!styleOnly || c.style_tags.includes(style!))));
  const coolers = memo(ctx, "opts:cooler", () => options(ctx, "cooler", catalog.coolers));
  const psus = memo(ctx, "opts:psu", () => options(ctx, "psu", catalog.psus));
  const drives = memo(ctx, "opts:storage", () => (ctx.mode === "new" ? priced(ctx, catalog.storage.filter((s) => s.capacity_gb >= config.min_storage_gb)) : []));
  const keptStorage = ctx.current.storage;

  const base = cost(p.cpu) + cost(p.gpu);
  let best: Candidate | null = null;
  for (const board of boards) {
    const motherboard = board?.part;
    if (base + cost(board) > ctx.budget) continue;
    // Board, memory and storage depend only on the CPU.
    const platformParts = memo(ctx, `platform:${idOf(cpu)}|${idOf(motherboard)}`, () => {
      if (!fits({ cpu, motherboard })) return null;
      const memory = first(kits, (m) => fits({ cpu, motherboard, memory: m }));
      if (memory === undefined) return null;
      const storage = ctx.mode === "new" ? drives.find((d) => fits({ motherboard, storage: [d.part] })) : undefined;
      if (ctx.mode === "new" && !storage) return null;
      return { memory, storage };
    });
    if (!platformParts) continue;
    const { memory, storage } = platformParts;
    const platform = base + cost(board) + cost(memory) + cost(storage);
    for (const pcCase of cases) {
      const c = pcCase?.part;
      if (platform + cost(pcCase) > ctx.budget) continue;
      if (!memo(ctx, `case:${idOf(motherboard)}|${idOf(gpu)}|${idOf(c)}`, () => fits({ motherboard, gpu, case: c }))) continue;
      const socket = cpu?.socket ?? motherboard?.socket ?? "-";
      const cooler = memo(ctx, `cooler:${socket}|${idOf(c)}`, () => first(coolers, (k) => fits({ cooler: k, cpu, motherboard, case: c })));
      const psu = memo(ctx, `psu:${cpu ? cpu.tdp_w : "-"}|${idOf(gpu)}|${idOf(c)}`, () => first(psus, (s) => fits({ psu: s, cpu, gpu, case: c })));
      if (cooler === undefined || psu === undefined) continue;
      const total = platform + cost(pcCase) + cost(cooler) + cost(psu);
      if (total > ctx.budget || (best && total >= best.cost_usd)) continue;

      const parts: BuildParts = {
        cpu, motherboard, memory: memory?.part, gpu, psu: psu?.part, case: c, cooler: cooler?.part,
        storage: storage ? [storage.part] : keptStorage,
      };
      const report = checkBuild(parts);
      if (!report.valid) continue; // the pairwise checks should make this unreachable
      const slots = { cpu: p.cpu ?? undefined, gpu: p.gpu ?? undefined, motherboard: board ?? undefined, memory: memory ?? undefined, psu: psu ?? undefined, case: pcCase ?? undefined, cooler: cooler ?? undefined, storage };
      best = { ...slots, gpuFamily: p.gpuFamily, cost_usd: total, report, key: keyOf(slots) };
    }
  }
  return best;
}

function keyOf(slots: Partial<Record<PartCategory, Slot<{ id: Id }> | undefined>>): string {
  return Object.values(slots).filter((s) => s?.price).map((s) => s!.part.id).sort().join(",");
}

// Every candidate build within budget, deduplicated by the parts bought.
export function candidates(ctx: Context): Candidate[] {
  const { catalog, current } = ctx;
  const buyCpu = priced(ctx, catalog.cpus);
  const buyGpu = priced(ctx, catalog.gpu_variants);
  const familyOf = (v: GpuVariant) => ctx.families.get(v.family_id);

  const cpuChoices: (Slot<Cpu> | null)[] =
    ctx.mode === "new" ? buyCpu : [current.cpu ? { part: current.cpu, price: null } : null, ...buyCpu.filter((s) => s.part.id !== current.cpu?.id)];
  const gpuChoices: { gpu: Slot<GpuVariant> | null; family: GpuFamily | undefined }[] =
    ctx.mode === "new"
      ? buyGpu.map((g) => ({ gpu: g, family: familyOf(g.part) }))
      : [{ gpu: null, family: current.gpu }, ...buyGpu.map((g) => ({ gpu: g, family: familyOf(g.part) }))];

  const out = new Map<string, Candidate>();
  for (const cpu of cpuChoices) {
    for (const { gpu, family } of gpuChoices) {
      if (ctx.mode === "upgrade" && !cpu?.price && !gpu) continue; // nothing bought
      if (cost(cpu) + cost(gpu) > ctx.budget) continue;
      const primary = { cpu, gpu, gpuFamily: family };
      const style = ctx.request.style_pref;
      const c = (style && style !== "none" && solve(ctx, primary, true)) || solve(ctx, primary, false);
      if (c && !out.has(c.key)) out.set(c.key, c);
    }
  }
  return [...out.values()];
}
