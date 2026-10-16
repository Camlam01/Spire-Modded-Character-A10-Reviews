"use client";

import { reviewTotal, type Scores } from "@/lib/scoring";
import { Medal } from "./Medal";
import { useMetrics } from "./MetricsProvider";

/** A review's total, following the metrics the viewer has switched on. */
export function ProfileReviewTotal({ scores }: { scores: Scores }) {
  const { enabledIds } = useMetrics();
  return <Medal value={reviewTotal(scores, enabledIds)} size="sm" />;
}
