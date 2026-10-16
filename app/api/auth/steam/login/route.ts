import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { steamLoginUrl } from "@/lib/steam";
import { safeNextPath } from "@/lib/paths";

const OID_COOKIE = "sts2r_oid";

// Sends the player to Steam to sign in. A one-time nonce in a cookie ties the callback to this browser.
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const nonce = randomBytes(18).toString("base64url");
  (await cookies()).set(OID_COOKIE, JSON.stringify({ nonce, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.siteUrl.startsWith("https://"),
    path: "/api/auth/steam",
    maxAge: 600,
  });
  return NextResponse.redirect(steamLoginUrl(nonce));
}
