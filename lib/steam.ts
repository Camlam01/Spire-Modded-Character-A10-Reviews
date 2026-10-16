import "server-only";
import { env } from "./env";

const OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const API = "https://api.steampowered.com";

export const callbackUrl = () => `${env.siteUrl}/api/auth/steam/callback`;

/** The Steam page that asks the player to sign in. `nonce` comes back to the callback and must match the cookie. */
export function steamLoginUrl(nonce: string): string {
  const params = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": `${callbackUrl()}?n=${encodeURIComponent(nonce)}`,
    "openid.realm": env.siteUrl,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${OPENID_ENDPOINT}?${params}`;
}

/**
 * Check a Steam sign-in response with Steam itself (OpenID 2.0 check_authentication).
 * Returns the player's SteamID64, or null if anything doesn't match.
 */
export async function verifySteamLogin(query: URLSearchParams): Promise<string | null> {
  if (query.get("openid.mode") !== "id_res") return null;
  if (query.get("openid.op_endpoint") !== OPENID_ENDPOINT) return null;
  const returnTo = query.get("openid.return_to") || "";
  if (!returnTo.startsWith(callbackUrl() + "?")) return null;
  const match = CLAIMED_ID.exec(query.get("openid.claimed_id") || "");
  if (!match || query.get("openid.identity") !== query.get("openid.claimed_id")) return null;

  const body = new URLSearchParams();
  for (const [k, v] of query) if (k.startsWith("openid.")) body.set(k, v);
  body.set("openid.mode", "check_authentication");

  const res = await fetch(OPENID_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const text = await res.text();
  return /^is_valid\s*:\s*true\s*$/m.test(text) ? match[1] : null;
}

export interface SteamProfile {
  steamId: string;
  personaName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
}

export async function getPlayerSummaries(steamIds: string[]): Promise<Map<string, SteamProfile>> {
  const out = new Map<string, SteamProfile>();
  if (!steamIds.length) return out;
  const url = `${API}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(env.steamApiKey)}&steamids=${steamIds.join(",")}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return out;
  const json = (await res.json()) as { response?: { players?: Record<string, unknown>[] } };
  for (const p of json.response?.players ?? []) {
    const id = String(p.steamid ?? "");
    out.set(id, {
      steamId: id,
      personaName: String(p.personaname ?? "").slice(0, 64),
      avatarUrl: httpsOrNull(p.avatarfull),
      profileUrl: httpsOrNull(p.profileurl),
    });
  }
  return out;
}

/** Whether the player owns STS2 and how long they've played. Both null when their game list is private. */
export async function getSts2Ownership(steamId: string): Promise<{ owns: boolean | null; minutes: number | null }> {
  const url =
    `${API}/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(env.steamApiKey)}` +
    `&steamid=${steamId}&include_played_free_games=1&appids_filter[0]=${env.sts2AppId}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { owns: null, minutes: null };
    const json = (await res.json()) as { response?: { game_count?: number; games?: { appid: number; playtime_forever?: number }[] } };
    const r = json.response;
    if (!r || r.game_count === undefined) return { owns: null, minutes: null }; // private profile
    const game = r.games?.find((g) => String(g.appid) === env.sts2AppId);
    return game ? { owns: true, minutes: game.playtime_forever ?? 0 } : { owns: false, minutes: null };
  } catch {
    return { owns: null, minutes: null };
  }
}

/** Pull the Workshop item id out of a pasted link (or a bare id). */
export function parseWorkshopId(input: string): string | null {
  const s = input.trim();
  if (/^\d{1,20}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!/(^|\.)steamcommunity\.com$/i.test(u.hostname)) return null;
    if (!/\/(sharedfiles|workshop)\/filedetails\/?$/i.test(u.pathname)) return null;
    const id = u.searchParams.get("id");
    return id && /^\d{1,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export interface WorkshopItem {
  workshopId: string;
  title: string;
  description: string;
  previewUrl: string | null;
  creatorSteamId: string | null;
  appId: string;
  updatedAt: string | null;
  subscriptions: number | null;
}

export type WorkshopLookup =
  | { ok: true; item: WorkshopItem }
  | { ok: false; reason: "not_found" | "wrong_game" | "unavailable" };

/**
 * Read public details for up to 100 Workshop items in one call. This endpoint needs no API key.
 * Returns null if Steam didn't answer; otherwise one lookup per requested id.
 */
export async function getWorkshopItems(workshopIds: string[]): Promise<Map<string, WorkshopLookup> | null> {
  const body = new URLSearchParams({ itemcount: String(workshopIds.length) });
  workshopIds.forEach((id, i) => body.set(`publishedfileids[${i}]`, id));
  let json: { response?: { publishedfiledetails?: Record<string, unknown>[] } };
  try {
    const res = await fetch(`${API}/ISteamRemoteStorage/GetPublishedFileDetails/v1/`, { method: "POST", body, cache: "no-store" });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }
  const out = new Map<string, WorkshopLookup>();
  for (const id of workshopIds) out.set(id, { ok: false, reason: "not_found" });
  for (const d of json.response?.publishedfiledetails ?? []) {
    const id = String(d.publishedfileid ?? "");
    if (!out.has(id)) continue;
    if (d.result !== 1 || d.banned) continue;
    const appId = String(d.consumer_app_id ?? d.creator_app_id ?? "");
    if (appId !== env.sts2AppId) { out.set(id, { ok: false, reason: "wrong_game" }); continue; }
    const updated = Number(d.time_updated);
    const subs = Number(d.subscriptions);
    out.set(id, {
      ok: true,
      item: {
        workshopId: id,
        title: String(d.title ?? "").slice(0, 200) || `Workshop item ${id}`,
        description: stripBbcode(String(d.description ?? "")).slice(0, 600),
        previewUrl: httpsOrNull(d.preview_url),
        creatorSteamId: /^\d{17}$/.test(String(d.creator ?? "")) ? String(d.creator) : null,
        appId,
        updatedAt: Number.isFinite(updated) && updated > 0 ? new Date(updated * 1000).toISOString() : null,
        subscriptions: Number.isFinite(subs) ? subs : null,
      },
    });
  }
  return out;
}

export async function getWorkshopItem(workshopId: string): Promise<WorkshopLookup> {
  const found = await getWorkshopItems([workshopId]);
  return found?.get(workshopId) ?? { ok: false, reason: "unavailable" };
}

function stripBbcode(s: string): string {
  return s.replace(/\[\/?[a-z0-9*]+(=[^\]]*)?\]/gi, "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function httpsOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}
