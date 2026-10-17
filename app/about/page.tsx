import Link from "next/link";
import { env } from "@/lib/env";
import { CATEGORIES, METRICS } from "@/lib/metrics";
import { VERIFY_RULE } from "@/lib/runs";

export const metadata = { title: "About and privacy" };

export default function AboutPage() {
  const contact = [...env.adminIds][0];

  return (
    <article className="prose">
      <h2>About and privacy</h2>

      <h3>What this site is</h3>
      <p>
        Community reviews of Slay the Spire 2 character mods from the Steam Workshop, written for players who want balanced,
        interesting characters at Ascension 10. It’s a fan project, not affiliated with Mega Crit or Valve.
      </p>

      <h3>How scores work</h3>
      <ul>
        <li>Reviewers score {METRICS.length} metrics in {CATEGORIES.length} groups ({CATEGORIES.map((c) => c.name).join(", ")}) from 0 to 10, where 10 is always the best answer.</li>
        <li>A mod’s combined review averages every review, metric by metric. Its total is the average of those metrics.</li>
        <li>You can switch metrics off in the sidebar, and every total recalculates around the ones you care about.</li>
        <li>A review shows <strong>Verified</strong> when its author has scanned run history showing {VERIFY_RULE}. Only runs completed in full count.</li>
      </ul>

      <h3>What’s stored about you</h3>
      <p>Only when you sign in with Steam:</p>
      <ul>
        <li>Your SteamID64, Steam display name, avatar and profile link, read from Steam when you sign in.</li>
        <li>Whether you own Slay the Spire 2 and your playtime, if your Steam game details are public.</li>
        <li>What you post: reviews, notes, comments, helpful votes, reports, and mods you add.</li>
        <li>If you scan your run history: for each modded character, your number of A10 runs, A10 wins and the date of your latest run. Your run files are read in your browser and never uploaded, and wins are never shown publicly.</li>
        <li>A short log of when you post, used only to stop spam.</li>
      </ul>
      <p>
        Your Steam password never reaches this site: sign-in happens on Steam’s own page. The site sets one cookie to keep you
        signed in, and remembers display preferences (like which metrics are switched on) in your browser only.
      </p>

      <h3>Who handles the data</h3>
      <p>
        The site runs on Vercel and stores its data with Supabase. Player names, avatars and Workshop details come from Steam.
        Nothing is sold or shared for advertising.
      </p>

      <h3>Deleting your data</h3>
      <p>
        Open <Link href="/profile">your profile</Link> and use <strong>Delete my account</strong> at the bottom. It removes your
        profile, reviews, comments, votes and run counts straight away.
        {contact ? (
          <> For anything else, contact the site’s admin <a href={`https://steamcommunity.com/profiles/${contact}`} target="_blank" rel="noopener noreferrer">on Steam</a>.</>
        ) : null}
      </p>
    </article>
  );
}
