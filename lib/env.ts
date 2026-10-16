import "server-only";

const REQUIRED = ["SITE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STEAM_API_KEY", "SESSION_SECRET"] as const;

/** Names of required settings that are missing, so the site can show a setup page instead of crashing. */
export const missingEnv = (): string[] => REQUIRED.filter((k) => !process.env[k]);

function need(name: (typeof REQUIRED)[number]): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  return v;
}

export const env = {
  get siteUrl() { return need("SITE_URL").replace(/\/+$/, ""); },
  get supabaseUrl() { return need("SUPABASE_URL"); },
  get supabaseKey() { return need("SUPABASE_SERVICE_ROLE_KEY"); },
  get steamApiKey() { return need("STEAM_API_KEY"); },
  get sessionSecret() {
    const s = need("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
    return s;
  },
  get sts2AppId() { return process.env.STS2_APP_ID || "2868840"; },
  get adminIds(): Set<string> {
    return new Set((process.env.ADMIN_STEAM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean));
  },
};
