import { defineConfig } from "vite";

// SpecRecs.github.io is served from the domain root, so base stays "/".
// Each HTML page at the repo root is an entry point; data/*.json is copied from public/ as-is.
export default defineConfig({
  base: "/",
  build: {
    rolldownOptions: {
      input: { index: "index.html", build: "build.html" },
    },
  },
});
