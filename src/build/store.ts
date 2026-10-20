import type { Build } from "./types.ts";

// Same key as the pre-Vite page, so builds saved before the port still load.
const STORAGE_KEY = "specrecs.build.v1";

export function loadBuild(): Build {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (raw && typeof raw === "object") return raw as Build;
  } catch {}
  return {};
}

export function saveBuild(build: Build) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(build)); } catch {}
}
