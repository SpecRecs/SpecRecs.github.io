// Candidate-catalog parts: the curated parts the engine may recommend (docs/agent-plan.md §2, Catalog).
// Every key is required. A value the source doesn't know is null, not left out, so a gap in the data
// is always visible. `source` names where the record's specs came from.
//
// Performance scales (agent-plan §5):
//   *_fps   Estimated average FPS on the gpu-data.csv game suite (high settings, rasterized). Raw, not
//           normalized, so the gaming model min(cpu.gaming_fps, gpu fps at resolution) compares like
//           with like.
//   index   Normalized so a reference part = 100: Ryzen 5 5600X for CPU single and multi,
//           RTX 3060 12GB for GPU ray tracing. 176 means 76% faster than the reference.
import type {
  BoardFormFactor, ConnectorCounts, Id, MemoryType, PsuFormFactor, SizeClass, Socket, StyleTag,
} from "./common.ts";

interface PartBase {
  id: Id;
  // Display name, e.g. "AMD Ryzen 5 7600".
  name: string;
  manufacturer: string;
  source: string;
}

export interface CpuPerf {
  // FPS the CPU sustains at 1080p when the GPU isn't the limit. It caps the GPU's FPS at any resolution.
  gaming_fps: number | null;
  single: number | null; // index, Ryzen 5 5600X = 100
  multi: number | null; // index, Ryzen 5 5600X = 100
  source: string;
}

export interface Cpu extends PartBase {
  socket: Socket;
  // Memory types the CPU's controller supports. The board decides which one a build uses.
  memory_types: MemoryType[];
  cores: number;
  threads: number;
  tdp_w: number | null;
  integrated_graphics: boolean | null;
  release_year: number | null;
  perf: CpuPerf;
}

export interface GpuPerf {
  r1080_fps: number | null;
  r1440_fps: number | null;
  r4k_fps: number | null;
  rt: number | null; // index, RTX 3060 12GB = 100
  source: string;
}

// A GPU model (chip + VRAM). Performance lives here; board partner cards are GpuVariants.
export interface GpuFamily extends PartBase {
  vram_gb: number;
  // e.g. "DLSS 4.5", "FSR 4.1", "XeSS 3".
  upscaler: string | null;
  release_year: number | null;
  perf: GpuPerf;
}

// A purchasable card. Physical and power fields differ between board partners.
export interface GpuVariant extends PartBase {
  family_id: Id;
  length_mm: number | null;
  slot_width: number | null;
  tdp_w: number | null;
  power_connectors: ConnectorCounts | null;
  recommended_psu_w: number | null;
}

export interface Motherboard extends PartBase {
  socket: Socket;
  chipset: string;
  form_factor: BoardFormFactor;
  memory_type: MemoryType;
  memory_slots: number;
  max_memory_gb: number | null;
  m2_slots: number | null;
  wifi: boolean | null;
  // CPU IDs the board runs (out of the box or after a BIOS update), or "socket" for every CPU on its
  // socket. null means not curated: the engine checks the socket and reports support as unknown.
  supported_cpu_ids: Id[] | "socket" | null;
}

// A memory kit. capacity_gb is the kit total.
export interface Memory extends PartBase {
  memory_type: MemoryType;
  capacity_gb: number;
  module_count: number;
  speed_mt_s: number;
  cas_latency: number | null;
  rgb: boolean | null;
}

export type PsuEfficiency = "white" | "bronze" | "silver" | "gold" | "platinum" | "titanium";
export type PsuModularity = "full" | "semi" | "none";

export interface Psu extends PartBase {
  wattage_w: number;
  form_factor: PsuFormFactor;
  efficiency: PsuEfficiency | null; // 80 Plus rating
  modular: PsuModularity | null;
  connectors: ConnectorCounts | null;
}

export interface Case extends PartBase {
  size_class: SizeClass;
  supported_mb_form_factors: BoardFormFactor[];
  supported_psu_form_factors: PsuFormFactor[];
  max_gpu_length_mm: number | null;
  max_cooler_height_mm: number | null;
  // Radiator sizes the case mounts, e.g. [240, 280, 360]. [] means none.
  radiator_mm_supported: number[] | null;
  style_tags: StyleTag[];
}

interface CoolerBase extends PartBase {
  supported_sockets: Socket[];
  rated_tdp_w: number | null;
}

export interface AirCooler extends CoolerBase {
  type: "air";
  height_mm: number | null;
}

export interface AioCooler extends CoolerBase {
  type: "aio";
  radiator_mm: number;
}

export type Cooler = AirCooler | AioCooler;

export type StorageInterface = "NVMe" | "SATA";
export type StorageFormFactor = "M.2-2280" | "2.5in" | "3.5in";

export interface Storage extends PartBase {
  interface: StorageInterface;
  form_factor: StorageFormFactor;
  capacity_gb: number;
  pcie_gen: number | null; // NVMe only; null for SATA
  read_mb_s: number | null; // sequential
}
