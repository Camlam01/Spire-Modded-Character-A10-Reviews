import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { env } from "./env";

const COOKIE = "sts2r_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const key = () => new TextEncoder().encode(env.sessionSecret);
const secure = () => env.siteUrl.startsWith("https://");

export interface Session {
  steamId: string;
}

export async function createSession(steamId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(steamId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: MAX_AGE });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" && /^\d{17}$/.test(payload.sub) ? { steamId: payload.sub } : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export const isAdmin = (s: Session | null): boolean => !!s && env.adminIds.has(s.steamId);
