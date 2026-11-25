// Hand-written candidate catalog for M2/M4/M6 tests (docs/agent-plan.md §5): 8 CPUs, 8 GPU families
// with 2 variants each, 4 of every other part, and prices for all but one part. Specs and scores are
// approximate (GPU FPS from data/source/gpu-data.csv); they're test data, not a curated allowlist.
// The deliberate edge cases are listed in EDGE_CASES at the bottom.
import type { Catalog } from "../src/types/catalog.ts";
import type { Case, Cooler, Cpu, GpuFamily, GpuVariant, Memory, Motherboard, Psu, Storage } from "../src/types/parts.ts";

const SOURCE = "fixture";
const GPU_SHEET = "data/source/gpu-data.csv (2026-09-28)";

const cpu = (
  id: string, name: string, manufacturer: string, socket: Cpu["socket"], memory_types: Cpu["memory_types"],
  cores: number, threads: number, tdp_w: number, release_year: number, gaming_fps: number, single: number, multi: number,
  integrated_graphics = false,
): Cpu => ({
  id, name, manufacturer, socket, memory_types, cores, threads, tdp_w, integrated_graphics, release_year,
  perf: { gaming_fps, single, multi, source: SOURCE },
  source: SOURCE,
});

// Ryzen 5 5600X is the single/multi reference (100).
export const cpus: Cpu[] = [
  cpu("ryzen-5-5600x", "AMD Ryzen 5 5600X", "AMD", "AM4", ["DDR4"], 6, 12, 65, 2020, 140, 100, 100),
  cpu("ryzen-7-5700x3d", "AMD Ryzen 7 5700X3D", "AMD", "AM4", ["DDR4"], 8, 16, 105, 2024, 165, 91, 125),
  cpu("ryzen-5-7600", "AMD Ryzen 5 7600", "AMD", "AM5", ["DDR5"], 6, 12, 65, 2023, 175, 121, 134, true),
  cpu("ryzen-7-7800x3d", "AMD Ryzen 7 7800X3D", "AMD", "AM5", ["DDR5"], 8, 16, 120, 2023, 225, 111, 166, true),
  cpu("ryzen-7-9800x3d", "AMD Ryzen 7 9800X3D", "AMD", "AM5", ["DDR5"], 8, 16, 120, 2024, 250, 134, 211, true),
  cpu("core-i5-12400f", "Intel Core i5-12400F", "Intel", "LGA1700", ["DDR4", "DDR5"], 6, 12, 65, 2022, 140, 106, 113),
  cpu("core-i5-14600k", "Intel Core i5-14600K", "Intel", "LGA1700", ["DDR4", "DDR5"], 14, 20, 125, 2023, 185, 131, 221, true),
  // No fixture board has LGA1851, so the engine can never build around this CPU.
  cpu("core-ultra-7-265k", "Intel Core Ultra 7 265K", "Intel", "LGA1851", ["DDR5"], 20, 20, 125, 2024, 190, 138, 323, true),
];

const family = (
  id: string, name: string, manufacturer: string, vram_gb: number, upscaler: string, release_year: number,
  r1080_fps: number, r1440_fps: number, r4k_fps: number, rt: number,
): GpuFamily => ({
  id, name, manufacturer, vram_gb, upscaler, release_year,
  perf: { r1080_fps, r1440_fps, r4k_fps, rt, source: `${GPU_SHEET}; rt: ${SOURCE}` },
  source: GPU_SHEET,
});

// RTX 3060 12GB is the ray-tracing reference (100).
export const gpu_families: GpuFamily[] = [
  family("rtx-3060-12gb", "NVIDIA GeForce RTX 3060 12GB", "NVIDIA", 12, "DLSS 4", 2021, 64, 48, 27, 100),
  family("rtx-5060-ti-16gb", "NVIDIA GeForce RTX 5060 Ti 16GB", "NVIDIA", 16, "DLSS 4.5", 2025, 108, 77, 44, 165),
  family("rtx-5070", "NVIDIA GeForce RTX 5070", "NVIDIA", 12, "DLSS 4.5", 2025, 144, 106, 63, 230),
  family("rtx-5070-ti", "NVIDIA GeForce RTX 5070 Ti", "NVIDIA", 16, "DLSS 4.5", 2025, 172, 133, 80, 290),
  family("rtx-5090", "NVIDIA GeForce RTX 5090", "NVIDIA", 32, "DLSS 4.5", 2025, 240, 206, 139, 560),
  family("rx-9060-xt-16gb", "AMD Radeon RX 9060 XT 16GB", "AMD", 16, "FSR 4.1", 2025, 100, 74, 41, 125),
  family("rx-9070-xt", "AMD Radeon RX 9070 XT", "AMD", 16, "FSR 4.1", 2025, 172, 133, 80, 245),
  family("arc-b580", "Intel Arc B580", "Intel", 12, "XeSS 3", 2024, 76, 67, 35, 120),
];

