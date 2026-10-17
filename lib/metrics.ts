// The review metrics. Ids are stored in the database (see supabase/migrations), so never rename one.
// Retired metrics ("outliers", "mech_consistency", "playability", "immersion") stay in old reviews but are ignored, since only the ids listed here are read.

export type CategoryKey = "aes" | "mech" | "bal" | "ref";

export interface Metric {
  id: string;
  label: string;
  question: string;
  /** Words shown under each end of the slider: [at 0, at 10]. 10 is always the best answer. */
  scale: [string, string];
  cat: CategoryKey;
}

export interface Category {
  key: CategoryKey;
  name: string;
  metrics: Metric[];
}

const YES_GOOD: [string, string] = ["No", "Yes"];
const NO_GOOD: [string, string] = ["Yes", "No"]; // the question asks about a problem
const STRENGTH: [string, string] = ["Weak", "Strong"];

const cat = (key: CategoryKey, name: string, metrics: [string, string, string, [string, string]][]): Category => ({
  key,
  name,
  metrics: metrics.map(([id, label, question, scale]) => ({ id, label, question, scale, cat: key })),
});

export const CATEGORIES: Category[] = [
  cat("aes", "Aesthetics", [
    ["art", "Art", "How strong is the design of the character, assets, UI and other visual features?", STRENGTH],
    // Stored as "aes_consistency" from when this metric was called Consistency.
    ["aes_consistency", "Cohesion", "How well does the visual design fit with the style of the base game?", ["Poorly", "Well"]],
  ]),
  cat("mech", "Mechanics", [
    ["uniqueness", "Uniqueness", "How much do the new mechanics provide in terms of new ways to enjoy deck building?", STRENGTH],
    ["completeness", "Completeness", "Does the character have a full card pool, ancient dialogue + cards, relics and potions?", YES_GOOD],
    ["complexity", "Complexity", "Does the complexity feel aligned with the complexity of the vanilla characters? Do mechanics behave as you would reasonably expect? Are they described clearly?", YES_GOOD],
  ]),
  cat("bal", "A10 Balance", [
    ["difficulty", "Difficulty", "Does this character’s difficulty line up well with the base game characters?", YES_GOOD],
    ["adaptability", "Adaptability", "Can this character win without relying on finding cards building into a specific archetype? Do they have a strong decision space where many different approaches can win?", YES_GOOD],
    ["snowballing", "Snowballing", "Do your wins and losses with this character feel inevitable well before the end of the run? Do particular cards feel disproportionately stronger than others?", NO_GOOD],
    ["compatibility", "Compatibility", "Do the new mechanics fit well with the design of enemies in the Spire?", YES_GOOD],
  ]),
  cat("ref", "Enjoyment", [
    ["enjoyment", "Enjoyment", "Do you enjoy playing this character? Do you see yourself regularly coming back to them?", YES_GOOD],
    ["fulfilment", "Fulfilment", "How many of your runs feel satisfying? When you lose, do you feel like you have ideas of where you made mistakes? When you win, do you feel like it is usually because you made good decisions, or because you got lucky?", STRENGTH],
  ]),
];

export const METRICS: Metric[] = CATEGORIES.flatMap((c) => c.metrics);
export const METRIC_IDS: string[] = METRICS.map((m) => m.id);
export const categoryOf = (key: CategoryKey): Category => CATEGORIES.find((c) => c.key === key)!;

/** A metric's name where it appears outside its category. Kept as one place to disambiguate if names ever repeat. */
export const fullLabel = (m: Metric): string => m.label;
