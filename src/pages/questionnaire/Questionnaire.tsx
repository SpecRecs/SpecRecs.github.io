import { useEffect, useRef, useState } from "react";
import type { UserRequest } from "../../types/request.ts";
import { clean, labelFor, stepError, visibleSteps, type Step } from "./flow.ts";
import { clearRequest, loadRequest, saveRequest } from "./store.ts";

// Where upgraders enter their current parts. New builds never go there.
const MY_PC_PAGE = "build.html";

export function Questionnaire() {
  const [request, setRequest] = useState<UserRequest>(loadRequest);
  const steps = visibleSteps(request);
  const reviewIndex = steps.length - 1;
  // A returning user who already finished lands on the review step (or the done screen for new builds).
  const [index, setIndex] = useState(() => (request.completed_at ? reviewIndex : 0));
  const [done, setDone] = useState(() => !!request.completed_at && request.mode === "new");
  const [showError, setShowError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const step = steps[Math.min(index, reviewIndex)];
  const error = stepError(step, request);

  useEffect(() => { heading.current?.focus(); }, [index, done]);

  function update(patch: Partial<UserRequest>) {
    const next = clean({ ...request, ...patch });
    delete next.completed_at;
    setRequest(next);
    saveRequest(next);
    setShowError(false);
  }

  function goTo(i: number) {
    setIndex(i);
    setShowError(false);
  }

  function next() {
    if (error) return setShowError(true);
    if (step.kind !== "review") return goTo(index + 1);
    const finished = { ...request, completed_at: new Date().toISOString() };
    saveRequest(finished);
    setRequest(finished);
    if (finished.mode === "upgrade") window.location.href = MY_PC_PAGE;
    else setDone(true);
  }

  function startOver() {
    clearRequest();
    setRequest({});
    setDone(false);
    goTo(0);
  }

  if (done) {
    return (
      <section className="panel">
        <h2 ref={heading} tabIndex={-1}>You're all set</h2>
        <p className="lead">Build recommendations are coming soon. We've saved your answers in this browser.</p>
        <Summary steps={steps} request={request} />
        <div className="actions">
          <button type="button" onClick={startOver}>Start over</button>
          <button type="button" onClick={() => { setDone(false); goTo(reviewIndex); }}>Edit answers</button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="progress" aria-label={`Step ${index + 1} of ${steps.length}`}>
        <div style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="step-count">Step {index + 1} of {steps.length}</p>
      <h2 ref={heading} tabIndex={-1}>{step.title}</h2>

      {step.kind === "choice" && (
        <fieldset className="choices">
          <legend className="sr-only">{step.title}</legend>
          {step.choices.map((c) => (
            <label key={c.value} className={`choice${request[step.field] === c.value ? " selected" : ""}`}>
              <input
                type="radio"
                name={step.field}
                value={c.value}
                checked={request[step.field] === c.value}
                onChange={() => update({ [step.field]: c.value })}
              />
              <span className="choice-label">{c.label}</span>
              {c.hint && <span className="choice-hint">{c.hint}</span>}
            </label>
          ))}
        </fieldset>
      )}

      {step.kind === "budget" && <BudgetFields request={request} update={update} />}

      {step.kind === "review" && (
        <Summary steps={steps} request={request} onEdit={(i) => goTo(i)} />
      )}

      {showError && error && <p className="error" role="alert">{error}</p>}

      <div className="actions">
        {index > 0 && <button type="button" onClick={() => goTo(index - 1)}>Back</button>}
        <button type="button" className="primary" onClick={next}>
          {step.kind !== "review" ? "Next" : request.mode === "upgrade" ? "Next: enter your current parts" : "Finish"}
        </button>
      </div>
    </section>
  );
}

function BudgetFields({ request, update }: { request: UserRequest; update: (p: Partial<UserRequest>) => void }) {
  // Number inputs report "" while empty; store that as "not answered".
  const toUsd = (s: string) => (s === "" ? undefined : Number(s));
  return (
    <div className="budget">
      <label>
        Maximum budget (USD)
        <input
          type="number" inputMode="numeric" min={1} step={50} placeholder="e.g. 1500"
          value={request.budget_max_usd ?? ""}
          onChange={(e) => update({ budget_max_usd: toUsd(e.target.value) })}
        />
      </label>
      <label>
        Preferred spend (optional)
        <input
          type="number" inputMode="numeric" min={1} step={50} placeholder="e.g. 1200"
          value={request.budget_preferred_usd ?? ""}
          onChange={(e) => update({ budget_preferred_usd: toUsd(e.target.value) })}
        />
        <span className="field-hint">Where you'd like to land. We'll never go over your maximum.</span>
      </label>
    </div>
  );
}

function Summary({ steps, request, onEdit }: { steps: Step[]; request: UserRequest; onEdit?: (i: number) => void }) {
  return (
    <dl className="summary-list">
      {steps.map((s, i) => s.kind !== "review" && (
        <div key={s.id} className="summary-row">
          <dt>{s.title}</dt>
          <dd>
            {labelFor(s, request)}
            {onEdit && <button type="button" onClick={() => onEdit(i)} aria-label={`Edit: ${s.title}`}>Edit</button>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