const variant = (
  family_id: string, board: string, name: string, manufacturer: string, length_mm: number | null, slot_width: number,
  tdp_w: number, power_connectors: GpuVariant["power_connectors"], recommended_psu_w: number,
): GpuVariant => ({
  id: `${family_id}--${board}`, family_id, name, manufacturer, length_mm, slot_width, tdp_w, power_connectors, recommended_psu_w,
  source: SOURCE,
});

export const gpu_variants: GpuVariant[] = [
  variant("rtx-3060-12gb", "msi-ventus-2x", "MSI GeForce RTX 3060 Ventus 2X 12G", "MSI", 235, 2, 170, { pcie_8pin: 1 }, 550),
  variant("rtx-3060-12gb", "evga-xc-gaming", "EVGA GeForce RTX 3060 XC Gaming", "EVGA", 202, 2, 170, { pcie_8pin: 1 }, 550),
  variant("rtx-5060-ti-16gb", "asus-dual-oc", "ASUS Dual GeForce RTX 5060 Ti 16GB OC", "ASUS", 229, 2.5, 180, { pcie_8pin: 1 }, 550),
  // Length unknown: gpu_length should come back "unknown", not "pass".
  variant("rtx-5060-ti-16gb", "gigabyte-windforce-oc", "Gigabyte GeForce RTX 5060 Ti WINDFORCE OC 16G", "Gigabyte", null, 2, 180, { pcie_8pin: 1 }, 550),
  variant("rtx-5070", "msi-ventus-2x-oc", "MSI GeForce RTX 5070 Ventus 2X OC", "MSI", 242, 2, 250, { pcie_8pin: 1 }, 650),
  variant("rtx-5070", "founders-edition", "NVIDIA GeForce RTX 5070 Founders Edition", "NVIDIA", 242, 2, 250, { "12v_2x6": 1 }, 650),
  variant("rtx-5070-ti", "asus-prime-oc", "ASUS Prime GeForce RTX 5070 Ti OC", "ASUS", 304, 2.5, 300, { "12v_2x6": 1 }, 750),
  variant("rtx-5070-ti", "msi-ventus-3x-oc", "MSI GeForce RTX 5070 Ti Ventus 3X OC", "MSI", 303, 2.5, 300, { "12v_2x6": 1 }, 750),
  variant("rtx-5090", "founders-edition", "NVIDIA GeForce RTX 5090 Founders Edition", "NVIDIA", 304, 2, 575, { "12v_2x6": 1 }, 1000),
  variant("rtx-5090", "asus-rog-astral", "ASUS ROG Astral GeForce RTX 5090 OC", "ASUS", 358, 3.8, 600, { "12v_2x6": 1 }, 1000),
  variant("rx-9060-xt-16gb", "sapphire-pulse", "Sapphire Pulse Radeon RX 9060 XT 16GB", "Sapphire", 240, 2, 160, { pcie_8pin: 1 }, 450),
  variant("rx-9060-xt-16gb", "xfx-swift-oc", "XFX Swift Radeon RX 9060 XT 16GB OC", "XFX", 256, 2, 160, { pcie_8pin: 1 }, 450),
  variant("rx-9070-xt", "sapphire-pulse", "Sapphire Pulse Radeon RX 9070 XT", "Sapphire", 280, 2.5, 304, { pcie_8pin: 2 }, 750),
  variant("rx-9070-xt", "powercolor-reaper", "PowerColor Reaper Radeon RX 9070 XT", "PowerColor", 304, 2, 304, { pcie_8pin: 2 }, 750),
  variant("arc-b580", "limited-edition", "Intel Arc B580 Limited Edition", "Intel", 272, 2, 190, { pcie_8pin: 1 }, 600),
  variant("arc-b580", "asrock-challenger-oc", "ASRock Intel Arc B580 Challenger OC", "ASRock", 270, 2, 190, { pcie_8pin: 1 }, 600),
];

