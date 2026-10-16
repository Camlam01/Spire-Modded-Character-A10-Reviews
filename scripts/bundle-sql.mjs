// Combines every file in supabase/migrations into supabase/setup.sql, so a new database is set up with one paste.
// Run with: npm run db:bundle   (do this after adding or changing a migration)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function bundleSql() {
  const dir = join(root, "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const parts = files.map((f) => `-- ===== ${f} =====\n\n${readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n").trim()}\n`);
  return [
    "-- STS2 Character Mod Reviews: complete database setup.",
    "-- Paste this whole file into Supabase → SQL Editor and run it once, on a new project.",
    "-- Generated from supabase/migrations by `npm run db:bundle`; don't edit it by hand.",
    "-- Already set up? Run only the migration files you haven't run yet instead.",
    "",
    ...parts,
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(root, "supabase", "setup.sql"), bundleSql());
  console.log("Wrote supabase/setup.sql");
}
