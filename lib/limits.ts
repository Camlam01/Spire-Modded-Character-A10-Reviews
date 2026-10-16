// How often each player may do each kind of write. Checked in app/actions.ts.

export type RateKind = "mod" | "review" | "comment" | "vote" | "runs";

export const RATE_LIMITS: Record<RateKind, { max: number; windowMinutes: number; message: string }> = {
  mod: { max: 5, windowMinutes: 24 * 60, message: "You’ve added 5 mods today. Try again tomorrow." },
  review: { max: 20, windowMinutes: 60, message: "You’ve saved a lot of reviews in the last hour. Wait a while and try again." },
  comment: { max: 10, windowMinutes: 10, message: "You’re commenting very quickly. Wait a few minutes and try again." },
  vote: { max: 60, windowMinutes: 10, message: "You’re voting very quickly. Wait a few minutes and try again." },
  runs: { max: 10, windowMinutes: 60, message: "You’ve uploaded runs many times in the last hour. Wait a while and try again." },
};

export const COMMENT_MAX = 2000;


/** Mod details older than this are re-read from the Workshop. */
export const WORKSHOP_REFRESH_HOURS = 24;