const board = (
  id: string, name: string, manufacturer: string, socket: Motherboard["socket"], chipset: string,
  form_factor: Motherboard["form_factor"], memory_type: Motherboard["memory_type"], memory_slots: number, max_memory_gb: number,
  m2_slots: number, wifi: boolean, supported_cpu_ids: Motherboard["supported_cpu_ids"],
): Motherboard => ({
  id, name, manufacturer, socket, chipset, form_factor, memory_type, memory_slots, max_memory_gb, m2_slots, wifi, supported_cpu_ids,
  source: SOURCE,
});

export const motherboards: Motherboard[] = [
  board("msi-mag-b550-tomahawk", "MSI MAG B550 TOMAHAWK", "MSI", "AM4", "B550", "ATX", "DDR4", 4, 128, 2, false, ["ryzen-5-5600x", "ryzen-7-5700x3d"]),
  board("gigabyte-b650-aorus-elite-ax", "Gigabyte B650 AORUS ELITE AX", "Gigabyte", "AM5", "B650", "ATX", "DDR5", 4, 192, 2, true, "socket"),
  board("asus-rog-strix-b650e-i", "ASUS ROG STRIX B650E-I GAMING WIFI", "ASUS", "AM5", "B650E", "Mini-ITX", "DDR5", 2, 96, 2, true, "socket"),
  board("msi-pro-b760m-a-ddr4", "MSI PRO B760M-A DDR4", "MSI", "LGA1700", "B760", "Micro-ATX", "DDR4", 4, 128, 2, false, null),
];

const kit = (
  id: string, name: string, manufacturer: string, memory_type: Memory["memory_type"], module_count: number, gb_each: number,
  speed_mt_s: number, cas_latency: number, rgb: boolean,
): Memory => ({
  id, name, manufacturer, memory_type, capacity_gb: module_count * gb_each, module_count, speed_mt_s, cas_latency, rgb,
  source: SOURCE,
});

export const memory: Memory[] = [
  kit("corsair-vengeance-lpx-32gb-ddr4-3600", "Corsair Vengeance LPX 32GB (2x16GB) DDR4-3600 CL18", "Corsair", "DDR4", 2, 16, 3600, 18, false),
  kit("corsair-vengeance-rgb-pro-16gb-ddr4-3200", "Corsair Vengeance RGB Pro 16GB (2x8GB) DDR4-3200 CL16", "Corsair", "DDR4", 2, 8, 3200, 16, true),
  kit("gskill-flare-x5-32gb-ddr5-6000", "G.Skill Flare X5 32GB (2x16GB) DDR5-6000 CL30", "G.Skill", "DDR5", 2, 16, 6000, 30, false),
  // Four modules: fits the ATX boards, not the 2-slot Mini-ITX board.
  kit("kingston-fury-beast-rgb-64gb-ddr5-6000", "Kingston FURY Beast RGB 64GB (4x16GB) DDR5-6000 CL30", "Kingston", "DDR5", 4, 16, 6000, 30, true),
];

const supply = (
  id: string, name: string, manufacturer: string, wattage_w: number, form_factor: Psu["form_factor"],
  efficiency: Psu["efficiency"], modular: Psu["modular"], connectors: Psu["connectors"],
): Psu => ({ id, name, manufacturer, wattage_w, form_factor, efficiency, modular, connectors, source: SOURCE });

export const psus: Psu[] = [
  supply("corsair-cx450", "Corsair CX450 450W 80+ Bronze", "Corsair", 450, "ATX", "bronze", "none", { pcie_8pin: 2 }),
  supply("corsair-rm850e", "Corsair RM850e 850W 80+ Gold", "Corsair", 850, "ATX", "gold", "full", { pcie_8pin: 3, "12v_2x6": 1 }),
  supply("corsair-sf750", "Corsair SF750 750W 80+ Platinum", "Corsair", 750, "SFX", "platinum", "full", { pcie_8pin: 4 }),
  supply("msi-mag-a1000gl", "MSI MAG A1000GL PCIE5 1000W 80+ Gold", "MSI", 1000, "ATX", "gold", "full", { pcie_8pin: 4, "12v_2x6": 1 }),
];

const pcCase = (
  id: string, name: string, manufacturer: string, size_class: Case["size_class"], boards: Case["supported_mb_form_factors"],
  psus: Case["supported_psu_form_factors"], max_gpu_length_mm: number, max_cooler_height_mm: number,
  radiator_mm_supported: number[], style_tags: Case["style_tags"],
): Case => ({
  id, name, manufacturer, size_class, supported_mb_form_factors: boards, supported_psu_form_factors: psus,
  max_gpu_length_mm, max_cooler_height_mm, radiator_mm_supported, style_tags, source: SOURCE,
});

