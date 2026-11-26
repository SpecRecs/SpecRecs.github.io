// Turns the parts saved on the My PC page (src/build/) into the engine's CurrentSystem by matching
// each part's name to a candidate in the catalog. Unmatched parts are passed on by name only: the
// engine treats them as unknown, assumes they're adequate, and warns.
import { modelKey } from "../../build/format.ts";
import type { Build, Part } from "../../build/types.ts";
import type { Catalog } from "../../types/catalog.ts";
import type { CurrentPart, CurrentSystem } from "../../types/request.ts";

export interface MatchedSystem {
  system: CurrentSystem;
  matched: string[]; // names of parts that map to a candidate
  unmatched: string[];
}

// modelKey (shared with the My PC page's search) without spaces, so "NVIDIA GeForce RTX 3060 12 GB" and
// "GeForce RTX 3060 12GB" line up. "(2023)"-style revision years are dropped: they don't change the model.
const compact = (s: string) => modelKey(s.replace(/\([^)]*\)/g, " ")).replace(/ /g, "");

// Each leading run of words, compacted: "Corsair RM850e 850W" -> corsair, corsairrm850e, corsairrm850e850w.
const prefixes = (name: string) => {
  const words = name.split(/\s+/);
  return words.map((_, i) => compact(words.slice(0, i + 1).join(" ")));
};

const spec = (part: Part, label: string) => {
  const v = part.specs.find(([l]) => l === label)?.[1];
  return typeof v === "string" && v !== "—" ? v : null;
};
// A spec the lookup part doesn't have never rules a candidate out.
const sameNumber = (part: Part, label: string, value: number) => {
  const n = parseFloat((spec(part, label) ?? "").replace(/,/g, "")); // "3,600 MT/s"
  return Number.isNaN(n) || n === value;
};

// Exact name match. When `confirm` is given, a candidate whose name starts with the part's name also
// matches if the specs agree: fixture memory and PSU names carry specs ("... 32GB (2x16GB) DDR4-3600")
// that lookup names don't. Never a plain prefix match, which would turn a 5600X into a 5600X3D.
function find<T extends { name: string }>(part: Part, list: T[], confirm?: (c: T) => boolean): T | undefined {
  const key = compact(part.name);
  if (!key) return undefined;
  return list.find((c) => compact(c.name) === key) ?? (confirm && list.find((c) => prefixes(c.name).includes(key) && confirm(c)));
}

export function matchCurrent(build: Build, catalog: Catalog): MatchedSystem {
  const matched: string[] = [];
  const unmatched: string[] = [];
  const current = <T>(part: Part | undefined, id: string | undefined): CurrentPart<T> | undefined => {
    if (!part) return undefined;
    (id ? matched : unmatched).push(part.name);
    return { name: part.name, lookup_id: part.id ?? null, candidate_id: id ?? null, specs: {} };
  };
  const first = (key: string) => build[key]?.[0];

  const cpu = first("cpu"), gpu = first("gpu"), board = first("motherboard"), ram = first("ram"), psu = first("psu");
  const system: CurrentSystem = {
    cpu: current(cpu, cpu && find(cpu, catalog.cpus)?.id),
    gpu: current(gpu, gpu && (find(gpu, catalog.gpu_families)?.id ?? find(gpu, catalog.gpu_variants)?.family_id)),
    motherboard: current(board, board && find(board, catalog.motherboards)?.id),
    memory: current(ram, ram && find(ram, catalog.memory, (c) =>
      (spec(ram, "Type") ?? c.memory_type) === c.memory_type && sameNumber(ram, "Total", c.capacity_gb) && sameNumber(ram, "Speed", c.speed_mt_s),
    )?.id),
    psu: current(psu, psu && find(psu, catalog.psus, (c) => sameNumber(psu, "Wattage", c.wattage_w))?.id),
    storage: (build.storage ?? []).map((d) => current(d, find(d, catalog.storage)?.id)!),
  };
  // Drop empty categories so the request only carries what the user entered.
  for (const k of Object.keys(system) as (keyof CurrentSystem)[]) {
    const v = system[k];
    if (!v || (Array.isArray(v) && v.length === 0)) delete system[k];
  }
  return { system, matched, unmatched };
}
