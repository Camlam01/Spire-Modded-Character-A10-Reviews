import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { cleanScores, type MetricStats, type Scores } from "./scoring";

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
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
  reviewCount: number;
  stats: MetricStats;
  reviewedByMe: boolean;
}

export interface ReviewView {
  id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  ownsGame: boolean | null;
  playtimeMinutes: number | null;
  a10Runs: number | null;
  notes: string;
  scores: Scores;
  createdAt: string;
  updatedAt: string;
}

interface ModRow {
  id: string;
  workshop_id: string;
  title: string;
  description: string;
  preview_url: string | null;
  creator_name: string | null;
  created_at: string;
  reviews: { count: number }[];
}
interface StatRow { mod_id: string; metric: string; avg_score: number | string; n: number }

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
  reviewCount: m.reviews?.[0]?.count ?? 0,
  stats: stats.get(m.id) ?? {},
  reviewedByMe: mine.has(m.id),
});

const MOD_COLUMNS = "id, workshop_id, title, description, preview_url, creator_name, created_at, reviews(count)";

async function myReviewedModIds(steamId: string | null): Promise<Set<string>> {
  if (!steamId) return new Set();
  const rows = check(await db().from("reviews").select("mod_id").eq("steam_id", steamId)) as { mod_id: string }[];
  return new Set(rows.map((r) => r.mod_id));
}

/* ---------- reads ---------- */

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

export async function getReviews(modId: string): Promise<ReviewView[]> {
  const rows = check(
    await db()
      .from("reviews")
      .select("id, steam_id, a10_runs, notes, scores, created_at, updated_at, players(persona_name, avatar_url, profile_url, owns_game, playtime_minutes)")
      .eq("mod_id", modId)
      .order("updated_at", { ascending: false }),
  ) as unknown as {
    id: string; steam_id: string; a10_runs: number | null; notes: string; scores: unknown; created_at: string; updated_at: string;
    players: { persona_name: string; avatar_url: string | null; profile_url: string | null; owns_game: boolean | null; playtime_minutes: number | null } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    steamId: r.steam_id,
    personaName: r.players?.persona_name || "Steam player",
    avatarUrl: r.players?.avatar_url ?? null,
    profileUrl: r.players?.profile_url ?? null,
    ownsGame: r.players?.owns_game ?? null,
    playtimeMinutes: r.players?.playtime_minutes ?? null,
    a10Runs: r.a10_runs,
    notes: r.notes,
    scores: cleanScores(r.scores),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getMyReview(modId: string, steamId: string) {
  return check(
    await db().from("reviews").select("id, a10_runs, notes, scores").eq("mod_id", modId).eq("steam_id", steamId).maybeSingle(),
  ) as { id: string; a10_runs: number | null; notes: string; scores: unknown } | null;
}

export async function getPlayer(steamId: string) {
  return check(
    await db().from("players").select("steam_id, persona_name, avatar_url").eq("steam_id", steamId).maybeSingle(),
  ) as { steam_id: string; persona_name: string; avatar_url: string | null } | null;
}

export async function findModByWorkshopId(workshopId: string): Promise<string | null> {
  const row = check(await db().from("mods").select("id").eq("workshop_id", workshopId).maybeSingle()) as { id: string } | null;
  return row?.id ?? null;
}

/* ---------- writes ---------- */

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

export async function insertMod(m: {
  workshopId: string; title: string; description: string; previewUrl: string | null; creatorSteamId: string | null; creatorName: string | null; addedBy: string;
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
      })
      .select("id")
      .single(),
  ) as { id: string };
  return row.id;
}

export async function deleteMod(id: string) {
  check(await db().from("mods").delete().eq("id", id));
}

export async function upsertReview(r: { modId: string; steamId: string; a10Runs: number | null; notes: string; scores: Scores }) {
  check(
    await db()
      .from("reviews")
      .upsert(
        { mod_id: r.modId, steam_id: r.steamId, a10_runs: r.a10Runs, notes: r.notes, scores: r.scores },
        { onConflict: "mod_id,steam_id" },
      ),
  );
}

export async function deleteReview(id: string, steamId: string | null) {
  let q = db().from("reviews").delete().eq("id", id);
  if (steamId) q = q.eq("steam_id", steamId); // null = admin removing any review
  check(await q);
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