export const cases: Case[] = [
  pcCase("fractal-design-north", "Fractal Design North", "Fractal Design", "medium", ["ATX", "Micro-ATX", "Mini-ITX"], ["ATX"], 355, 170, [240, 280, 360], ["clean", "minimal"]),
  pcCase("corsair-4000d-airflow", "Corsair 4000D Airflow", "Corsair", "medium", ["ATX", "Micro-ATX", "Mini-ITX"], ["ATX"], 360, 170, [240, 280, 360], ["minimal", "value"]),
  pcCase("lian-li-lancool-216", "Lian Li LANCOOL 216 RGB", "Lian Li", "large", ["E-ATX", "ATX", "Micro-ATX", "Mini-ITX"], ["ATX"], 392, 180, [240, 280, 360], ["rgb"]),
  pcCase("cooler-master-nr200p", "Cooler Master MasterBox NR200P", "Cooler Master", "small", ["Mini-ITX"], ["SFX", "SFX-L"], 330, 155, [240, 280], ["minimal"]),
];

const air = (
  id: string, name: string, manufacturer: string, supported_sockets: Cooler["supported_sockets"], rated_tdp_w: number | null, height_mm: number,
): Cooler => ({ id, name, manufacturer, type: "air", supported_sockets, rated_tdp_w, height_mm, source: SOURCE });

const ALL_SOCKETS: Cooler["supported_sockets"] = ["AM4", "AM5", "LGA1700", "LGA1851"];

export const coolers: Cooler[] = [
  air("thermalright-peerless-assassin-120-se", "Thermalright Peerless Assassin 120 SE", "Thermalright", ALL_SOCKETS, 245, 155),
  air("cooler-master-hyper-212", "Cooler Master Hyper 212 Black", "Cooler Master", ALL_SOCKETS, null, 159),
  // Low profile, AM5 only, rated for 65 W CPUs.
  air("noctua-nh-l9a-am5", "Noctua NH-L9a-AM5", "Noctua", ["AM5"], 65, 37),
  {
    id: "arctic-liquid-freezer-iii-360", name: "ARCTIC Liquid Freezer III 360", manufacturer: "ARCTIC", type: "aio",
    supported_sockets: ALL_SOCKETS, rated_tdp_w: 300, radiator_mm: 360, source: SOURCE,
  },
];

const drive = (
  id: string, name: string, manufacturer: string, iface: Storage["interface"], form_factor: Storage["form_factor"],
  capacity_gb: number, pcie_gen: number | null, read_mb_s: number,
): Storage => ({ id, name, manufacturer, interface: iface, form_factor, capacity_gb, pcie_gen, read_mb_s, source: SOURCE });

export const storage: Storage[] = [
  drive("samsung-990-pro-2tb", "Samsung 990 PRO 2TB", "Samsung", "NVMe", "M.2-2280", 2000, 4, 7450),
  drive("wd-black-sn850x-1tb", "WD_BLACK SN850X 1TB", "Western Digital", "NVMe", "M.2-2280", 1000, 4, 7300),
  drive("crucial-p3-plus-1tb", "Crucial P3 Plus 1TB", "Crucial", "NVMe", "M.2-2280", 1000, 4, 5000),
  drive("samsung-870-evo-1tb", "Samsung 870 EVO 1TB", "Samsung", "SATA", "2.5in", 1000, null, 560),
];

const CHECKED = "2026-11-20";

