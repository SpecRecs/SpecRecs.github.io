// Values shared by several entities. Units are in field names; `| null` means "unknown", and
// engines must treat it as unknown, never as a pass (docs/agent-plan.md §6, M2).

// Canonical part ID: a model slug such as "ryzen-5-7600" or "rtx-4070--asus-dual". See ids.ts.
export type Id = string;

// ISO 8601 date ("2026-11-25") or timestamp.
export type IsoDate = string;

export const PART_CATEGORIES = ["cpu", "gpu", "motherboard", "memory", "psu", "case", "cooler", "storage"] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export const SOCKETS = ["AM4", "AM5", "LGA1200", "LGA1700", "LGA1851"] as const;
export type Socket = (typeof SOCKETS)[number];

export const MEMORY_TYPES = ["DDR4", "DDR5"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const BOARD_FORM_FACTORS = ["E-ATX", "ATX", "Micro-ATX", "Mini-ITX"] as const;
export type BoardFormFactor = (typeof BOARD_FORM_FACTORS)[number];

export const PSU_FORM_FACTORS = ["ATX", "SFX", "SFX-L"] as const;
export type PsuFormFactor = (typeof PSU_FORM_FACTORS)[number];

// A PSU's 6+2-pin cables are counted as pcie_8pin; they also fit 6-pin sockets.
export const POWER_CONNECTORS = ["pcie_6pin", "pcie_8pin", "12v_2x6"] as const;
export type PowerConnector = (typeof POWER_CONNECTORS)[number];

// Connector counts, e.g. { pcie_8pin: 2 }. A missing key means zero.
export type ConnectorCounts = Partial<Record<PowerConnector, number>>;

// Case size, matched against UserRequest.size_pref.
export const SIZE_CLASSES = ["small", "medium", "large"] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

// Case looks, matched against UserRequest.style_pref.
export const STYLE_TAGS = ["rgb", "minimal", "clean", "value"] as const;
export type StyleTag = (typeof STYLE_TAGS)[number];
