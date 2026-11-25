// The user's answers to the questionnaire: the `user_request` entity in docs/agent-plan.md §5.
// Every field is optional so a half-finished questionnaire can be saved and resumed.
// The My PC page still saves the current build separately (src/build/store.ts); current_system is
// the shape the engine reads once that page feeds it.
import type { Id } from "./common.ts";
import type { Case, Cooler, Cpu, GpuFamily, GpuVariant, Memory, Motherboard, Psu, Storage } from "./parts.ts";

export type Mode = "new" | "upgrade";
export type Purpose = "gaming" | "gaming_streaming" | "general" | "productivity";
export type Resolution = "1080p" | "1440p" | "4k";
export type SizePref = "small" | "medium" | "large" | "none";
export type StylePref = "rgb" | "minimal" | "clean" | "value" | "none";

// A part the user already owns. It may come from the lookup catalog, manual entry, or both.
export interface CurrentPart<T> {
  name: string;
  lookup_id: string | null; // lookup-catalog record ID, if picked from search
  candidate_id: Id | null; // the matching candidate, whose scores stand in for this part
  // Fields known from the lookup record or typed in by the user. Used when there's no candidate, or
  // to fill a candidate's gaps.
  specs: Partial<T>;
}

export interface CurrentSystem {
  cpu?: CurrentPart<Cpu>;
  // candidate_id is a GpuFamily ID (scores); specs may also carry variant fields like length_mm.
  gpu?: CurrentPart<GpuFamily & GpuVariant>;
  motherboard?: CurrentPart<Motherboard>;
  memory?: CurrentPart<Memory>;
  psu?: CurrentPart<Psu>;
  case?: CurrentPart<Case>;
  cooler?: CurrentPart<Cooler>;
  storage?: CurrentPart<Storage>[];
}

export interface UserRequest {
  mode?: Mode;
  purpose?: Purpose;
  budget_max_usd?: number;
  budget_preferred_usd?: number;
  resolution?: Resolution;
  size_pref?: SizePref;
  style_pref?: StylePref;
  // Upgrade mode only.
  current_system?: CurrentSystem;
  // ISO timestamp set when the user finishes the questionnaire.
  completed_at?: string;
}
