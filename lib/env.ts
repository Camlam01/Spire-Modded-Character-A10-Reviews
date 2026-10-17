import "server-only";
import { createHmac } from "node:crypto";

// Settings come from .env.local locally, or from the host's environment variables. Several have fallbacks so a
// Vercel deployment with the Supabase integration needs only STEAM_API_KEY added by hand.

const first = (...names: string[]) => names.map((n) => process.env[n]).find((v) => !!v) || "";

/** The site's public address. Steam sends players back here after sign-in, so it must match what they visit. */
function resolveSiteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  // Vercel sets these itself: the production domain, or this deployment's own address on preview builds.
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return "";
}

// The Vercel Supabase integration may use either name for each value.
const supabaseUrl = () => first("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = () => first("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");

/** Names of required settings that are missing, so the site can show a setup page instead of crashing. */
export function missingEnv(): string[] {
  const missing: string[] = [];
  if (!resolveSiteUrl()) missing.push("SITE_URL");
  if (!supabaseUrl()) missing.push("SUPABASE_URL");
  if (!supabaseKey()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.STEAM_API_KEY) missing.push("STEAM_API_KEY");
  return missing;
}

function need(name: string, value: string): string {
  if (!value) throw new Error(`Missing ${name}. Run "npm run setup", or add it to your host's environment variables.`);
  return value;
}

export const env = {
  get siteUrl() { return need("SITE_URL", resolveSiteUrl()).replace(/\/+$/, ""); },
  get supabaseUrl() { return need("SUPABASE_URL", supabaseUrl()); },
  get supabaseKey() { return need("SUPABASE_SERVICE_ROLE_KEY", supabaseKey()); },
  get steamApiKey() { return need("STEAM_API_KEY", process.env.STEAM_API_KEY || ""); },
  /**
   * Signs login cookies. Uses SESSION_SECRET when set; otherwise it's derived from the Supabase secret key, which is
   * already private to the server. Changing either one signs everyone out.
   */
  get sessionSecret() {
    const s = process.env.SESSION_SECRET;
    if (s) {
      if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
      return s;
    }
    return createHmac("sha256", need("SUPABASE_SERVICE_ROLE_KEY", supabaseKey())).update("sts2r-session-v1").digest("base64url");
  },
  get sts2AppId() { return process.env.STS2_APP_ID || "2868840"; },
  /**
   * Who may post reviews:
   * "anyone"      - any signed-in player
   * "owners"      - blocks players Steam shows as not owning STS2; private game lists are allowed (default)
   * "verified"    - only players Steam confirms own STS2 (private game lists are blocked)
   */
  get reviewOwnership(): "anyone" | "owners" | "verified" {
    const v = process.env.REVIEW_OWNERSHIP;
    return v === "anyone" || v === "verified" ? v : "owners";
  },
  get adminIds(): Set<string> {
    return new Set((process.env.ADMIN_STEAM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean));
  },
};
