import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReviewForm } from "@/components/ReviewForm";
import { LinkCharacterForm } from "@/components/CharacterLink";
import { getCharacterRuns, getMod, getMyReview, getRunStats } from "@/lib/data";
import { env, missingEnv } from "@/lib/env";
import { isModdedCharacter } from "@/lib/runs";
import { cleanMetricNotes, cleanScores } from "@/lib/scoring";
import { getSession } from "@/lib/session";

export const metadata = { title: "Write a review" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (missingEnv().length) return null;
  const [{ id }, session] = await Promise.all([params, getSession()]);
  if (!session) redirect(`/api/auth/steam/login?next=${encodeURIComponent(`/mods/${id}/review`)}`);
  const mod = await getMod(id, session.steamId);
  if (!mod) notFound();
  const back = <Link className="back" href={`/mods/${mod.id}`}>← Back to {mod.title}</Link>;
  const needed = env.reviewMinRuns;

  // The mod isn't linked to a character yet: the reviewer says which of theirs it is.
  if (!mod.characterIds.length) {
    const options = (await getCharacterRuns(session.steamId)).filter((c) => isModdedCharacter(c.characterId) && !c.mods.length);
    return (
      <>
        {back}
        {options.length ? (
          <LinkCharacterForm modId={mod.id} modTitle={mod.title} options={options} />
        ) : (
          <div className="empty">
            <h3>Scan your runs first</h3>
            <p>
              Reviews come from players who have played the character at Ascension 10. Scan your Slay the Spire 2 run history from
              your profile; if you’ve played {mod.title}, it will be linked automatically or you’ll be asked to pick its character here.
            </p>
            <Link className="btn primary" href="/profile">Go to your profile</Link>
          </div>
        )}
      </>
    );
  }

  const [mine, runs] = await Promise.all([getMyReview(mod.id, session.steamId), getRunStats(session.steamId, mod.id)]);
  const have = runs?.a10Runs ?? 0;
  if (needed > 0 && have < needed) {
    return (
      <>
        {back}
        <div className="empty">
          <h3>Play a few more A10 runs first</h3>
          <p>
            Reviewing {mod.title} needs at least {needed} verified A10 {needed === 1 ? "run" : "runs"} with its character, finished
            without abandoning (wins and losses both count). You have {have}. If you’ve played more since your last scan, rescan from your profile.
          </p>
          <Link className="btn primary" href="/profile">Scan your runs</Link>
        </div>
      </>
    );
  }

  return (
    <>
      {back}
      <ReviewForm
        modId={mod.id}
        modTitle={mod.title}
        verified={runs}
        existing={mine ? { notes: mine.notes, scores: cleanScores(mine.scores), metricNotes: cleanMetricNotes(mine.metric_notes) } : null}
      />
    </>
  );
}
