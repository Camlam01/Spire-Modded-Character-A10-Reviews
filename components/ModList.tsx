"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ModSummary } from "@/lib/data";
import { CATEGORIES } from "@/lib/metrics";
import { categoryAverage, combinedTotal, formatScore } from "@/lib/scoring";
import { catStyle, Medal } from "./Medal";
import { useMetrics } from "./MetricsProvider";

type Sort = "score" | "reviews" | "newest" | "name";
const SORTS: [Sort, string][] = [["score", "Highest score"], ["reviews", "Most reviewed"], ["newest", "Newest added"], ["name", "Name A–Z"]];

export function ModList({ mods, canAdd }: { mods: ModSummary[]; canAdd: boolean }) {
  const { enabled, enabledIds } = useMetrics();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("score");

  useEffect(() => {
    try { const s = localStorage.getItem("sts2r:sort") as Sort | null; if (s && SORTS.some(([v]) => v === s)) setSort(s); } catch {}
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = mods
      .filter((m) => !needle || m.title.toLowerCase().includes(needle) || (m.creatorName ?? "").toLowerCase().includes(needle))
      .map((m) => ({ m, total: combinedTotal(m.stats, enabledIds) }));
    const by: Record<Sort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      score: (a, b) => (b.total ?? -1) - (a.total ?? -1) || b.m.reviewCount - a.m.reviewCount,
      reviews: (a, b) => b.m.reviewCount - a.m.reviewCount || (b.total ?? -1) - (a.total ?? -1),
      newest: (a, b) => b.m.createdAt.localeCompare(a.m.createdAt),
      name: (a, b) => a.m.title.localeCompare(b.m.title),
    };
    return list.sort(by[sort]);
  }, [mods, q, sort, enabledIds]);

  const reviewTotal = mods.reduce((n, m) => n + m.reviewCount, 0);

  if (!mods.length) {
    return (
      <div className="empty">
        <h3>No character mods yet</h3>
        <p>Add a character mod from the Steam Workshop to start collecting A10 reviews. Each mod gets a combined score built from every review posted for it.</p>
        {canAdd ? <Link className="btn primary" href="/mods/new">Add the first mod</Link> : <a className="btn steam" href="/api/auth/steam/login?next=/mods/new">Sign in with Steam to add one</a>}
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <input id="q" type="search" placeholder="Search by mod or author" aria-label="Search mods" value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          id="sort"
          aria-label="Sort mods"
          value={sort}
          onChange={(e) => { const s = e.target.value as Sort; setSort(s); try { localStorage.setItem("sts2r:sort", s); } catch {} }}
        >
          {SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        {canAdd ? <Link className="btn primary" href="/mods/new">Add a mod</Link> : null}
      </div>
      <div className="toolbar">
        <span className="stat num">
          {mods.length} {mods.length === 1 ? "mod" : "mods"} · {reviewTotal} {reviewTotal === 1 ? "review" : "reviews"} logged
        </span>
      </div>
      {rows.length ? (
        <div className="grid">
          {rows.map(({ m, total }) => (
            <Link key={m.id} className="card" href={`/mods/${m.id}`}>
              <div className="card-head">
                {m.previewUrl ? <img className="thumb" src={m.previewUrl} alt="" loading="lazy" /> : null}
                <div>
                  <h3>{m.title}</h3>
                  {m.creatorName ? <div className="by">by {m.creatorName}</div> : null}
                </div>
                <Medal value={total} />
              </div>
              <div className="catbars">
                {CATEGORIES.map((c) => {
                  const a = categoryAverage(m.stats, c.key, enabled);
                  return (
                    <div key={c.key} className={`catbar${a.off ? " off" : ""}`} style={catStyle(c.key)}>
                      <span className="lab">{c.name}</span>
                      <span className="track"><span className="fill" style={{ width: `${(a.value ?? 0) * 10}%` }} /></span>
                      <span className="v num">{a.off ? "off" : formatScore(a.value)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="foot">
                <span className="num">{m.reviewCount ? `${m.reviewCount} ${m.reviewCount === 1 ? "review" : "reviews"}` : "No reviews yet"}</span>
                {m.reviewedByMe ? <span>You reviewed this</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty"><h3>No mods match that search</h3><p>Try a shorter name, or clear the search box to see every mod.</p></div>
      )}
    </>
  );
}
