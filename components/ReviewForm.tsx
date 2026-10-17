"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CATEGORIES, METRICS } from "@/lib/metrics";
import { formatScore, isScore, METRIC_NOTE_MAX, reviewTotal, type MetricNotes, type Scores } from "@/lib/scoring";
import { saveReviewAction } from "@/app/actions";
import type { RunStats } from "@/lib/data";
import { isVerified, VERIFY_RULE } from "@/lib/runs";
import { catStyle, Medal } from "./Medal";
import { useMetrics } from "./MetricsProvider";

interface Props {
  modId: string;
  modTitle: string;
  verified: RunStats | null;
  existing: { notes: string; scores: Scores; metricNotes: MetricNotes } | null;
}

export function ReviewForm({ modId, modTitle, verified, existing }: Props) {
  const { enabledIds } = useMetrics();
  const [scores, setScores] = useState<Scores>(existing?.scores ?? {});
  // Controlled, so a failed save doesn't clear what the player typed (React resets uncontrolled fields after an action).
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [metricNotes, setMetricNotes] = useState<MetricNotes>(existing?.metricNotes ?? {});
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set(Object.keys(existing?.metricNotes ?? {})));
  const [state, formAction, pending] = useActionState(saveReviewAction, null);

  const scored = METRICS.filter((m) => isScore(scores[m.id])).length;
  const counted = enabledIds.filter((id) => isScore(scores[id])).length;
  const setScore = (id: string, v: number | null) =>
    setScores((s) => {
      const next = { ...s };
      if (v == null) delete next[id]; else next[id] = v;
      return next;
    });

  return (
    <form className="form" action={formAction}>
      <h2>{existing ? "Edit your review of " : "Review "}{modTitle}</h2>
      <p className="scale-note">
        Score each metric from 0 to 10 in steps of 0.5, where 10 is the best a character could do on that metric. For Snowballing and
        Outliers, a high score means the problem is well controlled. Leave a metric on “—” if you can’t judge it yet; it won’t count toward any average.
      </p>
      <input type="hidden" name="modId" value={modId} />
      <input type="hidden" name="scores" value={JSON.stringify(scores)} />
      <input type="hidden" name="metricNotes" value={JSON.stringify(metricNotes)} />

      <p className="notice num">
        {isVerified(verified)
          ? <>Your review will show as <strong>Verified</strong>, with your {verified!.a10Runs} A10 {verified!.a10Runs === 1 ? "run" : "runs"} on this character. </>
          : <>Your review will show as unverified until you scan runs from your profile: it needs {VERIFY_RULE}{verified ? ` (you have ${verified.a10Runs} A10 ${verified.a10Runs === 1 ? "run" : "runs"})` : ""}. </>}
        <Link href="/profile">{verified ? "Rescan your runs" : "Scan your runs"}</Link>
      </p>

      {CATEGORIES.map((c) => (
        <fieldset key={c.key} className="cat" style={catStyle(c.key)}>
          <legend>{c.name}</legend>
          {c.metrics.map((m) => {
            const v = scores[m.id];
            const set = isScore(v);
            return (
              <div key={m.id} className="metric-in">
                <label htmlFor={`s-${m.id}`}>{m.label}</label>
                <p id={`d-${m.id}`}>{m.question}</p>
                <div className="slider">
                  <input
                    id={`s-${m.id}`}
                    type="range" min={0} max={10} step={0.5}
                    value={set ? v : 5}
                    className={set ? "" : "unset"}
                    aria-describedby={`d-${m.id}`}
                    aria-valuetext={set ? `${formatScore(v)} out of 10` : "Not scored"}
                    onChange={(e) => setScore(m.id, Number(e.target.value))}
                    // A click on an unscored slider at its resting position still counts as scoring it.
                    onPointerUp={(e) => { if (!set) setScore(m.id, Number((e.target as HTMLInputElement).value)); }}
                  />
                  <output htmlFor={`s-${m.id}`} className={set ? "" : "unset"}>{set ? formatScore(v) : "—"}</output>
                  <button type="button" className="btn small" onClick={() => setScore(m.id, null)} disabled={!set}>Clear</button>
                </div>
                {set && openNotes.has(m.id) ? (
                  <div className="metric-note">
                    <label htmlFor={`n-${m.id}`} className="sr-only">Note explaining your {m.label} score</label>
                    <textarea
                      id={`n-${m.id}`}
                      maxLength={METRIC_NOTE_MAX}
                      placeholder={`Why ${formatScore(v)} for ${m.label.toLowerCase()}? Readers see this when they hover your score.`}
                      value={metricNotes[m.id] ?? ""}
                      onChange={(e) => setMetricNotes((n) => ({ ...n, [m.id]: e.target.value }))}
                    />
                    <span className="hint num">{(metricNotes[m.id] ?? "").length}/{METRIC_NOTE_MAX}</span>
                  </div>
                ) : set ? (
                  <button type="button" className="linkish note-add" onClick={() => setOpenNotes((o) => new Set(o).add(m.id))}>
                    Add a note explaining this score
                  </button>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ))}

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <span className="hint">Optional. Standout cards, archetypes that worked, anything other A10 players should know.</span>
        <textarea id="notes" name="notes" maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="submitbar">
        <div className="pv">
          <Medal value={reviewTotal(scores, enabledIds)} size="sm" />
          <div><strong>Your total</strong>{scored} of {METRICS.length} metrics scored · {counted} counted</div>
        </div>
        {state?.error ? <p className="err" role="alert">{state.error}</p> : null}
        <Link className="btn" href={`/mods/${modId}`}>Cancel</Link>
        <button type="submit" className="btn primary" disabled={pending || scored === 0}>
          {pending ? "Saving…" : existing ? "Save changes" : "Post review"}
        </button>
      </div>
    </form>
  );
}
