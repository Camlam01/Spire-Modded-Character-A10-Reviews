import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RunScan } from "@/components/RunScan";
import { ProfileReviewTotal } from "@/components/ProfileReviewTotal";
import { getCharacterRuns, getPlayerProfile, getPlayerReviews } from "@/lib/data";
import { missingEnv } from "@/lib/env";
import { characterName, isModdedCharacter } from "@/lib/runs";
import { cleanScores } from "@/lib/scoring";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ steamId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (missingEnv().length) return {};
  const { steamId } = await params;
  const p = /^\d{17}$/.test(steamId) ? await getPlayerProfile(steamId) : null;
  return p ? { title: p.persona_name || "Player" } : {};
}

export default async function PlayerPage({ params }: Props) {
  if (missingEnv().length) return null;
  const [{ steamId }, session] = await Promise.all([params, getSession()]);
  if (!/^\d{17}$/.test(steamId)) notFound();
  const player = await getPlayerProfile(steamId);
  if (!player) notFound();
  const [characters, reviews] = await Promise.all([getCharacterRuns(steamId), getPlayerReviews(steamId)]);
  const isMe = session?.steamId === steamId;
  const totalA10 = characters.reduce((n, c) => n + c.a10Runs, 0);

  return (
    <>
      <div className="modhead profile-head">
        {player.avatar_url ? <img className="avatar-lg" src={player.avatar_url} alt="" /> : null}
        <div>
          <h2>{player.persona_name || "Steam player"}{isMe ? <span className="tag">You</span> : null}</h2>
          <div className="meta num">
            {[totalA10 ? `${totalA10} verified A10 ${totalA10 === 1 ? "run" : "runs"}` : "No verified runs yet",
              `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`].join(" · ")}
          </div>
          {player.profile_url ? <div className="actions"><a className="btn small" href={player.profile_url} target="_blank" rel="noopener noreferrer">Steam profile ↗</a></div> : null}
        </div>
      </div>

      {isMe ? <RunScan viewerId={steamId} lastScanned={player.runs_scanned_at} /> : null}

      <div className="section-title">
        <h3>Characters played at A10</h3>
        <span>Finished solo runs at Ascension 10, verified from run history files.</span>
      </div>
      {characters.length ? (
        <div className="table-wrap">
          <table className="ctable chars">
            <thead><tr><th scope="col">Character</th><th scope="col">Mod</th><th scope="col">A10 runs</th></tr></thead>
            <tbody>
              {characters.map((c) => (
                <tr key={c.characterId}>
                  <td title={c.characterId}>{characterName(c.characterId)}</td>
                  <td>
                    {c.mods.length ? c.mods.map((m, i) => <span key={m.id}>{i ? ", " : ""}<Link href={`/mods/${m.id}`}>{m.title}</Link></span>)
                      : isModdedCharacter(c.characterId) ? <span className="by">Not listed here yet</span> : <span className="by">Base game</span>}
                  </td>
                  <td className="num">{c.a10Runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty"><p>{isMe ? "Scan your run history above to list the characters you’ve played." : "This player hasn’t verified any runs yet."}</p></div>
      )}

      <div className="section-title"><h3>Reviews</h3></div>
      {reviews.length ? (
        <div className="reviews">
          {reviews.filter((r) => r.mods).map((r) => (
            <Link key={r.id} className="card profile-review" href={`/mods/${r.mods!.id}`}>
              <div className="card-head">
                <ProfileReviewTotal scores={cleanScores(r.scores)} />
                <div><h3>{r.mods!.title}</h3><div className="by">{new Date(r.updated_at).toLocaleDateString()}</div></div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty"><p>No reviews yet.</p></div>
      )}
    </>
  );
}
