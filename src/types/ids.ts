// Canonical part IDs are model slugs, so they stay stable when upstream data changes and the same
// part joins across specs, scores and prices. Conventions (the pipeline maps each source to these):
//   CPU         model without the brand:          "ryzen-5-5600x", "core-i5-12400f", "core-ultra-7-265k"
//   GPU family  chip model without the brand;      "rtx-5070", "rx-9070-xt", "arc-b580",
//               VRAM suffix when a model has two:  "rtx-3060-12gb", "rx-9060-xt-16gb"
//   GPU variant family + "--" + board model:      "rtx-5070--msi-ventus-2x-oc"
//   Other parts manufacturer + model:             "msi-mag-b550-tomahawk", "corsair-rm850e"
import type { Id } from "./common.ts";

// One or more lowercase alphanumeric words joined by "-", optionally followed by "--" and a second
// such group (GPU variants only).
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

export function isId(value: string): boolean {
  return ID_PATTERN.test(value);
}

// "MSI Ventus 2X OC" -> "msi-ventus-2x-oc". Accents and trademark signs are dropped, and "+" becomes
// "plus". The signs go first because NFKD would turn "™" into "TM".
export function slugify(text: string): string {
  return text
    .replace(/[\u2122\u00ae\u00a9]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function variantId(familyId: Id, boardModel: string): Id {
  return `${familyId}--${slugify(boardModel)}`;
}