// [product ID, USD, retailer]
const PRICE_ROWS: [string, number, string][] = [
  ["ryzen-5-5600x", 129, "Amazon"],
  ["ryzen-7-5700x3d", 199, "Amazon"],
  ["ryzen-5-7600", 189, "Newegg"],
  ["ryzen-7-7800x3d", 379, "Newegg"],
  ["ryzen-7-9800x3d", 479, "Best Buy"],
  ["core-i5-12400f", 109, "Amazon"],
  ["core-i5-14600k", 229, "Newegg"],
  ["core-ultra-7-265k", 299, "Best Buy"],
  ["rtx-3060-12gb--msi-ventus-2x", 449, "Newegg"],
  ["rtx-3060-12gb--evga-xc-gaming", 459, "Amazon"],
  ["rtx-5060-ti-16gb--asus-dual-oc", 779, "Best Buy"],
  ["rtx-5060-ti-16gb--gigabyte-windforce-oc", 789, "Newegg"],
  ["rtx-5070--msi-ventus-2x-oc", 839, "Newegg"],
  ["rtx-5070--founders-edition", 849, "Best Buy"],
  ["rtx-5070-ti--asus-prime-oc", 1120, "Newegg"],
  ["rtx-5070-ti--msi-ventus-3x-oc", 1149, "Amazon"],
  ["rtx-5090--founders-edition", 7000, "Best Buy"],
  ["rtx-5090--asus-rog-astral", 7499, "Newegg"],
  ["rx-9060-xt-16gb--sapphire-pulse", 499, "Newegg"],
  ["rx-9060-xt-16gb--xfx-swift-oc", 509, "Amazon"],
  ["rx-9070-xt--powercolor-reaper", 799, "Newegg"],
  // rx-9070-xt--sapphire-pulse has no price (EDGE_CASES.missing_price).
  ["arc-b580--limited-edition", 329, "Best Buy"],
  ["arc-b580--asrock-challenger-oc", 339, "Newegg"],
  ["msi-mag-b550-tomahawk", 149, "Amazon"],
  ["gigabyte-b650-aorus-elite-ax", 199, "Newegg"],
  ["asus-rog-strix-b650e-i", 329, "Newegg"],
  ["msi-pro-b760m-a-ddr4", 119, "Amazon"],
  ["corsair-vengeance-lpx-32gb-ddr4-3600", 69, "Amazon"],
  ["corsair-vengeance-rgb-pro-16gb-ddr4-3200", 49, "Newegg"],
  ["gskill-flare-x5-32gb-ddr5-6000", 109, "Newegg"],
  ["kingston-fury-beast-rgb-64gb-ddr5-6000", 229, "Amazon"],
  ["corsair-cx450", 54, "Amazon"],
  ["corsair-rm850e", 109, "Newegg"],
  ["corsair-sf750", 169, "Best Buy"],
  ["msi-mag-a1000gl", 139, "Newegg"],
  ["fractal-design-north", 139, "Newegg"],
  ["corsair-4000d-airflow", 94, "Amazon"],
  ["lian-li-lancool-216", 109, "Newegg"],
  ["cooler-master-nr200p", 99, "Amazon"],
  ["thermalright-peerless-assassin-120-se", 35, "Amazon"],
  ["cooler-master-hyper-212", 29, "Amazon"],
  ["noctua-nh-l9a-am5", 45, "Newegg"],
  ["arctic-liquid-freezer-iii-360", 99, "Amazon"],
  ["samsung-990-pro-2tb", 169, "Best Buy"],
  ["wd-black-sn850x-1tb", 89, "Amazon"],
  ["crucial-p3-plus-1tb", 64, "Newegg"],
  ["samsung-870-evo-1tb", 79, "Amazon"],
];

export const prices: Catalog["prices"] = PRICE_ROWS.map(([product_id, price_usd, retailer]) => ({
  product_id, price_usd, retailer, condition: "new", last_checked: CHECKED, url: null, source: SOURCE,
}));

export const fixtureCatalog: Catalog = {
  cpus, gpu_families, gpu_variants, motherboards, memory, psus, cases, coolers, storage, prices,
};

// Part pairs that M2 and M4 tests should flag. Each is the only problem in its pair, so a test can
// assert exactly one violation.
export const EDGE_CASES = {
  // 358 mm card; the NR200P fits 330 mm. (It also needs a 1000 W PSU, so test gpu_length alone.)
  oversized_gpu: { gpu: "rtx-5090--asus-rog-astral", case: "cooler-master-nr200p" },
  // DDR4 kit on a DDR5 board.
  memory_mismatch: { memory: "corsair-vengeance-lpx-32gb-ddr4-3600", motherboard: "gigabyte-b650-aorus-elite-ax" },
  // 450 W PSU for a card that recommends 650 W. Connectors match (one 8-pin), so only wattage fails.
  underpowered_psu: { psu: "corsair-cx450", gpu: "rtx-5070--msi-ventus-2x-oc" },
  // In stock nowhere: no Price record. The engine must exclude it.
  missing_price: "rx-9070-xt--sapphire-pulse",
  // Nullable fields that should make rules return "unknown".
  unknown_gpu_length: "rtx-5060-ti-16gb--gigabyte-windforce-oc",
  uncurated_cpu_support: "msi-pro-b760m-a-ddr4",
} as const;
