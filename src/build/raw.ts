// Shapes of the raw records each source returns. Fields are optional where the source omits them.
// The data/*.json files are written by scripts/build_data.mjs; TechPowerUp rows come from its API.

export interface TpuWithheld {
  _type: "withheld";
  message?: string;
}

export interface TpuResponse<R> {
  results?: (R | TpuWithheld)[];
}

export interface TpuGpu {
  id: number | string;
  name: string;
  manufacturer?: string;
  released?: string;
  url?: string;
  chip?: { architecture?: string };
  relativePerformance?: { score?: number; isEstimated?: boolean };
  shaders?: number;
  baseClock?: number;
  boostClock?: number;
  memSize?: number;
  memType?: string;
  memBusWidth?: number;
  memBandwidth?: number;
  rtCores?: number;
  tensorCores?: number;
  tdp?: number;
  interface?: string;
}

export interface TpuCpu {
  id: number | string;
  name: string;
  manufacturer?: string;
  codename?: string;
  released?: string;
  url?: string;
  cores?: number;
  threads?: number;
  baseClockMhz?: number;
  cacheL3Kb?: number;
  processNm?: number;
  memChannels?: number;
  memSpeedMhz?: number;
  tdpW?: number;
  socket?: string;
}

export interface TpuSsd {
  id: number | string;
  name: string;
  manufacturer?: string;
  released?: string;
  url?: string;
  formFactor?: string;
  interface?: string;
  protocol?: string;
  capacityGB?: number;
  seqReadMbs?: number;
  seqWriteMbs?: number;
  enduranceTbw?: number;
  flash?: { type?: string; layers?: number };
  dram?: boolean | null;
}

export interface GpuArkRow {
  id: string;
  name: string;
  maker: string | null;
  arch: string | null;
  year: number | null;
  cores: number | null;
  rt_cores: number | null;
  tensor_cores: number | null;
  base_clock: number | null;
  boost_clock: number | null;
  mem_mb: number | null;
  mem_type: string | null;
  bus_width: number | null;
  bandwidth: number | null;
  fp32_tflops: number | null;
  tdp: number | null;
  interface: string | null;
}

export interface DocyxCpu {
  id: string;
  name: string;
  core_count: number | null;
  core_clock: number | null;
  boost_clock: number | null;
  microarchitecture: string | null;
  tdp: number | null;
  graphics: string | null;
}

export interface DocyxStorage {
  id: string;
  name: string;
  capacity: number | null;
  // "SSD", or the spindle speed in RPM for hard drives.
  type: "SSD" | number | null;
  cache: number | null;
  // A string like "M.2-2280", or a drive size in inches like 3.5.
  form_factor: string | number | null;
  interface: string | null;
}

export interface DocyxMemory {
  id: string;
  name: string;
  // [generation, MT/s]; a few old DDR1 records store a bare MT/s number.
  speed: [number, number] | number | null;
  // [module count, GB each]
  modules: [number, number] | null;
  cas_latency: number | null;
  first_word_latency: number | null;
}

export interface DocyxMotherboard {
  id: string;
  name: string;
  socket: string | null;
  form_factor: string | null;
  max_memory: number | null;
  memory_slots: number | null;
}

export interface DocyxPsu {
  id: string;
  name: string;
  type: string | null;
  efficiency: string | null;
  wattage: number | null;
  modular: string | false | null;
}

// [device name, median score (samples/min), number of runs, compute type]
export type BenchRow = [name: string, score: number, runs: number, computeType: string];

export interface BenchFile {
  version: string;
  cpu: BenchRow[];
  gpu: BenchRow[];
}
