// The review metrics. Ids are stored in the database (see supabase/migrations), so never rename one.

export type CategoryKey = "aes" | "mech" | "bal" | "ref";

export interface Metric {
  id: string;
  label: string;
  question: string;
  cat: CategoryKey;
}

export interface Category {
  key: CategoryKey;
  name: string;
  metrics: Metric[];
}

const cat = (key: CategoryKey, name: string, metrics: [string, string, string][]): Category => ({
  key,
  name,
  metrics: metrics.map(([id, label, question]) => ({ id, label, question, cat: key })),
});

export const CATEGORIES: Category[] = [
  cat("aes", "Aesthetics", [
    ["art", "Art", "How strong is the visual design of the character and other assets?"],
    ["aes_consistency", "Consistency", "Does the art style fit appropriately with the base game’s art style?"],
    ["immersion", "Immersion", "Does the mod have animations, sound effects, and other features to increase immersion?"],
  ]),
  cat("mech", "Mechanics", [
    ["uniqueness", "Uniqueness", "How much do the new mechanics provide in terms of new ways to enjoy deck building?"],
    ["compatibility", "Compatibility", "Do the new mechanics make certain elements of Spire’s challenge particularly trivial, or particularly difficult?"],
    ["mech_consistency", "Consistency", "Do mechanics behave as you would reasonably expect? Are mechanics described in the most clear and simple ways?"],
    ["completeness", "Completeness", "Does the character have a full card pool, ancient dialogue + cards, relics and potions?"],
    ["complexity", "Complexity", "Does the character sit somewhere inside or slightly above the complexity level of the base characters? Does this character’s difficulty come more from complexity of mechanics rather than the design?"],
    ["playability", "Playability", "Are the new mechanics implemented in a smooth and natural way?"],
  ]),
  cat("bal", "A10 Balance", [
    ["difficulty", "Difficulty", "Does this character’s difficulty line up well with the base game characters?"],
    ["adaptability", "Adaptability", "Can this character recover runs in weaker positions, or do strong rewards feel necessary to have a good chance to win? Does this character rely on finding cards building into a specific archetype, or do they have a strong decision space where many different approaches can win?"],
    ["snowballing", "Snowballing", "Does this character have a lot of cards or card combos which solve a majority of the game’s challenges? Do your wins and losses feel inevitable well before the end of the run?"],
    ["outliers", "Outliers", "Does this character have cards which seem obviously much weaker or stronger than others at the same rarity? AKA: cards you always pick/skip regardless of scenario."],
  ]),
  cat("ref", "Reflection", [
    ["enjoyment", "Enjoyment", "Do you find yourself coming back to this character regularly?"],
    ["fulfilment", "Fulfilment", "How many of your runs feel satisfying? When you lose, do you feel like you have ideas of where you made mistakes? When you win, do you feel like it is usually because you made good decisions, or found strong rewards?"],
  ]),
];

export const METRICS: Metric[] = CATEGORIES.flatMap((c) => c.metrics);
export const METRIC_IDS: string[] = METRICS.map((m) => m.id);
export const categoryOf = (key: CategoryKey): Category => CATEGORIES.find((c) => c.key === key)!;

/** Label that tells the two "Consistency" metrics apart. */
export const fullLabel = (m: Metric): string =>
  m.label === "Consistency" ? `Consistency (${m.cat === "aes" ? "art" : "mechanics"})` : m.label;
