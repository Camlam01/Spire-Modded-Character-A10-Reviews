// The review metrics. Ids are stored in the database (see supabase/migrations), so never rename one.
// Retired metrics ("outliers", "mech_consistency") stay in old reviews but are ignored, since only the ids listed here are read.

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
    ["immersion", "Immersion", "Are there animations, sound effects and dialogue which make the character feel alive and part of the Spire?", YES_GOOD],
    // Stored as "aes_consistency" from when this metric was called Consistency.
    ["aes_consistency", "Cohesion", "How well does the visual and audio design fit with the style of the base game?", ["Poorly", "Well"]],
  ]),
  cat("mech", "Mechanics", [
    ["uniqueness", "Uniqueness", "How much do the new mechanics provide in terms of new ways to enjoy deck building?", STRENGTH],
    ["compatibility", "Compatibility", "Do the new mechanics fit well with the design of enemies in the Spire, or do they make certain challenges particularly trivial or difficult?", YES_GOOD],
    ["completeness", "Completeness", "Does the character have a full card pool, ancient dialogue + cards, relics and potions?", YES_GOOD],
    ["complexity", "Complexity", "Does the character sit somewhere inside or slightly above the complexity level of the base characters? Does this character’s difficulty come more from complexity of mechanics rather than the design?", YES_GOOD],
    ["playability", "Playability", "Do mechanics behave as you would reasonably expect? Are mechanics described clearly? Do the new mechanics feel smooth and natural to use?", YES_GOOD],
  ]),
  cat("bal", "A10 Balance", [
    ["difficulty", "Difficulty", "Does this character’s difficulty line up well with the base game characters?", YES_GOOD],
    ["adaptability", "Adaptability", "Does this character rely on finding cards building into a specific archetype, or do they have a strong decision space where many different approaches can win?", ["Archetype", "Many approaches"]],
    ["snowballing", "Snowballing", "Do your wins and losses with this character feel inevitable well before the end of the run? Do particular cards feel disproportionately stronger than others?", NO_GOOD],
  ]),
  cat("ref", "Enjoyment", [
    ["enjoyment", "Enjoyment", "Do you find yourself coming back to this character regularly?", YES_GOOD],
    ["fulfilment", "Fulfilment", "How many of your runs feel satisfying? When you lose, do you feel like you have ideas of where you made mistakes? When you win, do you feel like it is usually because you made good decisions, or found strong rewards?", STRENGTH],
  ]),
];

export const METRICS: Metric[] = CATEGORIES.flatMap((c) => c.metrics);
export const METRIC_IDS: string[] = METRICS.map((m) => m.id);
export const categoryOf = (key: CategoryKey): Category => CATEGORIES.find((c) => c.key === key)!;

/** A metric's name where it appears outside its category. Kept as one place to disambiguate if names ever repeat. */
export const fullLabel = (m: Metric): string => m.label;
