// A value in a part's spec table. Falsy values are hidden; "—" marks a known-missing value.
export type SpecValue = string | null | undefined | false;

export interface Perf {
  label: string;
  value: number;
  max: number;
  note?: string;
  scale?: string;
}

// A part as shown in search results and saved in the build. Saved builds in localStorage use this
// shape, so changing it needs a migration (see STORAGE_KEY in store.ts).
export interface Part {
  id?: string;
  name: string;
  subtitle: string;
  url?: string;
  source?: string;
  perf?: Perf | null;
  bench?: Perf;
  specs: [label: string, value: SpecValue][];
}

export type Build = Record<string, Part[]>;

// Raw rows come from JSON files and APIs, so each mapper types its own rows (see raw.ts).
export type Mapper = (row: any) => Part;

export interface Field {
  key: string;
  label: string;
  type?: "text" | "number";
  options?: string[];
}

interface BaseSource {
  label: string;
  example?: string;
  multiple?: boolean;
  // Manual-entry form: the standalone card for "manual" sources, a fallback for "dataset" ones.
  fields?: Field[];
  summarize?: (values: Record<string, string>) => Part;
}

export interface TpuSource extends BaseSource {
  kind: "tpu";
  endpoint: string;
  mapResult: Mapper;
  fallback?: { file: string; mapResult: Mapper };
  bench?: BenchKind;
}

export interface DatasetSource extends BaseSource {
  kind: "dataset";
  file: string;
  mapResult: Mapper;
}

export interface ManualSource extends BaseSource {
  kind: "manual";
  fields: Field[];
  summarize: (values: Record<string, string>) => Part;
}

export type Source = TpuSource | DatasetSource | ManualSource;

export type BenchKind = "cpu" | "gpu";

export interface SearchResult {
  parts: Part[];
  // Note shown under the result list, or "".
  more: string;
  freeTierOnly?: boolean;
}
