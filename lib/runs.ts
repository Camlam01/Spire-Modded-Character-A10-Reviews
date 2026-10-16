// Reading STS2 run history files (saves/history/<start_time>.run). Runs in the browser, so raw files never leave the
// player's computer; only RunSummary objects are sent to the server, which checks them again with RUN_SUMMARY.
// Only qualifying runs are sent: solo, standard mode, Ascension 10+, not abandoned. Win or loss is never sent.
import { z } from "zod";

export const MIN_ASCENSION = 10;

export const RUN_SUMMARY = z.object({
  characterId: z.string().regex(/^CHARACTER\.[A-Z0-9_.-]{1,120}$/),
  seed: z.string().regex(/^[A-Z0-9]{1,32}$/),
  startTime: z.number().int().positive(), // unix seconds
  ascension: z.number().int().min(MIN_ASCENSION).max(20),
  runTime: z.number().int().min(0).max(604800),
  buildId: z.string().max(40),
});
export type RunSummary = z.infer<typeof RUN_SUMMARY>;

export type RunSkip =
  | "not_json" | "unknown_format" | "abandoned" | "not_standard" | "below_a10" | "coop" | "name_mismatch" | "other_account_folder";

export type ParsedRun = { ok: true; run: RunSummary } | { ok: false; reason: RunSkip };

/** Folder segment that names the Steam account the save belongs to: .../SlayTheSpire2/steam/<SteamID64>/... */
export function steamIdFromPath(path: string): string | null {
  const m = /(?:^|[\\/])steam[\\/](\d{17})(?:[\\/]|$)/.exec(path);
  return m ? m[1] : null;
}

/** Base-game characters have no mod prefix: CHARACTER.IRONCLAD vs CHARACTER.THETAILOR-THE_TAILOR. */
export const isModdedCharacter = (id: string) => /^CHARACTER\.[A-Z0-9_]+-/.test(id);

/** The mod id part of a modded character id: CHARACTER.THETAILOR-THE_TAILOR -> "THETAILOR". */
export const modPrefix = (id: string): string | null => /^CHARACTER\.([A-Z0-9_]+)-/.exec(id)?.[1] ?? null;

/** A readable name from a character id: CHARACTER.THETAILOR-THE_TAILOR -> "The Tailor". */
export function characterName(id: string): string {
  const raw = id.replace(/^CHARACTER\./, "").replace(/^[A-Z0-9_]+-/, "");
  return raw.toLowerCase().split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || id;
}

const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Which characters a Workshop title most likely belongs to. Mods built on BaseLib name their characters after the
 * mod id, so "The Tailor (Beta Branch)" matches CHARACTER.THETAILOR-THE_TAILOR. Returns every character sharing the
 * best (longest) matching prefix, or nothing when no prefix is a confident match.
 */
export function matchCharactersToTitle(title: string, characterIds: string[]): string[] {
  const t = squash(title);
  let best = "";
  for (const id of characterIds) {
    const p = modPrefix(id);
    if (!p) continue;
    const q = squash(p);
    // Short prefixes ("SB", "MOD") would match by accident, so they must equal the whole title.
    const hit = q === t || (q.length >= 5 && t.includes(q));
    if (hit && q.length > best.length) best = q;
  }
  return best ? characterIds.filter((id) => squash(modPrefix(id) ?? "") === best) : [];
}

/**
 * Turn one run file into a summary for the signed-in player, or say why it doesn't count.
 * `path` is the file's path inside the chosen folder (or just its name).
 */
export function parseRunFile(text: string, path: string, viewerSteamId: string): ParsedRun {
  const folderOwner = steamIdFromPath(path);
  if (folderOwner && folderOwner !== viewerSteamId) return { ok: false, reason: "other_account_folder" };

  let j: Record<string, unknown>;
  try { j = JSON.parse(text); } catch { return { ok: false, reason: "not_json" }; }
  if (!j || typeof j !== "object" || !Array.isArray(j.players) || typeof j.seed !== "string") return { ok: false, reason: "unknown_format" };
  if (j.was_abandoned === true) return { ok: false, reason: "abandoned" };
  if (j.game_mode !== "standard") return { ok: false, reason: "not_standard" };
  if (typeof j.ascension === "number" && j.ascension < MIN_ASCENSION) return { ok: false, reason: "below_a10" };

  // The game names each file after the run's start time.
  const fileName = path.split(/[\\/]/).pop() ?? "";
  if (/^\d+\.run$/.test(fileName) && fileName !== `${j.start_time}.run`) return { ok: false, reason: "name_mismatch" };

  // Co-op files don't reliably say which player you were (local co-op mods use made-up ids), so only solo runs count.
  const players = j.players as { character?: unknown }[];
  if (players.length !== 1) return { ok: false, reason: "coop" };

  const parsed = RUN_SUMMARY.safeParse({
    characterId: players[0].character,
    seed: j.seed,
    startTime: j.start_time,
    ascension: j.ascension,
    runTime: j.run_time,
    buildId: j.build_id,
  });
  return parsed.success ? { ok: true, run: parsed.data } : { ok: false, reason: "unknown_format" };
}

export interface CharacterTally {
  characterId: string;
  a10Runs: number;
}

/** Count A10 runs per character, dropping duplicates (the same run saved in two profiles or synced copies). */
export function tallyRuns(runs: RunSummary[]): { unique: RunSummary[]; byCharacter: CharacterTally[] } {
  const seen = new Set<string>();
  const unique = runs.filter((r) => {
    const k = `${r.seed}:${r.startTime}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const map = new Map<string, number>();
  for (const r of unique) map.set(r.characterId, (map.get(r.characterId) ?? 0) + 1);
  return {
    unique,
    byCharacter: [...map].map(([characterId, a10Runs]) => ({ characterId, a10Runs })).sort((a, b) => b.a10Runs - a.a10Runs),
  };
}

export const SKIP_LABELS: Record<RunSkip, string> = {
  not_json: "couldn’t be read",
  unknown_format: "aren’t in a format this site understands",
  abandoned: "were abandoned",
  not_standard: "were custom or daily runs",
  below_a10: "were below Ascension 10",
  coop: "were co-op runs, which aren’t counted",
  name_mismatch: "had a file name that doesn’t match the run inside",
  other_account_folder: "came from another Steam account’s folder",
};
