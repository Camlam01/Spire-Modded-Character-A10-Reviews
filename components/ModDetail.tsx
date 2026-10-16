"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CommentView, ModSummary, ReviewView } from "@/lib/data";
import { CATEGORIES, METRICS, fullLabel } from "@/lib/metrics";
import { categoryAverage, combinedTotal, formatScore, isScore, reviewTotal } from "@/lib/scoring";
import { deleteModAction, deleteReviewAction } from "@/app/actions";
import { catStyle, Medal } from "./Medal";
import { useMetrics } from "./MetricsProvider";
import { ConfirmAction } from "./ConfirmAction";
import { CommentThread, HelpfulButton } from "./Discussion";
import { CharacterIdsForm } from "./CharacterLink";
import { characterName } from "@/lib/runs";

interface Props {
  mod: ModSummary;
  reviews: ReviewView[];
  comments: CommentView[];
  viewerId: string | null;
  admin: boolean;
}

type ReviewSort = "helpful" | "newest" | "high" | "low";
const SORTS: [ReviewSort, string][] = [["helpful", "Most helpful"], ["newest", "Newest"], ["high", "Highest score"], ["low", "Lowest score"]];

export function ModDetail({ mod, reviews, comments, viewerId, admin }: Props) {
  const { enabled, enabledIds } = useMetrics();
  const [sort, setSort] = useState<ReviewSort>("helpful");
  useEffect(() => {
    try { const s = localStorage.getItem("sts2r:reviewSort") as ReviewSort | null; if (s && SORTS.some(([v]) => v === s)) setSort(s); } catch {}
  }, []);

  const total = combinedTotal(mod.stats, enabledIds);
  const counted = enabledIds.filter((id) => mod.stats[id]).length;
  const mine = reviews.find((r) => r.steamId === viewerId);
  const selfHref = `/mods/${mod.id}`;
  const signInHref = `/api/auth/steam/login?next=${encodeURIComponent(selfHref)}`;
  const reviewHref = `/mods/${mod.id}/review`;
  const workshopUrl = `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshopId}`;
  const writeLink = viewerId
    ? <Link className="btn primary" href={reviewHref}>{mine ? "Edit your review" : "Write a review"}</Link>
    : <a className="btn steam" href={`/api/auth/steam/login?next=${encodeURIComponent(reviewHref)}`}>Sign in with Steam to review</a>;
  const verifyLink = viewerId ? <Link className="btn" href="/profile">Your runs</Link> : null;

  const commentsByReview = useMemo(() => {
    const m = new Map<string, CommentView[]>();
    for (const c of comments) {
      const k = c.reviewId ?? "combined";
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [comments]);

  const sorted = useMemo(() => {
    const score = (r: ReviewView) => reviewTotal(r.scores, enabledIds) ?? -1;
    const by: Record<ReviewSort, (a: ReviewView, b: ReviewView) => number> = {
      helpful: (a, b) => b.helpful - a.helpful || b.updatedAt.localeCompare(a.updatedAt),
      newest: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      high: (a, b) => score(b) - score(a),
      low: (a, b) => score(a) - score(b),
    };
    // Your own review stays on top.
    return [...reviews].sort((a, b) => Number(b.steamId === viewerId) - Number(a.steamId === viewerId) || by[sort](a, b));
  }, [reviews, sort, enabledIds, viewerId]);

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
          <div className="meta num">
            {[mod.workshopUpdatedAt ? `Workshop updated ${new Date(mod.workshopUpdatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}` : null,
              mod.subscriptions != null ? `${mod.subscriptions.toLocaleString()} subscribers` : null].filter(Boolean).join(" · ")}
          </div>
          <div className="meta">
            {mod.characterIds.length
              ? <>Character: {[...new Set(mod.characterIds.map(characterName))].join(" / ")}</>
              : "Not linked to a character yet. It links when a reviewer’s runs match it."}
          </div>
          {mod.description ? <p className="desc">{mod.description.length > 300 ? mod.description.slice(0, 300) + "…" : mod.description}</p> : null}
          <div className="actions">
            {writeLink}
            {verifyLink}
            <a className="btn" href={workshopUrl} target="_blank" rel="noopener noreferrer">Steam Workshop page ↗</a>
            <Link className="btn" href={`/compare?ids=${mod.id}`}>Compare</Link>
            {admin ? <CharacterIdsForm modId={mod.id} characterIds={mod.characterIds} /> : null}
            {admin ? <ConfirmAction label="Remove mod" prompt={`Remove ${mod.title} and all its reviews?`} action={deleteModAction} fields={{ modId: mod.id }} /> : null}
          </div>
        </div>
        <Medal value={total} size="lg" />
      </div>

      <div className="section-title">
        <h3>Combined review</h3>
        <span>Average of every review, per metric. Numbers in brackets are how many reviewers scored it. Hover a metric with ✎ to read reviewers’ notes.</span>
      </div>
      <div className="breakdown">
        {CATEGORIES.map((c) => {
          const a = categoryAverage(mod.stats, c.key, enabled);
          return (
            <div key={c.key} className="catblock" style={catStyle(c.key)}>
              <div className="catblock-head"><h4>{c.name}</h4><b className="num">{a.off ? "off" : formatScore(a.value)}</b></div>
              {c.metrics.map((m) => {
                const s = mod.stats[m.id];
                const notes = reviews.filter((r) => r.metricNotes[m.id]);
                const row = (
                  <>
                    <span>{m.label} <span className="n num">{s ? `(${s.n})` : ""}</span>{notes.length ? <span className="note-mark" aria-hidden="true"> ✎</span> : null}</span>
                    <span className="track"><span className="fill" style={{ width: `${(s?.avg ?? 0) * 10}%` }} /></span>
                    <span className="v num">{formatScore(s?.avg)}</span>
                  </>
                );
                return notes.length ? (
                  <div key={m.id} className={`mrow has-tip${enabled.has(m.id) ? "" : " off"}`} tabIndex={0}
                    aria-label={`${m.label}: ${formatScore(s?.avg)}. ${notes.length} reviewer ${notes.length === 1 ? "note" : "notes"}.`}>
                    {row}
                    <div className="tip" role="tooltip">
                      <b>{fullLabel(m)}: what reviewers said</b>
                      {notes.slice(0, 4).map((r) => (
                        <p key={r.id}><span className="num">{formatScore(r.scores[m.id])}</span> · {r.personaName}: {r.metricNotes[m.id]}</p>
                      ))}
                      {notes.length > 4 ? <p className="by">and {notes.length - 4} more in the reviews below</p> : null}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className={`mrow${enabled.has(m.id) ? "" : " off"}`} title={m.question}>{row}</div>
                );
              })}
            </div>
          );
        })}
      </div>

      <details className="discussion" open>
        <summary><h3>Discuss the combined review</h3><span className="by num">{commentsByReview.get("combined")?.length ?? 0} comments</span></summary>
        <CommentThread modId={mod.id} reviewId={null} comments={commentsByReview.get("combined") ?? []} viewerId={viewerId} admin={admin} signInHref={signInHref} />
      </details>

      <div className="section-title">
        <h3>Individual reviews</h3>
        <span className="toolbar">
          <span className="num">{reviews.length} logged</span>
          {reviews.length > 1 ? (
            <select id="review-sort" aria-label="Sort reviews" value={sort}
              onChange={(e) => { const s = e.target.value as ReviewSort; setSort(s); try { localStorage.setItem("sts2r:reviewSort", s); } catch {} }}>
              {SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          ) : null}
        </span>
      </div>
      {sorted.length ? (
        <div className="reviews">
          {sorted.map((r) => (
            <ReviewCard key={r.id} r={r} modId={mod.id} viewerId={viewerId} admin={admin} signInHref={signInHref}
              comments={commentsByReview.get(r.id) ?? []} />
          ))}
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

function ReviewCard({ r, modId, viewerId, admin, signInHref, comments }: {
  r: ReviewView; modId: string; viewerId: string | null; admin: boolean; signInHref: string; comments: CommentView[];
}) {
  const { enabled, enabledIds } = useMetrics();
  const mine = r.steamId === viewerId;
  const t = reviewTotal(r.scores, enabledIds);
  const n = enabledIds.filter((id) => isScore(r.scores[id])).length;
  const hours = r.playtimeMinutes != null ? Math.round(r.playtimeMinutes / 60) : null;
  const noteCount = Object.keys(r.metricNotes).length;

  return (
    <article className={`review${mine ? " mine" : ""}`}>
      <div className="review-head">
        <Medal value={t} size="sm" />
        <div className="who">
          {r.avatarUrl ? <img src={r.avatarUrl} alt="" /> : null}
          <div>
            <strong><Link href={`/players/${r.steamId}`}>{r.personaName}</Link></strong>
            {mine ? <span className="tag">You</span> : null}
            <div className="by num">
              {[`${n} metrics counted`, new Date(r.updatedAt).toLocaleDateString()].join(" · ")}
            </div>
          </div>
        </div>
        {r.verified ? (
          <span className="badge verified num" title={`Verified from run history files. Most recent ${new Date(r.verified.lastPlayed).toLocaleDateString()}.`}>
            ✓ {r.verified.a10Runs} A10 {r.verified.a10Runs === 1 ? "run" : "runs"}
          </span>
        ) : <span className="badge" title="This reviewer hasn’t verified any runs with this character">Unverified</span>}
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

      <details open={noteCount > 0}>
        <summary>All scores{noteCount ? ` · ${noteCount} with notes (hover ✎ to read)` : ""}</summary>
        <div className="scoregrid">
          {METRICS.map((m) => {
            const note = r.metricNotes[m.id];
            const cls = `${enabled.has(m.id) ? "" : "off"}${note ? " has-tip" : ""}`;
            return note ? (
              <div key={m.id} className={cls} style={catStyle(m.cat)} tabIndex={0}
                aria-label={`${fullLabel(m)}: ${formatScore(r.scores[m.id])}. Note: ${note}`}>
                <span>{fullLabel(m)} <span className="note-mark" aria-hidden="true">✎</span></span>
                <span className="num">{formatScore(r.scores[m.id])}</span>
                <div className="tip" role="tooltip"><b>{fullLabel(m)} · {formatScore(r.scores[m.id])}</b><p>{note}</p></div>
              </div>
            ) : (
              <div key={m.id} className={cls} style={catStyle(m.cat)}>
                <span>{fullLabel(m)}</span>
                <span className="num">{formatScore(r.scores[m.id])}</span>
              </div>
            );
          })}
        </div>
      </details>

      <div className="review-foot">
        <HelpfulButton reviewId={r.id} count={r.helpful} voted={r.votedByMe}
          disabledReason={!viewerId ? "Sign in with Steam to vote" : mine ? "You can’t vote on your own review" : null} />
        <details className="discussion inline">
          <summary>Discussion · <span className="num">{comments.length}</span></summary>
          <CommentThread modId={modId} reviewId={r.id} comments={comments} viewerId={viewerId} admin={admin} signInHref={signInHref} />
        </details>
      </div>
    </article>
  );
}
