import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryAverage, cleanScores, combinedTotal, combineReviews, formatScore, isScore, reviewTotal } from "./scoring.ts";

test("isScore accepts 0–10 in half steps only", () => {
  for (const v of [0, 0.5, 5, 9.5, 10]) assert.equal(isScore(v), true, String(v));
  for (const v of [-0.5, 10.5, 7.3, NaN, "5", null]) assert.equal(isScore(v), false, String(v));
});

test("cleanScores drops unknown metrics and bad values", () => {
  assert.deepEqual(cleanScores({ art: 7.5, bogus: 5, immersion: 11, enjoyment: 3 }), { art: 7.5, enjoyment: 3 });
});

test("reviewTotal averages only enabled metrics that were scored", () => {
  const s = { art: 8, immersion: 6, enjoyment: 2 };
  assert.equal(reviewTotal(s, ["art", "immersion", "enjoyment"]), 16 / 3);
  assert.equal(reviewTotal(s, ["art", "immersion", "outliers"]), 7);
  assert.equal(reviewTotal(s, ["outliers"]), null);
});

test("combined total is the mean of per-metric averages", () => {
  const stats = combineReviews([{ art: 10, enjoyment: 4 }, { art: 6 }]);
  assert.deepEqual(stats.art, { avg: 8, n: 2 });
  assert.deepEqual(stats.enjoyment, { avg: 4, n: 1 });
  assert.equal(combinedTotal(stats, ["art", "enjoyment"]), 6);
  assert.equal(combinedTotal(stats, ["art"]), 8);
});

test("category average reports off when no metric in it is enabled", () => {
  const stats = combineReviews([{ art: 9, immersion: 7 }]);
  assert.deepEqual(categoryAverage(stats, "aes", new Set(["art", "immersion"])), { off: false, value: 8 });
  assert.deepEqual(categoryAverage(stats, "aes", new Set(["enjoyment"])), { off: true, value: null });
});

test("formatScore rounds to one decimal", () => {
  assert.equal(formatScore(7.25), "7.3");
  assert.equal(formatScore(null), "—");
});
