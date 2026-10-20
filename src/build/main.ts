import "./build.css";
import { isAbort, isDatasetLoaded, runSearch } from "./search.ts";
import { SOURCES } from "./sources.ts";
import { loadBuild, saveBuild } from "./store.ts";
import type { Part, Perf, Source } from "./types.ts";

// ---- state ----
// build[category] = array of parts
const build = loadBuild();

// ---- DOM helpers ----
type Child = Node | string | null | undefined | false;
type Props = Record<string, string | ((e: Event) => void)>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c): c is Node | string => c != null && c !== false));
  return node;
}

function renderSummary() {
  const summary = document.getElementById("summary")!;
  summary.replaceChildren(
    ...Object.entries(SOURCES).map(([key, src]) => {
      const n = (build[key] || []).length;
      return el("span", { class: `chip${n ? " done" : ""}` }, `${src.label}${n ? ` ✓${n > 1 ? ` ×${n}` : ""}` : ""}`);
    })
  );
}

function perfBar(p: Perf) {
  return el("div", { class: "perf" },
    `${p.label}: ${Number(p.value).toLocaleString()}${p.note ? ` (${p.note})` : ""}`,
    el("div", { class: "perf-bar", ...(p.scale ? { title: p.scale } : {}) },
      el("div", { style: `width:${Math.min(100, (p.value / p.max) * 100)}%` })));
}

function renderParts(key: string, container: HTMLElement) {
  const parts = build[key] || [];
  container.replaceChildren(
    ...parts.map((part, i) => {
      const rows = part.specs.filter(([, v]) => v != null && v !== "" && v !== false);
      const credits = [part.source && `Specs: ${part.source}`, part.bench && "Score: Blender Open Data"].filter(Boolean);
      return el("div", { class: "part" },
        el("div", { class: "part-head" },
          el("div", {},
            part.url
              ? el("a", { class: "part-name", href: part.url, target: "_blank", rel: "noopener", style: "color:inherit" }, part.name)
              : el("div", { class: "part-name" }, part.name),
            part.subtitle && el("div", { class: "part-sub" }, part.subtitle)),
          el("button", { type: "button", "aria-label": `Remove ${part.name}`, onclick: () => {
            parts.splice(i, 1);
            build[key] = parts;
            saveBuild(build);
            renderParts(key, container);
            renderSummary();
          } }, "Remove")),
        ...[part.perf, part.bench].filter((p): p is Perf => !!p).map(perfBar),
        el("dl", { class: "specs" }, ...rows.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, String(v))])),
        credits.length > 0 && el("div", { class: "part-src" }, credits.join(" · ")));
    })
  );
}

function setPart(key: string, src: Source, part: Part, container: HTMLElement) {
  build[key] = src.multiple ? [...(build[key] || []), part] : [part];
  saveBuild(build);
  renderParts(key, container);
  renderSummary();
}

// ---- manual-entry form (standalone card for "manual" sources, fallback for "dataset" ones) ----
function buildManualForm(key: string, src: Source, parts: HTMLElement) {
  const { fields = [], summarize } = src;
  const form = el("form", { class: "manual" },
    ...fields.map((f) => {
      const control = f.options
        ? el("select", { name: f.key }, el("option", { value: "" }, "—"), ...f.options.map((o) => el("option", { value: o }, o)))
        : el("input", { name: f.key, type: f.type || "text" });
      return el("label", {}, f.label, control);
    }),
    el("button", { type: "submit", class: "primary" }, "Save"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (!summarize || !Object.values(values).some(Boolean)) return;
    setPart(key, src, summarize(values), parts);
    form.reset();
  });
  return form;
}

// ---- search card (tpu + dataset sources) ----
function buildSearchCard(key: string, src: Source) {
  const input = el("input", { type: "text", placeholder: `Search ${src.label} (e.g. ${src.example})`, "aria-label": `Search ${src.label}`, autocomplete: "off" });
  const results = el("ul", { class: "results", role: "listbox" });
  const parts = el("div", { class: "parts" });
  const hasFallback = src.kind === "tpu" && !!src.fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const showNote = (msg: string) => results.replaceChildren(el("li", { class: "note" }, msg));

  async function search(q: string) {
    controller?.abort();
    const current = (controller = new AbortController());
    showNote(src.kind === "dataset" && !isDatasetLoaded(src.file) ? "Loading parts…" : "Searching…");
    try {
      const { parts: found, more, freeTierOnly } = await runSearch(src, q, current.signal);
      if (current.signal.aborted) return;
      if (!found.length) return showNote(freeTierOnly && !hasFallback ? "No matches in the free dataset." : `No matches. ${more}`.trim());
      const items = found.map((part) =>
        el("li", { tabindex: "0", role: "option", onclick: () => pick(part), onkeydown: (e) => { if ((e as KeyboardEvent).key === "Enter") pick(part); } },
          part.name, el("small", {}, [part.subtitle, hasFallback && part.source].filter(Boolean).join(" · "))));
      if (more) items.push(el("li", { class: "note" }, more));
      results.replaceChildren(...items);
    } catch (err) {
      if (isAbort(err)) return;
      showNote(src.kind === "dataset" ? "Couldn't load the parts list. Try again." : "Couldn't reach TechPowerUp. Check your connection and try again.");
    }
  }

  function pick(part: Part) {
    setPart(key, src, part, parts);
    results.replaceChildren();
    input.value = "";
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { controller?.abort(); results.replaceChildren(); return; }
    timer = setTimeout(() => search(q), src.kind === "dataset" ? 150 : 300);
  });

  renderParts(key, parts);
  return el("section", { class: "card" },
    el("h2", {}, src.label),
    el("div", { class: "search" }, input, results),
    parts,
    src.multiple && el("p", { class: "hint" }, "Search again to add more drives."),
    src.fields && el("details", { class: "fallback" },
      el("summary", {}, "Can't find it? Enter manually"),
      buildManualForm(key, src, parts)));
}

function buildManualCard(key: string, src: Source) {
  const parts = el("div", { class: "parts" });
  renderParts(key, parts);
  return el("section", { class: "card" }, el("h2", {}, src.label),
    el("p", { class: "hint" }, "Not in a parts database yet. Enter manually."),
    buildManualForm(key, src, parts), parts);
}

// ---- init ----
const main = document.getElementById("categories")!;
for (const [key, src] of Object.entries(SOURCES) as [string, Source][]) {
  main.append(src.kind === "manual" ? buildManualCard(key, src) : buildSearchCard(key, src));
}
renderSummary();
