// Scoring and selection. Each candidate gets a weighted score (config/workload_weights.json) whose
// terms are normalized across the candidates, so 1 means "best of these". Then:
//   best_fit     highest score
//   best_value   most primary metric (new) or % gain (upgrade) per dollar
//   performance  highest primary metric within budget. Ties go to fewer unknown compatibility
//                results, then to higher secondary scores (so a big budget buys a faster GPU or CPU
//                even when FPS is capped), then to price.
// Each unknown compatibility result costs a build config.unknown_penalty of its score and value.
// Remaining ties go to the cheaper build, then to the sorted part IDs, so results are deterministic.
import type { PartCategory } from "../types/common.ts";
import type { Reason, Recommendation, RecommendationCategory, RecommendedPart, Warning } from "../types/recommendation.ts";
import type { Candidate, Context, Slot } from "./builds.ts";
import { TERMS, type Term } from "./config.ts";
import { gainPct, gamingEstimate, metric, perfEstimate, type System } from "./perf.ts";

export interface Scored {
  c: Candidate;
  system: System;
  primary: number;
  baseline: number | null; // the current system's primary metric (upgrades)
  gain: number | null; // upgrades only
  value: number;
  score: number;
  // Unweighted sum of the normalized terms other than primary and value.
  secondary: number;
  unknowns: number;
}

const ORDER: PartCategory[] = ["cpu", "gpu", "motherboard", "memory", "psu", "case", "cooler", "storage"];

export function score(ctx: Context, cands: Candidate[]): Scored[] {
  const { primary: primaryMetric, weights } = ctx.config.workloads[ctx.purpose];
  const baseline = ctx.mode === "upgrade" ? metric({ cpu: ctx.current.cpu, gpu: ctx.current.gpu }, primaryMetric, ctx.resolution) : null;

  const rows: (Omit<Scored, "score" | "secondary" | "unknowns"> & { raw: Record<Term, number> })[] = [];
  for (const c of cands) {
    const system: System = { cpu: c.cpu?.part, gpu: c.gpuFamily };
    const primary = metric(system, primaryMetric, ctx.resolution);
    if (primary === null) continue;
    const gain = ctx.mode === "upgrade" ? gainPct(baseline, primary) : null;
    if (gain !== null && gain < ctx.config.min_gain_pct) continue;
    const value = (gain ?? primary) / c.cost_usd;
    const raw: Record<Term, number> = {
      primary,
      value,
      rt: system.gpu?.perf.rt ?? 0,
      vram: system.gpu?.vram_gb ?? 0,
      single: system.cpu?.perf.single ?? 0,
      multi: system.cpu?.perf.multi ?? 0,
      gaming: gamingEstimate(system, ctx.resolution)?.fps ?? 0,
    };
    rows.push({ c, system, primary, baseline, gain, value, raw });
  }

  const max = Object.fromEntries(TERMS.map((t) => [t, Math.max(0, ...rows.map((r) => r.raw[t]))])) as Record<Term, number>;
  const norm = (raw: Record<Term, number>, t: Term) => (max[t] > 0 ? raw[t] / max[t] : 0);
  return rows.map(({ raw, ...r }) => {
    const unknowns = r.c.report.unknown.length;
    const trust = (1 - ctx.config.unknown_penalty) ** unknowns;
    return {
      ...r,
      value: r.value * trust,
      score: trust * TERMS.reduce((s, t) => s + (weights[t] ?? 0) * norm(raw, t), 0),
      secondary: TERMS.filter((t) => t !== "primary" && t !== "value").reduce((s, t) => s + norm(raw, t), 0),
      unknowns,
    };
  });
}

type Compare = (a: Scored, b: Scored) => number;
const desc = (f: (s: Scored) => number): Compare => (a, b) => f(b) - f(a);
const tieBreak: Compare = (a, b) => a.c.cost_usd - b.c.cost_usd || (a.c.key < b.c.key ? -1 : a.c.key > b.c.key ? 1 : 0);
const by = (...cmps: Compare[]): Compare => (a, b) => {
  for (const cmp of cmps) {
    const d = cmp(a, b);
    if (d !== 0) return d;
  }
  return 0;
};

const PICKS: [RecommendationCategory, Compare][] = [
  ["best_fit", by(desc((s) => s.score), tieBreak)],
  ["best_value", by(desc((s) => s.value), desc((s) => s.primary), tieBreak)],
  ["performance", by(desc((s) => s.primary), (a, b) => a.unknowns - b.unknowns, desc((s) => s.secondary), tieBreak)],
];

// The winning build per category, merged when two categories pick the same build.
export function select(scored: Scored[]): { s: Scored; categories: RecommendationCategory[] }[] {
  if (scored.length === 0) return [];
  const out: { s: Scored; categories: RecommendationCategory[] }[] = [];
  for (const [category, cmp] of PICKS) {
    const winner = [...scored].sort(cmp)[0];
    const existing = out.find((o) => o.s.c.key === winner.c.key);
    if (existing) existing.categories.push(category);
    else out.push({ s: winner, categories: [category] });
  }
  return out;
}

function bought(c: Candidate): [PartCategory, Slot<{ id: string }>][] {
  return ORDER.flatMap((k) => {
    const slot = c[k as keyof Candidate] as Slot<{ id: string }> | undefined;
    return slot?.price ? [[k, slot] as [PartCategory, Slot<{ id: string }>]] : [];
  });
}

