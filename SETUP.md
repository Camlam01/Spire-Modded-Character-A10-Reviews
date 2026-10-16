# STS2 Character Mod Reviews: setup

A Next.js site where Slay the Spire 2 players sign in with Steam and review Workshop character mods on 15 metrics for Ascension 10.

## How it fits together

- **Next.js** runs the pages and every server action. All database access happens on the server.
- **Supabase (Postgres)** stores players, mods and reviews. The server uses the secret service-role key, and row level security blocks the public key entirely.
- **Steam sign-in** uses Steam's OpenID login. The site never sees a Steam password, and each player is identified by their SteamID64.
- **Steam Web API** supplies each player's name, avatar, and whether they own STS2 (shown as a badge on their reviews). Workshop lookups need no key: pasting a Workshop link fills in the mod's name, author, description and preview image, and the site rejects items that aren't for STS2.
- Players can post one review per mod, which they can edit or delete, and can attach a short note to each metric score explaining it. Readers hover a score (or tap it on a phone) to read the note.
- Each review, and each mod's combined review, has its own discussion thread.
- Players can mark other players' reviews as helpful, and reviews can be sorted by most helpful, newest, or score.
- The compare page puts up to three mods side by side, metric by metric.
- Mod details are re-read from the Workshop in the background once a day, including the Workshop update date and subscriber count.
- Spam protection: every write is rate-limited per player (`lib/limits.ts`), and `REVIEW_OWNERSHIP` decides whether players must own STS2 to review.
- Admins (set in `ADMIN_STEAM_IDS`) can remove any mod, review or comment.

## 1. Create the database (Supabase)

1. Make a free project at https://supabase.com.
2. Open **SQL Editor** and run each file in `supabase/migrations/` in order: `0001_init.sql`, then `0002_discussion_votes_limits.sql`. If you already ran the first one, just run the second.
3. In **Project Settings → API**, copy the **Project URL** and the **service_role** secret key.

## 2. Get a Steam Web API key

1. Sign in at https://steamcommunity.com/dev/apikey. Your Steam account needs to have made a purchase on Steam.
2. For the domain, enter `localhost` for now. You can change it once the site has a real address.

## 3. Fill in your settings

Copy `.env.example` to `.env.local` and fill in each value. For `SESSION_SECRET`, generate a random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

To make yourself an admin, put your SteamID64 in `ADMIN_STEAM_IDS`. Your profile URL shows it as `steamcommunity.com/profiles/<17 digits>`; if you use a custom profile URL, a site like steamid.io will look it up.

## 4. Run it locally

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000. If a setting is missing, the site shows which one instead of the mod list.

Other commands:

```bash
npm test
```

```bash
npm run build
```

## 5. Put it online (Vercel)

1. Push this folder to a GitHub repository.
2. Import the repository at https://vercel.com/new.
3. Add the same settings under **Settings → Environment Variables**, with `SITE_URL` set to the live address (for example `https://sts2-reviews.vercel.app`). Steam sends players back to this address after sign-in, so it must match exactly.
4. Deploy, then change your Steam API key's domain to the live address.

## Project layout

| Path | What it is |
| --- | --- |
| `lib/metrics.ts` | The 15 metrics and their questions. Ids are stored in the database, so never rename one. |
| `lib/scoring.ts` | Totals and averages, shared by server and browser. Tested in `lib/scoring.test.ts`. |
| `lib/steam.ts` | Steam sign-in check, player profiles, STS2 ownership and Workshop lookups. |
| `lib/session.ts` | The signed login cookie. |
| `lib/data.ts` | Every database query. |
| `lib/limits.ts` | Rate limits for adding mods, saving reviews, commenting and voting. |
| `lib/refresh.ts` | Re-reads stale mods from the Workshop. |
| `app/actions.ts` | Every write: mods, reviews, votes, comments, signing out. |
| `app/api/auth/steam/` | The sign-in redirect and the return from Steam. |
| `components/` | The mod list, mod page, review form, discussion threads, compare table and metric switchboard. |
| `supabase/migrations/` | The database schema. |
| `prototype/` | The original single-page prototype. |

## Known gaps

- Players with a private game list can't be checked for ownership. With `REVIEW_OWNERSHIP=owners` they can still review and show a "Game list private" badge; switch to `verified` to require a public game list.
- Comments are a flat list per thread, with no replies or editing (players can delete and repost).
- The rate-limit log (`rate_events`) grows forever. Delete old rows occasionally, or add a scheduled clean-up later.
