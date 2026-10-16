"use client";

import Link from "next/link";
import { useState } from "react";
import type { ModSummary, ReviewView } from "@/lib/data";
import { CATEGORIES, METRICS, fullLabel } from "@/lib/metrics";
import { categoryAverage, combinedTotal, formatScore, isScore, reviewTotal } from "@/lib/scoring";
import { deleteModAction, deleteReviewAction } from "@/app/actions";
import { catStyle, Medal } from "./Medal";
import { useMetrics } from "./MetricsProvider";

interface Props {
  mod: ModSummary;
  reviews: ReviewView[];
  viewerId: string | null;
  admin: boolean;
}

export function ModDetail({ mod, reviews, viewerId, admin }: Props) {
  const { enabled, enabledIds } = useMetrics();
  const total = combinedTotal(mod.stats, enabledIds);
  const counted = enabledIds.filter((id) => mod.stats[id]).length;
  const mine = reviews.find((r) => r.steamId === viewerId);
  const sorted = [...reviews].sort((a, b) => Number(b.steamId === viewerId) - Number(a.steamId === viewerId));
  const workshopUrl = `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshopId}`;
  const reviewHref = `/mods/${mod.id}/review`;
  const writeLink = viewerId
    ? <Link className="btn primary" href={reviewHref}>{mine ? "Edit your review" : "Write a review"}</Link>
    : <a className="btn steam" href={`/api/auth/steam/login?next=${encodeURIComponent(reviewHref)}`}>Sign in with Steam to review</a>;

  return (
    <>
      <Link className="back" href="/">← All mods</Link>
      <div className="modhead">
        {mod.previewUrl ? <img className="preview" src={mod.previewUrl} alt={`${mod.title} Workshop preview`} /> : null}
        <div>
          <h2>{mod.title}</h2>
          <div className="meta num">
            {[mod.creatorName ? `by ${mod.creatorName}` : null,
              mod.reviewCount ? `${mod.reviewCount} ${mod.reviewCount === 1 ? "review" : "reviews"}` : "No reviews yet",
              `${counted} of ${METRICS.length} metrics counted`].filter(Boolean).join(" · ")}
          </div>
          {mod.description ? <p className="desc">{mod.description.length > 300 ? mod.description.slice(0, 300) + "…" : mod.description}</p> : null}
          <div className="actions">
            {writeLink}
            <a className="btn" href={workshopUrl} target="_blank" rel="noopener noreferrer">Steam Workshop page ↗</a>
            {admin ? <ConfirmAction label="Remove mod" prompt={`Remove ${mod.title} and all its reviews?`} action={deleteModAction} fields={{ modId: mod.id }} /> : null}
          </div>
        </div>
        <Medal value={total} size="lg" />
      </div>

      <div className="section-title">
        <h3>Combined review</h3>
        <span>Average of every review, per metric. Numbers in brackets are how many reviewers scored it.</span>
      </div>
      <div className="breakdown">
        {CATEGORIES.map((c) => {
          const a = categoryAverage(mod.stats, c.key, enabled);
          return (
            <div key={c.key} className="catblock" style={catStyle(c.key)}>
              <div className="catblock-head"><h4>{c.name}</h4><b className="num">{a.off ? "off" : formatScore(a.value)}</b></div>
              {c.metrics.map((m) => {
                const s = mod.stats[m.id];
                return (
                  <div key={m.id} className={`mrow${enabled.has(m.id) ? "" : " off"}`} title={m.question}>
                    <span>{m.label} <span className="n num">{s ? `(${s.n})` : ""}</span></span>
                    <span className="track"><span className="fill" style={{ width: `${(s?.avg ?? 0) * 10}%` }} /></span>
                    <span className="v num">{formatScore(s?.avg)}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <h3>Individual reviews</h3>
        <span className="num">{reviews.length} logged</span>
      </div>
      {sorted.length ? (
        <div className="reviews">
          {sorted.map((r) => <ReviewCard key={r.id} r={r} modId={mod.id} mine={r.steamId === viewerId} admin={admin} />)}
        </div>
      ) : (
        <div className="empty">
          <h3>No reviews yet</h3>
          <p>Once players post reviews, the combined score above is built from the average of each metric across all of them.</p>
          {writeLink}
        </div>
      )}
    </>
  );
}

function ReviewCard({ r, modId, mine, admin }: { r: ReviewView; modId: string; mine: boolean; admin: boolean }) {
    const { enabled, enabledIds } = useMetrics();
    const t = reviewTotal(r.scores, enabledIds);
    const n = enabledIds.filter((id) => isScore(r.scores[id])).length;
    const hours = r.playtimeMinutes != null ? Math.round(r.playtimeMinutes / 60) : null;
    return (
      <article className={`review${mine ? " mine" : ""}`}>
        <div className="review-head">
          <Medal value={t} size="sm" />
          <div className="who">
            {r.avatarUrl ? <img src={r.avatarUrl} alt="" /> : null}
            <div>
              <strong>{r.profileUrl ? <a href={r.profileUrl} target="_blank" rel="noopener noreferrer">{r.personaName}</a> : r.personaName}</strong>
              {mine ? <span className="tag">You</span> : null}
              <div className="by num">
                {[r.a10Runs != null ? `${r.a10Runs} A10 ${r.a10Runs === 1 ? "run" : "runs"}` : null, `${n} metrics counted`, new Date(r.updatedAt).toLocaleDateString()].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          {r.ownsGame ? <span className="badge ok">Owns STS2{hours != null ? ` · ${hours}h played` : ""}</span>
            : r.ownsGame === null ? <span className="badge">Game list private</span> : null}
          {mine ? (
            <span className="actions">
              <Link className="btn small" href={`/mods/${modId}/review`}>Edit</Link>
              <ConfirmAction label="Delete" prompt="Delete your review?" action={deleteReviewAction} fields={{ reviewId: r.id, modId }} />
            </span>
          ) : admin ? (
            <ConfirmAction label="Remove" prompt="Remove this review?" action={deleteReviewAction} fields={{ reviewId: r.id, modId, asAdmin: "1" }} />
          ) : null}
        </div>
        {r.notes ? <p className="notes">{r.notes}</p> : null}
        <details>
          <summary>All scores</summary>
          <div className="scoregrid">
            {METRICS.map((m) => (
              <div key={m.id} className={enabled.has(m.id) ? "" : "off"} style={catStyle(m.cat)}>
                <span>{fullLabel(m)}</span>
                <span className="num">{formatScore(r.scores[m.id])}</span>
              </div>
            ))}
          </div>
        </details>
      </article>
    );
}

/** A small button that asks for confirmation inline before submitting a server action. */
function ConfirmAction({ label, prompt, action, fields }: {
  label: string; prompt: string; action: (f: FormData) => Promise<void>; fields: Record<string, string>;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  if (!asking) return <button type="button" className="btn small danger" onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span className="confirm">
      <span>{prompt}</span>
      <form action={async (f) => { setPending(true); await action(f); setPending(false); setAsking(false); }}>
        {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <button type="submit" className="btn small danger" disabled={pending}>{pending ? "Working…" : label}</button>
      </form>
      <button type="button" className="btn small" onClick={() => setAsking(false)}>Keep</button>
    </span>
  );
}
