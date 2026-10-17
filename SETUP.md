# STS2 Character Mod Reviews: setup

A Next.js site where Slay the Spire 2 players sign in with Steam and review Workshop character mods on 14 metrics for Ascension 10.

Setup takes about 20 minutes, most of it creating accounts. You need free accounts on **GitHub**, **Vercel** and **Supabase**, plus a Steam account that has bought something on Steam (Steam's rule for API keys).

## Put it online

### 1. Get a Steam Web API key (2 minutes)

Sign in at https://steamcommunity.com/dev/apikey and register a key. For the domain, enter the address you plan to use, such as `sts2-reviews.vercel.app`; Steam doesn't check it. Keep the key handy.

### 2. Put the code on GitHub (3 minutes)

Create an empty repository at https://github.com/new (no README or licence), then run these in this folder, using your repository's address:

```bash
git remote add origin https://github.com/YOUR-NAME/sts2-mod-reviews.git
```

```bash
git push -u origin main
```

### 3. Create the site on Vercel (5 minutes)

1. At https://vercel.com/new, import the repository.
2. Before pressing **Deploy**, open **Environment Variables** and add:
   - `STEAM_API_KEY`: your key from step 1.
   - `ADMIN_STEAM_IDS`: your SteamID64, to make yourself an admin (optional). It's the 17 digits in `steamcommunity.com/profiles/…`; if you use a custom profile link, steamid.io looks it up.
3. Press **Deploy**. The site shows a "Finish setting up" page until the database exists.

### 4. Add the database (5 minutes)

1. In your Vercel project, open **Storage → Create Database → Supabase** and connect it to the project. This creates a Supabase project and adds its settings to Vercel for you.
2. Click **Open in Supabase**, go to **SQL Editor**, paste the whole of `supabase/setup.sql`, and press **Run**.
3. Back in Vercel, open **Deployments**, then on the latest one press **⋯ → Redeploy**, so the site picks up the database settings.

Open your site and sign in with Steam. Done.

If the site still says settings are missing, the Supabase connection used different names. Copy the **Project URL** and **service_role** secret key from Supabase → **Project Settings → API** into Vercel as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then redeploy.

## Run it on your computer (optional)

Useful for trying changes before they go live. With the database from step 4 already set up:

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run dev
```

`npm run setup` asks for your Supabase URL and secret key and your Steam key, writes `.env.local`, and checks that the database and key work. Then open http://localhost:3000. Run the tests with `npm test`.

## Settings

Everything except the first three has a sensible default.

| Setting | What it does |
| --- | --- |
| `STEAM_API_KEY` | Required. Player names, avatars and STS2 ownership. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Required. Added for you by Vercel's Supabase connection, or by `npm run setup` locally. |
| `ADMIN_STEAM_IDS` | Comma-separated SteamID64s who can remove mods, reviews and comments, and fix character links. |
| `REVIEW_OWNERSHIP` | `owners` (default) blocks players Steam shows as not owning STS2. `verified` also blocks private game lists. `anyone` turns the check off. |
| `SITE_URL` | Only needed for a custom domain outside Vercel. On Vercel the site detects its own address, and locally it's `http://localhost:3000`. |
| `SESSION_SECRET` | Optional. Signs login cookies; when unset, one is derived from the Supabase secret key. |
| `STS2_APP_ID` | Slay the Spire 2's Steam app id, `2868840`. |

## Updating the site later

Push changes to GitHub and Vercel redeploys on its own. When a change adds a file to `supabase/migrations/`, run just that file in Supabase's SQL Editor, then run `npm run db:bundle` so `supabase/setup.sql` stays complete for anyone setting up from scratch (`npm test` fails if you forget).

## What the site does

- **Next.js** runs the pages and every server action. All database access happens on the server.
- **Supabase (Postgres)** stores players, mods, reviews, comments and run counts. The server uses the secret key, and row level security blocks the public key entirely.
- **Steam sign-in** uses Steam's OpenID login. The site never sees a Steam password, and each player is identified by their SteamID64.
- **Steam Web API** supplies each player's name, avatar, and whether they own STS2. Workshop lookups need no key: pasting a Workshop link fills in the mod's name, author, description and preview image. Only STS2 items tagged "Characters" are accepted.
- Players post one review per mod, which they can edit or delete, and can attach a short note to each metric score. Readers hover a score (or tap it on a phone) to read the note.
- Each review, and each mod's combined review, has its own discussion thread.
- Players can mark other players' reviews as helpful, and reviews can be sorted by most helpful, newest, or score.
- The compare page puts up to three mods side by side, metric by metric.
- Mod details are re-read from the Workshop in the background once a day, including the update date and subscriber count.
- **Run verification:** anyone signed in can review any mod. A review shows **✓ Verified** once its author has scanned their STS2 run history (from their profile) showing 10 A10 runs or 3 A10 wins with the mod's character. The browser reads the `.run` files and sends only per-character counts for modded characters: A10 runs, A10 wins and the latest run date. Only runs completed in full count. Wins decide verification but are never shown. Profiles list each modded character played with its A10 run count. No public Steam profile is needed, and a "Copy folder path" button makes picking the folder a paste into the folder window.
- **Character linking:** mods link to their in-game character automatically by matching the Workshop title to the character's mod prefix (for example "The Tailor (Beta Branch)" → `CHARACTER.THETAILOR-THE_TAILOR`). When the title doesn't match, the first reviewer picks the character from their runs. Admins can correct links on the mod page.
- **Spam protection:** every write is rate-limited per player (`lib/limits.ts`).

## Project layout

| Path | What it is |
| --- | --- |
| `lib/metrics.ts` | The 14 metrics and their questions. Ids are stored in the database, so never rename one. |
| `lib/scoring.ts` | Totals and averages, shared by server and browser. Tested in `lib/scoring.test.ts`. |
| `lib/runs.ts` | Reads STS2 run history files in the browser and matches mod titles to characters. Tested in `lib/runs.test.ts`. |
| `lib/steam.ts` | Steam sign-in check, player profiles, STS2 ownership and Workshop lookups. |
| `lib/env.ts` | Reads settings, including the Vercel and Supabase fallbacks. |
| `lib/session.ts` | The signed login cookie. |
| `lib/data.ts` | Every database query. |
| `lib/linking.ts` | Links mods to characters automatically. |
| `lib/limits.ts` | Rate limits for adding mods, saving reviews, commenting, voting and scanning. |
| `lib/refresh.ts` | Re-reads stale mods from the Workshop. |
| `app/actions.ts` | Every write: mods, reviews, votes, comments, run scans, character links, signing out. |
| `app/api/auth/steam/` | The sign-in redirect and the return from Steam. |
| `components/` | Page pieces: mod list, mod page, review form, discussion, compare table, run scan, metric switchboard. |
| `supabase/setup.sql` | The whole database in one file, for new setups. Generated from `supabase/migrations/`. |
| `scripts/` | `npm run setup` and `npm run db:bundle`. |
| `prototype/` | The original single-page prototype. |

## Known gaps

- Run verification is evidence, not proof. Run files are plain text, so a determined player could fake them. Because only counts are stored, the site can't tell when two accounts submit the same runs (for example a copied run folder), and a mod counts every A10 run with its character, including runs from before it was published. The browser still skips runs whose file name doesn't match the run inside.
- Co-op runs aren't counted, because the files don't reliably say which player you were.
- Run history locations on Mac and Linux are educated guesses until someone confirms them.
- Players with a private game list can't be checked for ownership. With `REVIEW_OWNERSHIP=owners` they can still review and show a "Game list private" badge.
- Comments are a flat list per thread, with no replies or editing (players can delete and repost).
- The rate-limit log (`rate_events`) grows forever. Delete old rows occasionally, or add a scheduled clean-up later.
