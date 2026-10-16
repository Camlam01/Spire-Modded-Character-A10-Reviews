import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReviewForm } from "@/components/ReviewForm";
import { getMod, getMyReview } from "@/lib/data";
import { missingEnv } from "@/lib/env";
import { cleanScores } from "@/lib/scoring";
import { getSession } from "@/lib/session";

export const metadata = { title: "Write a review" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (missingEnv().length) return null;
  const [{ id }, session] = await Promise.all([params, getSession()]);
  if (!session) redirect(`/api/auth/steam/login?next=${encodeURIComponent(`/mods/${id}/review`)}`);
  const mod = await getMod(id, session.steamId);
  if (!mod) notFound();
  const mine = await getMyReview(mod.id, session.steamId);

  return (
    <>
      <Link className="back" href={`/mods/${mod.id}`}>← Back to {mod.title}</Link>
      <ReviewForm
        modId={mod.id}
        modTitle={mod.title}
        existing={mine ? { a10Runs: mine.a10_runs, notes: mine.notes, scores: cleanScores(mine.scores) } : null}
      />
    </>
  );
}
