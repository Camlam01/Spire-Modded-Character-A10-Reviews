import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { getPlayerSummaries, getSts2Ownership, verifySteamLogin } from "@/lib/steam";
import { upsertPlayer } from "@/lib/data";
import { createSession } from "@/lib/session";
import { safeNextPath } from "@/lib/paths";

const OID_COOKIE = "sts2r_oid";

// Steam sends the player back here after sign-in.
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const raw = jar.get(OID_COOKIE)?.value;
  jar.delete({ name: OID_COOKIE, path: "/api/auth/steam" });
  const fail = () => NextResponse.redirect(`${env.siteUrl}/?signin=failed`);

  let saved: { nonce?: string; next?: string } = {};
  try { saved = raw ? JSON.parse(raw) : {}; } catch {}
  const nonce = req.nextUrl.searchParams.get("n") || "";
  if (!saved.nonce || !sameString(saved.nonce, nonce)) return fail();

  const steamId = await verifySteamLogin(req.nextUrl.searchParams);
  if (!steamId) return fail();

  const [profiles, ownership] = await Promise.all([getPlayerSummaries([steamId]), getSts2Ownership(steamId)]);
  const p = profiles.get(steamId);
  await upsertPlayer({
    steamId,
    personaName: p?.personaName || "Steam player",
    avatarUrl: p?.avatarUrl ?? null,
    profileUrl: p?.profileUrl ?? `https://steamcommunity.com/profiles/${steamId}`,
    ownsGame: ownership.owns,
    playtimeMinutes: ownership.minutes,
  });
  await createSession(steamId);
  return NextResponse.redirect(`${env.siteUrl}${safeNextPath(saved.next)}`);
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
