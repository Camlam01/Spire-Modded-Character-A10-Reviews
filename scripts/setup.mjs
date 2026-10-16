// Interactive local setup: asks for your keys, writes .env.local, and checks the database and Steam key work.
// Run with: npm run setup
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
const rl = createInterface({ input: stdin, terminal: false });
// Reading line by line (rather than rl.question) also works when answers are piped in.
const lines = rl[Symbol.asyncIterator]();
async function readLine(prompt) {
  stdout.write(prompt);
  const { value, done } = await lines.next();
  if (done) { console.log("\nSetup stopped before it finished; nothing was written."); process.exit(1); }
  return value;
}

async function ask(question, { validate, optional = false } = {}) {
  for (;;) {
    const answer = (await readLine(question)).trim();
    if (!answer && optional) return "";
    const problem = !answer ? "This one is required." : validate?.(answer);
    if (!problem) return answer;
    console.log(`  ${problem}`);
  }
}

console.log("\nSTS2 Character Mod Reviews: local setup\n");
if (existsSync(envPath)) {
  const again = await readLine(".env.local already exists. Replace it? (y/N) ");
  if (!/^y/i.test(again)) { console.log("Left .env.local as it is."); rl.close(); process.exit(0); }
}

console.log("Supabase → Project Settings → API (or Data API) shows these two.");
const supabaseUrl = (await ask("  Project URL: ", {
  validate: (v) => (/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v) ? null : "It looks like https://abcdefgh.supabase.co"),
})).replace(/\/+$/, "");
const supabaseKey = await ask("  Secret key (service_role, not the anon/public one): ", {
  validate: (v) => (v.length > 30 ? null : "That's too short to be the secret key."),
});

console.log("\nSteam: https://steamcommunity.com/dev/apikey");
const steamKey = await ask("  Steam Web API key: ", {
  validate: (v) => (/^[0-9A-Fa-f]{32}$/.test(v) ? null : "Steam keys are 32 letters and numbers (0-9, A-F)."),
});

console.log("\nOptional: your SteamID64 makes you an admin (17 digits, shown in your Steam profile link).");
const adminId = await ask("  SteamID64 (press Enter to skip): ", {
  optional: true,
  validate: (v) => (/^\d{17}$/.test(v) ? null : "A SteamID64 is 17 digits, like 76561198000000000."),
});
rl.close();

writeFileSync(envPath, [
  "# Written by npm run setup. Never commit this file.",
  "SITE_URL=http://localhost:3000",
  `SUPABASE_URL=${supabaseUrl}`,
  `SUPABASE_SERVICE_ROLE_KEY=${supabaseKey}`,
  `STEAM_API_KEY=${steamKey}`,
  `SESSION_SECRET=${randomBytes(32).toString("base64url")}`,
  "STS2_APP_ID=2868840",
  "REVIEW_OWNERSHIP=owners",
  "REVIEW_MIN_RUNS=3",
  `ADMIN_STEAM_IDS=${adminId}`,
  "",
].join("\n"));
console.log("\nWrote .env.local. Checking your keys…");

// Check the database answers and has the site's tables.
try {
  const res = await fetch(`${supabaseUrl}/rest/v1/character_runs?select=steam_id&limit=1`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (res.ok) console.log("  ✓ Database is reachable and set up.");
  else if (res.status === 401 || res.status === 403) console.log("  ✗ Supabase rejected the secret key. Check you copied the service_role key.");
  else if (res.status === 404) console.log("  ✗ The database has no tables yet. Paste supabase/setup.sql into Supabase → SQL Editor and run it.");
  else console.log(`  ? Supabase answered with status ${res.status}. If the site shows database errors, check the URL and key.`);
} catch {
  console.log("  ✗ Couldn't reach Supabase. Check the Project URL and your internet connection.");
}

// Check the Steam key works.
try {
  const probe = adminId || "76561197960287930"; // Gabe Newell's public profile, if you skipped your own id
  const res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamKey}&steamids=${probe}`);
  if (res.ok) console.log("  ✓ Steam Web API key works.");
  else if (res.status === 401 || res.status === 403) console.log("  ✗ Steam rejected the API key. Check it at https://steamcommunity.com/dev/apikey");
  else console.log(`  ? Steam answered with status ${res.status}. Try again in a minute.`);
} catch {
  console.log("  ✗ Couldn't reach Steam. Check your internet connection.");
}

console.log("\nStart the site with: npm run dev   then open http://localhost:3000\n");
