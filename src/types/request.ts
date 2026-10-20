// The user's answers to the questionnaire: the `user_request` entity in docs/agent-plan.md §5.
// Every field is optional so a half-finished questionnaire can be saved and resumed.
// current_system is not here yet: the My PC page saves it separately (src/build/store.ts).

export type Mode = "new" | "upgrade";
export type Purpose = "gaming" | "gaming_streaming" | "general" | "productivity";
export type Resolution = "1080p" | "1440p" | "4k";
export type SizePref = "small" | "medium" | "large" | "none";
export type StylePref = "rgb" | "minimal" | "clean" | "value" | "none";

export interface UserRequest {
  mode?: Mode;
  purpose?: Purpose;
  budget_max_usd?: number;
  budget_preferred_usd?: number;
  resolution?: Resolution;
  size_pref?: SizePref;
  style_pref?: StylePref;
  // ISO timestamp set when the user finishes the questionnaire.
  completed_at?: string;
}
