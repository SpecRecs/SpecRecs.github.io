import { useEffect, useMemo, useRef } from "react";
import { loadBuild } from "../../build/store.ts";
import { date, pct, usd } from "../../explanations/index.ts";
import { DEFAULT_ENGINE_CONFIG, explain, explainWarning, recommend } from "../../recommendation/index.ts";
import type { Recommendation } from "../../types/recommendation.ts";
import type { UserRequest } from "../../types/request.ts";
import { matchCurrent } from "./current.ts";
import {
  CATALOG, CATALOG_IS_SAMPLE, CATEGORY_LABEL, COMPONENT_LABEL, RESOLUTION_LABEL, emptyMessage, isGaming, partNames,
} from "./view.ts";

const MY_PC_PAGE = "build.html";

interface Props {
  request: UserRequest;
  onEditAnswers: () => void;
  onStartOver: () => void;
}

export function Results({ request, onEditAnswers, onStartOver }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const upgrade = request.mode === "upgrade";
  const current = useMemo(() => (upgrade ? matchCurrent(loadBuild(), CATALOG) : null), [upgrade]);
  const recs = useMemo(
    () => recommend(current ? { ...request, current_system: current.system } : request, CATALOG),
    [request, current],
  );
  const nameOf = useMemo(() => partNames(CATALOG), []);

  return (
    <section className="recs-page">
      <h2 ref={heading} tabIndex={-1}>{upgrade ? "Your upgrade options" : "Your build options"}</h2>
      {CATALOG_IS_SAMPLE && (
        <p className="notice">Sample data: these parts and prices come from a small test catalog until the full catalog is published.</p>
      )}
      {current && <CurrentParts matched={current.matched} unmatched={current.unmatched} />}

      {recs.length === 0
        ? <p className="panel lead">{emptyMessage(request, DEFAULT_ENGINE_CONFIG)}</p>
        : (
          <div className="recs">
            {recs.map((r) => <Card key={r.parts.map((p) => p.part_id).join("|")} rec={r} request={request} nameOf={nameOf} />)}
          </div>
        )}

      <div className="actions">
        <button type="button" onClick={onStartOver}>Start over</button>
        {upgrade && <a className="button" href={MY_PC_PAGE}>Edit current parts</a>}
        <button type="button" onClick={onEditAnswers}>Edit answers</button>
      </div>
    </section>
  );
}

function CurrentParts({ matched, unmatched }: { matched: string[]; unmatched: string[] }) {
  if (matched.length + unmatched.length === 0) {
    return (
      <p className="notice">
        You haven't added your current parts, so these options can't build on them.{" "}
        <a href={MY_PC_PAGE}>Add them on the My PC page</a>.
      </p>
    );
  }
  return (
    <div className="notice">
      {matched.length > 0 && <p>Comparing against your {matched.join(", ")}.</p>}
      {unmatched.length > 0 && (
        <p>Not in our catalog yet: {unmatched.join(", ")}. We assume they work and list what to check.</p>
      )}
    </div>
  );
}

function Card({ rec, request, nameOf }: { rec: Recommendation; request: UserRequest; nameOf: (id: string) => string }) {
  const gaming = rec.perf_estimate.gaming;
  const { single, multi } = rec.perf_estimate;
  return (
    <article className="rec">
      <div className="badges">
        {rec.categories.map((c) => <span key={c} className={`badge ${c}`}>{CATEGORY_LABEL[c]}</span>)}
      </div>
      <p className="rec-total">
        {usd(rec.total_cost_usd)}
        {rec.gain_pct !== null && <span className="gain">{pct(rec.gain_pct)}</span>}
      </p>
      {isGaming(request) && gaming ? (
        <p className="rec-perf">
          About {gaming.fps} FPS at {RESOLUTION_LABEL[gaming.resolution]}
          <span className="muted"> · limited by the {gaming.limited_by.toUpperCase()}</span>
        </p>
      ) : single !== null && multi !== null && (
        <p className="rec-perf">
          CPU single-thread {single}, multi-thread {multi}
          <span className="muted"> (Ryzen 5 5600X = 100)</span>
        </p>
      )}

      <ul className="rec-parts">
        {rec.parts.map((p) => (
          <li key={p.component}>
            <span className="part-kind">{COMPONENT_LABEL[p.component]}</span>
            <span className="part-name">{nameOf(p.part_id)}</span>
            <span className="part-price">{usd(p.price_usd)}</span>
            <span className="part-meta">
              {p.retailer} · checked {date(p.last_checked)}
              {p.replaces && <> · replaces your {p.replaces}</>}
            </span>
          </li>
        ))}
      </ul>

      <h3>Why this build</h3>
      <ul className="reasons">{rec.reasons.map((r, i) => <li key={i}>{explain(r)}</li>)}</ul>

      {rec.warnings.length > 0 && (
        <>
          <h3>Check before buying</h3>
          <ul className="warnings">{rec.warnings.map((w, i) => <li key={i}>{explainWarning(w, nameOf)}</li>)}</ul>
        </>
      )}
    </article>
  );
}
