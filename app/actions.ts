"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, getSession, isAdmin } from "@/lib/session";
import { getPlayerSummaries, getWorkshopItem, parseWorkshopId } from "@/lib/steam";
import { deleteMod, deleteReview, findModByWorkshopId, getMod, insertMod, isUuid, upsertReview } from "@/lib/data";
import { cleanScores } from "@/lib/scoring";

export type FormState = { error: string } | null;

export async function signOutAction() {
  await clearSession();
  redirect("/");
}

export async function addModAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Sign in with Steam to add a mod." };

  const workshopId = parseWorkshopId(String(form.get("workshop") ?? ""));
  if (!workshopId) return { error: "Paste the mod’s Steam Workshop link, like https://steamcommunity.com/sharedfiles/filedetails/?id=1234567890" };

  const existing = await findModByWorkshopId(workshopId);
  if (existing) redirect(`/mods/${existing}`);

  const lookup = await getWorkshopItem(workshopId);
  if (!lookup.ok) {
    if (lookup.reason === "wrong_game") return { error: "That Workshop item isn’t for Slay the Spire 2." };
    if (lookup.reason === "not_found") return { error: "Steam couldn’t find that Workshop item. It may be private, hidden or removed." };
    return { error: "Steam didn’t respond. Try again in a minute." };
  }
  const { item } = lookup;
  const creator = item.creatorSteamId ? (await getPlayerSummaries([item.creatorSteamId])).get(item.creatorSteamId) : undefined;

  let modId: string;
  try {
    modId = await insertMod({
      workshopId: item.workshopId,
      title: item.title,
      description: item.description,
      previewUrl: item.previewUrl,
      creatorSteamId: item.creatorSteamId,
      creatorName: creator?.personaName || null,
      addedBy: session.steamId,
    });
  } catch (e) {
    // Someone else added it a moment ago.
    const raced = await findModByWorkshopId(workshopId);
    if (raced) redirect(`/mods/${raced}`);
    throw e;
  }
  revalidatePath("/");
  redirect(`/mods/${modId}`);
}

export async function saveReviewAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Your Steam sign-in expired. Sign in again to post your review." };

  const modId = String(form.get("modId") ?? "");
  if (!isUuid(modId) || !(await getMod(modId, null))) return { error: "This mod isn’t listed any more." };

  let parsed: unknown = null;
  try { parsed = JSON.parse(String(form.get("scores") ?? "{}")); } catch {}
  const scores = cleanScores(parsed);
  if (!Object.keys(scores).length) return { error: "Score at least one metric before posting." };

  const runsRaw = String(form.get("a10Runs") ?? "").trim();
  let a10Runs: number | null = null;
  if (runsRaw) {
    a10Runs = Number(runsRaw);
    if (!Number.isInteger(a10Runs) || a10Runs < 0 || a10Runs > 100000) return { error: "A10 runs played should be a whole number." };
  }
  const notes = String(form.get("notes") ?? "").trim().slice(0, 4000);

  await upsertReview({ modId, steamId: session.steamId, a10Runs, notes, scores });
  revalidatePath("/");
  revalidatePath(`/mods/${modId}`);
  redirect(`/mods/${modId}`);
}

export async function deleteReviewAction(form: FormData) {
  const session = await getSession();
  const reviewId = String(form.get("reviewId") ?? "");
  const modId = String(form.get("modId") ?? "");
  if (!session || !isUuid(reviewId) || !isUuid(modId)) return;
  // Players delete their own review; admins can remove any.
  await deleteReview(reviewId, isAdmin(session) && form.get("asAdmin") === "1" ? null : session.steamId);
  revalidatePath("/");
  revalidatePath(`/mods/${modId}`);
}

export async function deleteModAction(form: FormData) {
  const session = await getSession();
  const modId = String(form.get("modId") ?? "");
  if (!isAdmin(session) || !isUuid(modId)) return;
  await deleteMod(modId);
  revalidatePath("/");
  redirect("/");
}
