// Prices and the published snapshot: what M5 writes to public/data/catalog/ and what recommend()
// reads. Lookup-catalog files (public/data/cpu.json etc.) keep their own shapes; see src/build/raw.ts.
import type { Id, IsoDate } from "./common.ts";
import type { Case, Cooler, Cpu, GpuFamily, GpuVariant, Memory, Motherboard, Psu, Storage } from "./parts.ts";

// One observed listing for a candidate part. For a GPU, product_id is a GpuVariant ID.
export interface Price {
  product_id: Id;
  price_usd: number;
  retailer: string;
  // The MVP engine only uses "new" (used pricing is a non-goal); "used" is accepted so sheets that
  // carry both can be imported unchanged.
  condition: "new" | "used";
  last_checked: IsoDate;
  url: string | null;
  source: string;
}

// The candidate catalog. Each key is one file in public/data/catalog/ (cpus.json, gpu_families.json, ...).
export interface Catalog {
  cpus: Cpu[];
  gpu_families: GpuFamily[];
  gpu_variants: GpuVariant[];
  motherboards: Motherboard[];
  memory: Memory[];
  psus: Psu[];
  cases: Case[];
  coolers: Cooler[];
  storage: Storage[];
  prices: Price[];
}

export type CatalogFile = keyof Catalog;

export const CATALOG_FILES: CatalogFile[] = [
  "cpus", "gpu_families", "gpu_variants", "motherboards", "memory", "psus", "cases", "coolers", "storage", "prices",
];

// public/data/catalog/manifest.json
export interface Manifest {
  version: string;
  built_at: IsoDate;
  counts: Record<CatalogFile, number>;
  sources: { name: string; url: string | null; license: string | null }[];
}

export interface Snapshot extends Catalog {
  manifest: Manifest;
}

// The link M1 adds to each lookup-catalog record, so a user's current part can be compared through
// its candidate's scores. Absent when no candidate matches.
export type WithCandidate<R> = R & { candidate_id?: Id };
