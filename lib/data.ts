import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { RATE_LIMITS, WORKSHOP_REFRESH_HOURS, type RateKind } from "./limits";
import { cleanMetricNotes, cleanScores, type MetricNotes, type MetricStats, type Scores } from "./scoring";

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type DatabaseProblem = "missing_tables" | "outdated_tables" | "bad_key" | "unreachable";
let databaseOk = false;

/**
 * Whether the database is reachable and set up, so a half-finished setup shows instructions instead of a crash.
 * Checks a table from the newest migration; remembered once it passes.
 */
export async function databaseProblem(): Promise<DatabaseProblem | null> {
  if (databaseOk) return null;
  try {
    const [first, newest] = await Promise.all([
      db().from("players").select("steam_id", { head: true, count: "exact" }).limit(1),
      db().from("character_runs").select("steam_id", { head: true, count: "exact" }).limit(1),
    ]);
    const err = first.error ?? newest.error;
    if (!err) { databaseOk = true; return null; }
    const text = `${err.code ?? ""} ${err.message ?? ""}`;
    if (/PGRST301|PGRST302|401|403|JWT|Invalid API key|permission denied/i.test(text)) return "bad_key";
    if (/PGRST205|42P01|does not exist|Could not find the table/i.test(text)) return first.error ? "missing_tables" : "outdated_tables";
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(text)) return "unreachable";
    console.error("Database check failed", err);
    return "unreachable";
  } catch (e) {
    console.error("Database check failed", e);
    return "unreachable";
  }
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Database error: ${res.error.message}`);
  return res.data;
}

/* ---------- shapes the pages use ---------- */

export interface ModSummary {
  id: string;
  workshopId: string;
  title: string;
  description: string;
  previewUrl: string | null;
  creatorName: string | null;
  createdAt: string;
  workshopUpdatedAt: string | null;
  workshopCreatedAt: string | null;
  subscriptions: number | null;
  characterIds: string[];
  reviewCount: number;
  stats: MetricStats;
  reviewedByMe: boolean;
}

export interface Author {
  steamId: string;
  personaName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
}

export interface ReviewView extends Author {
  id: string;
  ownsGame: boolean | null;
  playtimeMinutes: number | null;
  notes: string;
  scores: Scores;
  metricNotes: MetricNotes;
  helpful: number;
  votedByMe: boolean;
  verified: RunStats | null;
  createdAt: string;
  updatedAt: string;
}

/** Verified A10 runs, counted from run history files (wins and losses alike; which is never stored). */
export interface RunStats {
  a10Runs: number;
  lastPlayed: string;
}

export interface CharacterRuns extends RunStats {
  characterId: string;
  mods: { id: string; title: string }[];
}

export interface CommentView extends Author {
  id: string;
  reviewId: string | null;
  body: string;
  createdAt: string;
}

interface ModRow {
  id: string;
  workshop_id: string;
  title: string;
  description: string;
  preview_url: string | null;
  creator_name: string | null;
  created_at: string;
  workshop_updated_at: string | null;
  workshop_created_at: string | null;
  subscriptions: number | null;
  character_ids: string[] | null;
  reviews: { count: number }[];
}
interface StatRow { mod_id: string; metric: string; avg_score: number | string; n: number }
interface PlayerRow { persona_name: string; avatar_url: string | null; profile_url: string | null }

function statsByMod(rows: StatRow[]): Map<string, MetricStats> {
  const out = new Map<string, MetricStats>();
  for (const r of rows) {
    const s = out.get(r.mod_id) ?? {};
    s[r.metric] = { avg: Number(r.avg_score), n: r.n };
    out.set(r.mod_id, s);
  }
  return out;
}

const toSummary = (m: ModRow, stats: Map<string, MetricStats>, mine: Set<string>): ModSummary => ({
  id: m.id,
  workshopId: m.workshop_id,
  title: m.title,
  description: m.description,
  previewUrl: m.preview_url,
  creatorName: m.creator_name,
  createdAt: m.created_at,
  workshopUpdatedAt: m.workshop_updated_at,
  workshopCreatedAt: m.workshop_created_at,
  subscriptions: m.subscriptions,
  characterIds: m.character_ids ?? [],
  reviewCount: m.reviews?.[0]?.count ?? 0,
  stats: stats.get(m.id) ?? {},
  reviewedByMe: mine.has(m.id),
});

const toAuthor = (steamId: string, p: PlayerRow | null): Author => ({
  steamId,
  personaName: p?.persona_name || "Steam player",
  avatarUrl: p?.avatar_url ?? null,
  profileUrl: p?.profile_url ?? null,
});

const MOD_COLUMNS =
  "id, workshop_id, title, description, preview_url, creator_name, created_at, workshop_updated_at, workshop_created_at, subscriptions, character_ids, reviews(count)";

async function myReviewedModIds(steamId: string | null): Promise<Set<string>> {
  if (!steamId) return new Set();
  const rows = check(await db().from("reviews").select("mod_id").eq("steam_id", steamId)) as { mod_id: string }[];
  return new Set(rows.map((r) => r.mod_id));
}

/* ---------- mods ---------- */

export async function listMods(viewer: string | null): Promise<ModSummary[]> {
  const [mods, stats, mine] = await Promise.all([
    db().from("mods").select(MOD_COLUMNS).order("created_at", { ascending: false }).limit(1000),
    db().from("mod_metric_stats").select("mod_id, metric, avg_score, n"),
    myReviewedModIds(viewer),
  ]);
  const byMod = statsByMod(check(stats) as StatRow[]);
  return (check(mods) as unknown as ModRow[]).map((m) => toSummary(m, byMod, mine));
}

export async function getMod(id: string, viewer: string | null): Promise<ModSummary | null> {
  if (!isUuid(id)) return null;
  const [mod, stats, mine] = await Promise.all([
    db().from("mods").select(MOD_COLUMNS).eq("id", id).maybeSingle(),
    db().from("mod_metric_stats").select("mod_id, metric, avg_score, n").eq("mod_id", id),
    myReviewedModIds(viewer),
  ]);
  const row = check(mod) as unknown as ModRow | null;
  return row ? toSummary(row, statsByMod(check(stats) as StatRow[]), mine) : null;
}

export async function findModByWorkshopId(workshopId: string): Promise<string | null> {
  const row = check(await db().from("mods").select("id").eq("workshop_id", workshopId).maybeSingle()) as { id: string } | null;
  return row?.id ?? null;
}

export async function insertMod(m: {
  workshopId: string; title: string; description: string; previewUrl: string | null; creatorSteamId: string | null;
  creatorName: string | null; addedBy: string; workshopUpdatedAt: string | null; workshopCreatedAt: string | null; subscriptions: number | null;
}): Promise<string> {
  const row = check(
    await db()
      .from("mods")
      .insert({
        workshop_id: m.workshopId,
        title: m.title,
        description: m.description,
        preview_url: m.previewUrl,
        creator_steam_id: m.creatorSteamId,
        creator_name: m.creatorName,
        added_by: m.addedBy,
        workshop_updated_at: m.workshopUpdatedAt,
        workshop_created_at: m.workshopCreatedAt,
        subscriptions: m.subscriptions,
      })
      .select("id")
      .single(),
  ) as { id: string };
  return row.id;
}

export async function deleteMod(id: string) {
  check(await db().from("mods").delete().eq("id", id));
}

/** Mods whose Workshop details haven't been re-read recently (optionally just one). */
export async function staleMods(limit: number, onlyId?: string) {
  const cutoff = new Date(Date.now() - WORKSHOP_REFRESH_HOURS * 3600_000).toISOString();
  let q = db().from("mods").select("id, workshop_id, creator_steam_id").lt("synced_at", cutoff).order("synced_at").limit(limit);
  if (onlyId) q = q.eq("id", onlyId);
  return check(await q) as { id: string; workshop_id: string; creator_steam_id: string | null }[];
}

export async function updateModFromWorkshop(id: string, fields: {
  title?: string; description?: string; previewUrl?: string | null; creatorName?: string | null;
  workshopUpdatedAt?: string | null; workshopCreatedAt?: string | null; subscriptions?: number | null;
}) {
  const patch: Record<string, unknown> = { synced_at: new Date().toISOString() };
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.previewUrl !== undefined) patch.preview_url = fields.previewUrl;
  if (fields.creatorName) patch.creator_name = fields.creatorName;
  if (fields.workshopUpdatedAt !== undefined) patch.workshop_updated_at = fields.workshopUpdatedAt;
  if (fields.subscriptions !== undefined) patch.subscriptions = fields.subscriptions;
  if (fields.workshopCreatedAt) patch.workshop_created_at = fields.workshopCreatedAt;
  check(await db().from("mods").update(patch).eq("id", id));
}

/* ---------- reviews ---------- */

export async function getReviews(modId: string, viewer: string | null): Promise<ReviewView[]> {
  const verified = await getRunStatsForMod(modId);
  const rows = check(
    await db()
      .from("reviews")
      .select("id, steam_id, notes, scores, metric_notes, created_at, updated_at, players(persona_name, avatar_url, profile_url, owns_game, playtime_minutes), review_votes(steam_id)")
      .eq("mod_id", modId)
      .order("updated_at", { ascending: false }),
  ) as unknown as {
    id: string; steam_id: string; notes: string; scores: unknown; metric_notes: unknown;
    created_at: string; updated_at: string;
    players: (PlayerRow & { owns_game: boolean | null; playtime_minutes: number | null }) | null;
    review_votes: { steam_id: string }[];
  }[];
  return rows.map((r) => ({
    id: r.id,
    ...toAuthor(r.steam_id, r.players),
    ownsGame: r.players?.owns_game ?? null,
    playtimeMinutes: r.players?.playtime_minutes ?? null,
    notes: r.notes,
    scores: cleanScores(r.scores),
    metricNotes: cleanMetricNotes(r.metric_notes),
    helpful: r.review_votes?.length ?? 0,
    votedByMe: !!viewer && (r.review_votes ?? []).some((v) => v.steam_id === viewer),
    verified: verified.get(r.steam_id) ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getMyReview(modId: string, steamId: string) {
  return check(
    await db().from("reviews").select("id, notes, scores, metric_notes").eq("mod_id", modId).eq("steam_id", steamId).maybeSingle(),
  ) as { id: string; notes: string; scores: unknown; metric_notes: unknown } | null;
}

export async function getReviewMeta(reviewId: string) {
  if (!isUuid(reviewId)) return null;
  return check(await db().from("reviews").select("id, mod_id, steam_id").eq("id", reviewId).maybeSingle()) as
    { id: string; mod_id: string; steam_id: string } | null;
}

export async function upsertReview(r: {
  modId: string; steamId: string; notes: string; scores: Scores; metricNotes: MetricNotes;
}) {
  check(
    await db()
      .from("reviews")
      .upsert(
        { mod_id: r.modId, steam_id: r.steamId, notes: r.notes, scores: r.scores, metric_notes: r.metricNotes },
        { onConflict: "mod_id,steam_id" },
      ),
  );
}

export async function deleteReview(id: string, steamId: string | null) {
  let q = db().from("reviews").delete().eq("id", id);
  if (steamId) q = q.eq("steam_id", steamId); // null = admin removing any review
  check(await q);
}

/** Turn a "helpful" vote on or off. Returns whether the vote is now on. */
export async function toggleVote(reviewId: string, steamId: string): Promise<boolean> {
  const existing = check(
    await db().from("review_votes").select("review_id").eq("review_id", reviewId).eq("steam_id", steamId).maybeSingle(),
  );
  if (existing) {
    check(await db().from("review_votes").delete().eq("review_id", reviewId).eq("steam_id", steamId));
    return false;
  }
  const res = await db().from("review_votes").insert({ review_id: reviewId, steam_id: steamId });
  if (res.error && res.error.code !== "23505") throw new Error(`Database error: ${res.error.message}`); // 23505: double click
  return true;
}

/* ---------- verified runs ---------- */

interface RunStatRow { steam_id: string; a10_runs: number; last_played: string }
const toRunStats = (r: RunStatRow): RunStats => ({ a10Runs: r.a10_runs, lastPlayed: r.last_played });

export async function getRunStatsForMod(modId: string): Promise<Map<string, RunStats>> {
  const rows = check(
    await db().from("player_mod_run_stats").select("steam_id, a10_runs, last_played").eq("mod_id", modId),
  ) as RunStatRow[];
  return new Map(rows.map((r) => [r.steam_id, toRunStats(r)]));
}

export async function getRunStats(steamId: string, modId: string): Promise<RunStats | null> {
  const row = check(
    await db().from("player_mod_run_stats").select("steam_id, a10_runs, last_played").eq("mod_id", modId).eq("steam_id", steamId).maybeSingle(),
  ) as RunStatRow | null;
  return row ? toRunStats(row) : null;
}

/** Every character a player has verified A10 runs with, and which listed mods add it. */
export async function getCharacterRuns(steamId: string): Promise<CharacterRuns[]> {
  const [rows, mods] = await Promise.all([
    db().from("character_runs").select("character_id, a10_runs, last_played").eq("steam_id", steamId).order("a10_runs", { ascending: false }),
    db().from("mods").select("id, title, character_ids").neq("character_ids", "{}"),
  ]);
  const modRows = check(mods) as { id: string; title: string; character_ids: string[] }[];
  return (check(rows) as { character_id: string; a10_runs: number; last_played: string }[]).map((r) => ({
    characterId: r.character_id,
    a10Runs: r.a10_runs,
    lastPlayed: r.last_played,
    mods: modRows.filter((m) => m.character_ids.includes(r.character_id)).map((m) => ({ id: m.id, title: m.title })),
  }));
}

export async function getPlayerProfile(steamId: string) {
  return check(
    await db().from("players").select("steam_id, persona_name, avatar_url, profile_url, runs_scanned_at, created_at").eq("steam_id", steamId).maybeSingle(),
  ) as { steam_id: string; persona_name: string; avatar_url: string | null; profile_url: string | null; runs_scanned_at: string | null; created_at: string } | null;
}

export async function getPlayerReviews(steamId: string) {
  return check(
    await db().from("reviews").select("id, scores, updated_at, mods(id, title)").eq("steam_id", steamId).order("updated_at", { ascending: false }),
  ) as unknown as { id: string; scores: unknown; updated_at: string; mods: { id: string; title: string } | null }[];
}

export async function markRunsScanned(steamId: string) {
  check(await db().from("players").update({ runs_scanned_at: new Date().toISOString() }).eq("steam_id", steamId));
}

export async function setModCharacterIds(modId: string, ids: string[]) {
  check(await db().from("mods").update({ character_ids: ids }).eq("id", modId));
}

/** Character ids already linked to some mod. */
export async function linkedCharacterIds(): Promise<Set<string>> {
  const rows = check(await db().from("mods").select("character_ids").neq("character_ids", "{}")) as { character_ids: string[] }[];
  return new Set(rows.flatMap((r) => r.character_ids));
}

export async function unlinkedMods() {
  return check(await db().from("mods").select("id, title").eq("character_ids", "{}")) as { id: string; title: string }[];
}

export async function knownCharacterIds(): Promise<string[]> {
  const rows = check(await db().from("known_characters").select("character_id")) as { character_id: string }[];
  return rows.map((r) => r.character_id);
}

/** Replace a player's A10 run counts for the characters in this scan. Characters not in the scan keep their counts. */
export async function upsertCharacterRuns(steamId: string, characters: { characterId: string; a10Runs: number; lastPlayed: number }[]) {
  if (!characters.length) return;
  check(
    await db().from("character_runs").upsert(
      characters.map((c) => ({
        steam_id: steamId,
        character_id: c.characterId,
        a10_runs: c.a10Runs,
        last_played: new Date(c.lastPlayed * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "steam_id,character_id" },
    ),
  );
}

/* ---------- comments ---------- */

export async function getComments(modId: string): Promise<CommentView[]> {
  const rows = check(
    await db()
      .from("comments")
      .select("id, review_id, steam_id, body, created_at, players(persona_name, avatar_url, profile_url)")
      .eq("mod_id", modId)
      .order("created_at", { ascending: true })
      .limit(2000),
  ) as unknown as { id: string; review_id: string | null; steam_id: string; body: string; created_at: string; players: PlayerRow | null }[];
  return rows.map((c) => ({ id: c.id, reviewId: c.review_id, body: c.body, createdAt: c.created_at, ...toAuthor(c.steam_id, c.players) }));
}

export async function insertComment(c: { modId: string; reviewId: string | null; steamId: string; body: string }) {
  check(await db().from("comments").insert({ mod_id: c.modId, review_id: c.reviewId, steam_id: c.steamId, body: c.body }));
}

export async function deleteComment(id: string, steamId: string | null) {
  let q = db().from("comments").delete().eq("id", id);
  if (steamId) q = q.eq("steam_id", steamId);
  check(await q);
}

/* ---------- players ---------- */

export async function getPlayer(steamId: string) {
  return check(
    await db().from("players").select("steam_id, persona_name, avatar_url, owns_game").eq("steam_id", steamId).maybeSingle(),
  ) as { steam_id: string; persona_name: string; avatar_url: string | null; owns_game: boolean | null } | null;
}

export async function upsertPlayer(p: {
  steamId: string; personaName: string; avatarUrl: string | null; profileUrl: string | null; ownsGame: boolean | null; playtimeMinutes: number | null;
}) {
  check(
    await db().from("players").upsert({
      steam_id: p.steamId,
      persona_name: p.personaName,
      avatar_url: p.avatarUrl,
      profile_url: p.profileUrl,
      owns_game: p.ownsGame,
      playtime_minutes: p.playtimeMinutes,
    }),
  );
}

export async function updateOwnership(steamId: string, owns: boolean | null, minutes: number | null) {
  check(await db().from("players").update({ owns_game: owns, playtime_minutes: minutes }).eq("steam_id", steamId));
}

/* ---------- rate limiting ---------- */

/** Records the action and returns true if the player is still within their limit for it. */
export async function takeRateToken(steamId: string, kind: RateKind): Promise<boolean> {
  const { max, windowMinutes } = RATE_LIMITS[kind];
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await db()
    .from("rate_events")
    .select("id", { count: "exact", head: true })
    .eq("steam_id", steamId)
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) throw new Error(`Database error: ${error.message}`);
  if ((count ?? 0) >= max) return false;
  check(await db().from("rate_events").insert({ steam_id: steamId, kind }));
  return true;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
