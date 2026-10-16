import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModDetail } from "@/components/ModDetail";
import { getMod, getReviews } from "@/lib/data";
import { missingEnv } from "@/lib/env";
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
  const mod = await getMod(id, session?.steamId ?? null);
  if (!mod) notFound();
  const reviews = await getReviews(mod.id);
  return <ModDetail mod={mod} reviews={reviews} viewerId={session?.steamId ?? null} admin={isAdmin(session)} />;
}
