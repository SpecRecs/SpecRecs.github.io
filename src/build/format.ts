type Num = number | null | undefined;

export const fmt = (n: Num, unit = "") => (n == null ? "—" : `${Number(n).toLocaleString()}${unit}`);
export const fmtMem = (mb: Num) => (mb == null ? "—" : mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`);
export const fmtCache = (kb: Num) => (kb == null ? "—" : kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`);
export const fmtCap = (gb: Num) => (gb == null ? "—" : gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`);

export const EFFICIENCY: Record<string, string> = {
  plus: "80+", bronze: "80+ Bronze", silver: "80+ Silver", gold: "80+ Gold",
  platinum: "80+ Platinum", titanium: "80+ Titanium",
};

// Reduces a CPU or GPU name to its model so names from different sources line up:
// "Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz", "Intel Core i7-8700K" and "Core i7-8700K" all become "i7 8700k".
export const modelKey = (name: string) =>
  name.toLowerCase()
    .replace(/\((r|tm)\)|®|™/g, " ")
    .replace(/\b\d+(st|nd|rd|th) gen\b/g, " ")
    .replace(/(\bcpu )?@ [\d.]+ ?ghz/g, " ")
    .replace(/\b\w+-core processor\b/g, " ")
    .replace(/\bwith radeon( vega)? graphics\b/g, " ")
    .replace(/\b(nvidia|amd|ati|intel|geforce|radeon|core|processor|graphics|gpu)\b/g, " ")
    .replace(/(\d+)\s*gb\b/g, "$1gb")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const withoutMemSize = (key: string) => key.replace(/\s*\b\d+gb\b/g, "").trim();
