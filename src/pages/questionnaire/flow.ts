// Questionnaire steps, choices and validation. No React or DOM, so the flow can be tested in Node.
import type { UserRequest } from "../../types/request.ts";

export interface Choice<V extends string> {
  value: V;
  label: string;
  hint?: string;
}

type ChoiceField = "mode" | "purpose" | "resolution" | "size_pref" | "style_pref";

export type Step =
  | { id: string; kind: "choice"; field: ChoiceField; title: string; choices: Choice<string>[] }
  | { id: "budget"; kind: "budget"; title: string }
  | { id: "review"; kind: "review"; title: string };

export const STEPS: Step[] = [
  {
    id: "mode", kind: "choice", field: "mode", title: "What are you planning?",
    choices: [
      { value: "new", label: "New build", hint: "Start from scratch with all new parts." },
      { value: "upgrade", label: "Upgrade my PC", hint: "Keep what works and replace what doesn't. You'll enter your current parts next." },
    ],
  },
  {
    id: "purpose", kind: "choice", field: "purpose", title: "What will you mostly use it for?",
    choices: [
      { value: "gaming", label: "Gaming" },
      { value: "gaming_streaming", label: "Gaming + streaming" },
      { value: "general", label: "General use", hint: "Browsing, office work, video." },
      { value: "productivity", label: "Productivity", hint: "Editing, rendering, compiling." },
    ],
  },
  { id: "budget", kind: "budget", title: "What's your budget?" },
  {
    id: "resolution", kind: "choice", field: "resolution", title: "What resolution do you game at?",
    choices: [
      { value: "1080p", label: "1080p" },
      { value: "1440p", label: "1440p" },
      { value: "4k", label: "4K" },
    ],
  },
  {
    id: "size", kind: "choice", field: "size_pref", title: "How big should the PC be?",
    choices: [
      { value: "small", label: "Small", hint: "Mini-ITX" },
      { value: "medium", label: "Medium", hint: "Micro-ATX" },
      { value: "large", label: "Large", hint: "ATX" },
      { value: "none", label: "No preference" },
    ],
  },
  {
    id: "style", kind: "choice", field: "style_pref", title: "Any style preference?",
    choices: [
      { value: "rgb", label: "RGB" },
      { value: "minimal", label: "Minimal" },
      { value: "clean", label: "Clean" },
      { value: "value", label: "Maximum price-to-performance" },
      { value: "none", label: "No preference" },
    ],
  },
  { id: "review", kind: "review", title: "Check your answers" },
];

const isGaming = (r: UserRequest) => r.purpose === "gaming" || r.purpose === "gaming_streaming";

// The steps this user sees. Resolution is only asked for gaming purposes.
export const visibleSteps = (r: UserRequest) => STEPS.filter((s) => s.id !== "resolution" || isGaming(r));

// Drops answers that no longer apply, e.g. a resolution left over after switching to "General use".
export function clean(r: UserRequest): UserRequest {
  const out = { ...r };
  if (!isGaming(out)) delete out.resolution;
  return out;
}

// An error message for the step, or "" when the user can move on.
export function stepError(step: Step, r: UserRequest): string {
  if (step.kind === "choice") return r[step.field] ? "" : "Pick one to continue.";
  if (step.kind === "budget") {
    const max = r.budget_max_usd, preferred = r.budget_preferred_usd;
    if (max == null || !(max > 0)) return "Enter your maximum budget.";
    if (preferred != null && !(preferred > 0)) return "Preferred spend must be more than $0, or leave it blank.";
    if (preferred != null && preferred > max) return "Preferred spend can't be more than your maximum.";
  }
  return "";
}

export const labelFor = (step: Step, r: UserRequest): string => {
  if (step.kind === "choice") return step.choices.find((c) => c.value === r[step.field])?.label ?? "—";
  if (step.kind === "budget") {
    const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
    if (r.budget_max_usd == null) return "—";
    return r.budget_preferred_usd != null
      ? `Around ${usd(r.budget_preferred_usd)}, up to ${usd(r.budget_max_usd)}`
      : `Up to ${usd(r.budget_max_usd)}`;
  }
  return "";
};