export function toRecommendation(ctx: Context, s: Scored, categories: RecommendationCategory[]): Recommendation {
  const { c } = s;
  const { request } = ctx;
  const upgrade = ctx.mode === "upgrade";
  const buys = bought(c);
  const has = (k: PartCategory) => buys.some(([b]) => b === k);
  const current = request.current_system ?? {};
  const primaryMetric = ctx.config.workloads[ctx.purpose].primary;

  const parts: RecommendedPart[] = buys.map(([component, slot]) => {
    const kept = current[component as keyof typeof current];
    return {
      component,
      part_id: slot.part.id,
      price_usd: slot.price!.price_usd,
      retailer: slot.price!.retailer,
      last_checked: slot.price!.last_checked,
      replaces: upgrade && kept && !Array.isArray(kept) ? kept.name : null,
    };
  });

  const reasons: Reason[] = [];
  if (upgrade && s.gain !== null && s.baseline !== null) {
    const changedCpu = has("cpu") || has("motherboard");
    const component = has("gpu") && !changedCpu ? "gpu" : changedCpu && !has("gpu") ? "cpu" : "system";
    reasons.push({ type: "performance_gain", component, metric: primaryMetric, old_value: s.baseline, new_value: s.primary, percent_gain: s.gain });
  }
  if (upgrade && has("motherboard")) {
    const platform = buys.filter(([k]) => ["cpu", "motherboard", "memory", "cooler"].includes(k));
    reasons.push({
      type: "platform_change",
      requires: platform.map(([k]) => k).filter((k) => k !== "cpu"),
      cost_usd: platform.reduce((t, [, slot]) => t + slot.price!.price_usd, 0),
    });
  }
  if (upgrade && has("gpu") && !has("cpu") && current.cpu) reasons.push({ type: "keep_part", component: "cpu", part_name: current.cpu.name });
  if (upgrade && has("cpu") && !has("gpu") && current.gpu) reasons.push({ type: "keep_part", component: "gpu", part_name: current.gpu.name });
  if (upgrade && s.gain !== null && categories.includes("best_value")) {
    const main = has("gpu") ? "gpu" : has("cpu") ? "cpu" : buys[0][0];
    reasons.push({ type: "upgrade_value", component: main, percent_gain: s.gain, cost_usd: c.cost_usd });
  }
  if (!upgrade) {
    const component = primaryMetric === "gaming_fps" || primaryMetric === "rt" ? "gpu" : "cpu";
    const slot = c[component];
    if (slot?.price) reasons.push({ type: "price_performance", component, metric: primaryMetric, value: s.primary, price_usd: slot.price.price_usd });
  }
  if (Number.isFinite(ctx.budget)) reasons.push({ type: "budget_fit", total_cost_usd: c.cost_usd, budget_max_usd: ctx.budget });
  if (c.case?.price && request.size_pref && request.size_pref !== "none" && c.case.part.size_class === request.size_pref) {
    reasons.push({ type: "preference_match", preference: "size", component: "case", value: request.size_pref });
  }
  if (c.case?.price && request.style_pref && request.style_pref !== "none" && c.case.part.style_tags.includes(request.style_pref)) {
    reasons.push({ type: "preference_match", preference: "style", component: "case", value: request.style_pref });
  }

  return {
    categories,
    mode: ctx.mode,
    parts,
    total_cost_usd: c.cost_usd,
    perf_estimate: perfEstimate(s.system, ctx.resolution),
    gain_pct: upgrade ? s.gain : null,
    reasons,
    warnings: warnings(ctx, s, has),
  };
}

function warnings(ctx: Context, s: Scored, has: (k: PartCategory) => boolean): Warning[] {
  const { c } = s;
  const out: Warning[] = c.report.unknown.map((u) => ({ type: "compatibility_unknown", rule: u.rule, components: u.components }));

  // Upgrades assume an unknown current part is adequate, and ask for what would confirm it.
  if (ctx.mode === "upgrade") {
    const cur = ctx.current;
    const cpuChanged = has("cpu");
    if (!cur.cpu) out.push({ type: "missing_info", component: "cpu", field: "model" });
    if (!cur.gpu) out.push({ type: "missing_info", component: "gpu", field: "model" });
    if (!cur.motherboard && cpuChanged) out.push({ type: "missing_info", component: "motherboard", field: "socket" });
    if (!cur.memory && (cpuChanged || has("motherboard"))) out.push({ type: "missing_info", component: "memory", field: "memory_type" });
    if (!cur.cooler && cpuChanged) out.push({ type: "missing_info", component: "cooler", field: "supported_sockets" });
    if (!cur.psu && (cpuChanged || has("gpu"))) out.push({ type: "missing_info", component: "psu", field: "wattage_w" });
    if (!cur.case && (has("gpu") || has("motherboard"))) out.push({ type: "missing_info", component: "case", field: "max_gpu_length_mm" });
  }

  const gaming = gamingEstimate(s.system, ctx.resolution);
  if (gaming && gaming.limited_by === "cpu" && gaming.gpu_cap_fps / gaming.cpu_cap_fps >= ctx.config.imbalance_ratio) {
    out.push({ type: "imbalance", limited_by: "cpu" });
  }

  const preferred = ctx.request.budget_preferred_usd;
  if (preferred !== undefined && c.cost_usd > preferred) out.push({ type: "over_preferred_budget", total_cost_usd: c.cost_usd, budget_preferred_usd: preferred });

  // Staleness is measured against the newest price in the catalog, not the clock, so the same
  // snapshot always gives the same warnings.
  const newest = Math.max(...ctx.catalog.prices.map((p) => Date.parse(p.last_checked)));
  for (const [, slot] of bought(c)) {
    const age = (newest - Date.parse(slot.price!.last_checked)) / 86_400_000;
    if (age > ctx.config.stale_price_days) out.push({ type: "price_stale", product_id: slot.part.id, last_checked: slot.price!.last_checked });
  }
  return out;
}
