// Score maths shared by the server and the browser. No framework imports, so it can be unit-tested with plain Node.
import { CATEGORIES, METRIC_IDS, type CategoryKey } from "./metrics.ts";

export type Scores = Record<string, number>;
export type MetricStats = Record<string, { avg: number; n: number }>;

/** A valid score: 0 to 10 in steps of 0.5. */
export const isScore = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10 && Math.round(v * 2) === v * 2;

export const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** Keep only known metric ids with valid scores. */
export function cleanScores(input: unknown): Scores {
  const out: Scores = {};
  if (!input || typeof input !== "object") return out;
  for (const id of METRIC_IDS) {
    const v = (input as Record<string, unknown>)[id];
    if (isScore(v)) out[id] = v;
  }
  return out;
}

/** One review's total: the average of its scores on the metrics switched on. */
export const reviewTotal = (scores: Scores, enabled: readonly string[]): number | null =>
  mean(enabled.map((id) => scores[id]).filter(isScore));

/** Average every review per metric. This is the combined review. */
export function combineReviews(reviews: Scores[]): MetricStats {
  const stats: MetricStats = {};
  for (const id of METRIC_IDS) {
    const vals = reviews.map((r) => r[id]).filter(isScore);
    if (vals.length) stats[id] = { avg: mean(vals)!, n: vals.length };
  }
  return stats;
}

/** A combined total: the average of the per-metric averages for the metrics switched on. */
export const combinedTotal = (stats: MetricStats, enabled: readonly string[]): number | null =>
  mean(enabled.map((id) => stats[id]?.avg).filter((v): v is number => typeof v === "number"));

/** A category's average, or `off` when none of its metrics are switched on. */
export function categoryAverage(stats: MetricStats, key: CategoryKey, enabled: ReadonlySet<string>) {
  const ids = CATEGORIES.find((c) => c.key === key)!.metrics.map((m) => m.id).filter((id) => enabled.has(id));
  if (!ids.length) return { off: true as const, value: null };
  return { off: false as const, value: combinedTotal(stats, ids) };
}

export const formatScore = (v: number | null | undefined): string =>
  v == null ? "—" : (Math.round(v * 10) / 10).toFixed(1);

export const scoreTone = (v: number | null | undefined): "" | "good" | "mid" | "low" =>
  v == null ? "" : v >= 7.5 ? "good" : v >= 5 ? "mid" : "low";
