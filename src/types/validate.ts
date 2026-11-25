// Small runtime-check combinators for JSON data. The TypeScript types stay the source of truth:
// obj<T>() requires a check for every key of T, so a field added to a type fails to compile until
// its validator is updated too.
import { isId } from "./ids.ts";

export interface Issue {
  path: string; // e.g. "cpus[3].perf.gaming_fps"
  message: string;
}

export type Check<T> = ((value: unknown, path: string, issues: Issue[]) => void) & { readonly __type?: T };

// One check per key. -? makes optional keys required here too; wrap their check in optional().
export type Shape<T> = { [K in keyof T]-?: Check<T[K]> };

const describe = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

function check<T>(fn: (value: unknown, path: string, issues: Issue[]) => void): Check<T> {
  return fn;
}

// `test` narrows the format; `what` names it in the message.
export const str = (opts: { test?: (s: string) => boolean; what?: string } = {}) =>
  check<string>((v, path, issues) => {
    if (typeof v !== "string" || v.trim() === "") issues.push({ path, message: `expected a non-empty string, got ${describe(v)}` });
    else if (opts.test && !opts.test(v)) issues.push({ path, message: `expected ${opts.what ?? "a valid string"}, got "${v}"` });
  });

export const num = (opts: { min?: number; max?: number; int?: boolean } = {}) =>
  check<number>((v, path, issues) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return void issues.push({ path, message: `expected a number, got ${describe(v)}` });
    if (opts.int && !Number.isInteger(v)) issues.push({ path, message: `expected an integer, got ${v}` });
    if (opts.min !== undefined && v < opts.min) issues.push({ path, message: `expected >= ${opts.min}, got ${v}` });
    if (opts.max !== undefined && v > opts.max) issues.push({ path, message: `expected <= ${opts.max}, got ${v}` });
  });

// > 0, for prices, wattages, sizes and scores.
export const positive = (opts: { int?: boolean } = {}) =>
  check<number>((v, path, issues) => {
    num(opts)(v, path, issues);
    if (typeof v === "number" && v <= 0) issues.push({ path, message: `expected > 0, got ${v}` });
  });

// >= 0 integer, for counts.
export const count = () => num({ min: 0, int: true });

export const bool = () =>
  check<boolean>((v, path, issues) => {
    if (typeof v !== "boolean") issues.push({ path, message: `expected a boolean, got ${describe(v)}` });
  });

export const oneOf = <const V extends string>(values: readonly V[]) =>
  check<V>((v, path, issues) => {
    if (!values.includes(v as V)) issues.push({ path, message: `expected one of ${values.join(", ")}, got ${JSON.stringify(v)}` });
  });

export const id = () => str({ test: isId, what: "a model-slug ID (see src/types/ids.ts)" });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;
export const isoDate = () => str({ test: (s) => ISO_DATE.test(s) && !Number.isNaN(Date.parse(s)), what: "an ISO date" });

export const nullable = <T>(inner: Check<T>) =>
  check<T | null>((v, path, issues) => {
    if (v !== null) inner(v, path, issues);
  });

export const optional = <T>(inner: Check<T>) =>
  check<T | undefined>((v, path, issues) => {
    if (v !== undefined) inner(v, path, issues);
  });

export const arr = <T>(item: Check<T>, opts: { nonEmpty?: boolean } = {}) =>
  check<T[]>((v, path, issues) => {
    if (!Array.isArray(v)) return void issues.push({ path, message: `expected an array, got ${describe(v)}` });
    if (opts.nonEmpty && v.length === 0) issues.push({ path, message: "expected at least one item" });
    v.forEach((x, i) => item(x, `${path}[${i}]`, issues));
  });

// An object whose keys all come from `keys`, each value passing `value`. A missing key is allowed.
export const record = <K extends string, T>(keys: readonly K[], value: Check<T>) =>
  check<Partial<Record<K, T>>>((v, path, issues) => {
    if (!isPlainObject(v)) return void issues.push({ path, message: `expected an object, got ${describe(v)}` });
    for (const [k, x] of Object.entries(v)) {
      if (!keys.includes(k as K)) issues.push({ path: `${path}.${k}`, message: `unexpected key (allowed: ${keys.join(", ")})` });
      else value(x, `${path}.${k}`, issues);
    }
  });

// An object with exactly the keys in `shape`. Unknown keys are reported, which catches typos.
export const obj = <T>(shape: Shape<T>) =>
  check<T>((v, path, issues) => {
    if (!isPlainObject(v)) return void issues.push({ path, message: `expected an object, got ${describe(v)}` });
    const checks = shape as Record<string, Check<unknown>>;
    for (const k of Object.keys(v)) {
      if (!(k in checks)) issues.push({ path: `${path}.${k}`, message: "unexpected key" });
    }
    for (const [k, c] of Object.entries(checks)) c(v[k], `${path}.${k}`, issues);
  });

// Picks a check by the value of a tag key, for discriminated unions.
export const tagged = <T>(tag: string, variants: Record<string, Check<unknown>>) =>
  check<T>((v, path, issues) => {
    if (!isPlainObject(v)) return void issues.push({ path, message: `expected an object, got ${describe(v)}` });
    const variant = variants[v[tag] as string];
    if (!variant) issues.push({ path: `${path}.${tag}`, message: `expected one of ${Object.keys(variants).join(", ")}, got ${JSON.stringify(v[tag])}` });
    else variant(v, path, issues);
  });

// Passes if any alternative passes.
export const anyOf = <T>(what: string, ...alternatives: Check<unknown>[]) =>
  check<T>((v, path, issues) => {
    if (!alternatives.some((alt) => validate(alt, v).length === 0)) issues.push({ path, message: `expected ${what}, got ${JSON.stringify(v)}` });
  });

export const literal = <const V extends string>(value: V) => oneOf([value]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validate<T>(c: Check<T>, value: unknown, path = "$"): Issue[] {
  const issues: Issue[] = [];
  c(value, path, issues);
  return issues;
}

export function isValid<T>(c: Check<T>, value: unknown): value is T {
  return validate(c, value).length === 0;
}

export function formatIssues(issues: Issue[], max = 20): string {
  const lines = issues.slice(0, max).map((i) => `  ${i.path}: ${i.message}`);
  if (issues.length > max) lines.push(`  ...and ${issues.length - max} more`);
  return lines.join("\n");
}

// Throws with every issue listed, for the pipeline's "refuse to publish" path.
export function assertValid<T>(c: Check<T>, value: unknown, label: string): asserts value is T {
  const issues = validate(c, value, label);
  if (issues.length) throw new Error(`${label} failed validation:\n${formatIssues(issues)}`);
}
