# STS2 Character Mod Reviews: setup

A Next.js site where Slay the Spire 2 players sign in with Steam and review Workshop character mods on 15 metrics for Ascension 10.

## How it fits together

- **Next.js** runs the pages and every server action. All database access happens on the server.
- **Supabase (Postgres)** stores players, mods and reviews. The server uses the secret service-role key, and row level security blocks the public key entirely.
- **Steam sign-in** uses Steam's OpenID login. The site never sees a Steam password, and each player is identified by their SteamID64.
- **Steam Web API** supplies each player's name, avatar, and whether they own STS2 (shown as a badge on their reviews). Workshop lookups need no key: pasting a Workshop link fills in the mod's name, author, description and preview image, and the site rejects items that aren't for STS2.
- Players can post one review per mod, which they can edit or delete. Admins (set in `ADMIN_STEAM_IDS`) can remove any mod or review.

## 1. Create the database (Supabase)

1. Make a free project at https://supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`, and run it.
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
| `app/actions.ts` | Adding mods, saving and deleting reviews, signing out. |
| `app/api/auth/steam/` | The sign-in redirect and the return from Steam. |
| `components/` | The mod list, mod page, review form and metric switchboard. |
| `supabase/migrations/` | The database schema. |
| `prototype/` | The original single-page prototype. |

## Known gaps

- There is no rate limit on adding mods or posting reviews yet. Steam sign-in already makes spam much harder, but add one before you promote the site widely.
- Owning STS2 is shown as a badge, not required. Players with a private game list show "Game list private".
- Mod details are copied from Steam when the mod is added and aren't refreshed afterwards.
