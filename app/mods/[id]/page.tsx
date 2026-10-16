import type { Metadata } from "next";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { ModDetail } from "@/components/ModDetail";
import { getComments, getMod, getReviews } from "@/lib/data";
import { missingEnv } from "@/lib/env";
import { refreshStaleMods } from "@/lib/refresh";
import { getSession, isAdmin } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (missingEnv().length) return {};
  const mod = await getMod((await params).id, null);
  return mod ? { title: mod.title } : {};
}

export default async function ModPage({ params }: Props) {
  if (missingEnv().length) return null;
  const [{ id }, session] = await Promise.all([params, getSession()]);
  const viewer = session?.steamId ?? null;
  const mod = await getMod(id, viewer);
  if (!mod) notFound();
  const [reviews, comments] = await Promise.all([getReviews(mod.id, viewer), getComments(mod.id)]);
  after(() => refreshStaleMods(1, mod.id).catch((e) => console.error("Workshop refresh failed", e)));
  return <ModDetail mod={mod} reviews={reviews} comments={comments} viewerId={viewer} admin={isAdmin(session)} />;
}
