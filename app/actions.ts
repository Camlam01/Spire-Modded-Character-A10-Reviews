"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, getSession, isAdmin } from "@/lib/session";
import { env } from "@/lib/env";
import { COMMENT_MAX, RATE_LIMITS } from "@/lib/limits";
import { CHARACTER_COUNTS, characterName, isModdedCharacter, RUN_SUMMARY } from "@/lib/runs";
import { autoLinkMods } from "@/lib/linking";
import { getPlayerSummaries, getSts2Ownership, getWorkshopItem, parseWorkshopId } from "@/lib/steam";
import {
  deleteComment, deleteMod, deleteReview, findModByWorkshopId, getCharacterRuns, getMod, getPlayer, getReviewMeta,
  insertComment, insertMod, isUuid, linkedCharacterIds, markRunsScanned, setModCharacterIds, takeRateToken, toggleVote,
  updateOwnership, upsertCharacterRuns, upsertReview,
} from "@/lib/data";
import { cleanMetricNotes, cleanScores } from "@/lib/scoring";

export type FormState = { error?: string; ok?: number; message?: string } | null;

const revalidateMod = (modId: string) => {
  revalidatePath("/");
  revalidatePath(`/mods/${modId}`);
  revalidatePath("/compare");
};

export async function signOutAction() {
  await clearSession();
  redirect("/");
}

/* ---------- mods ---------- */

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
  if (!lookup.item.tags.includes("Characters")) {
    return { error: "That Workshop item isn’t tagged as a character mod. This site only reviews character mods; if it adds a character, ask its author to add the Characters tag on the Workshop." };
  }
  if (!(await takeRateToken(session.steamId, "mod"))) return { error: RATE_LIMITS.mod.message };

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
      workshopUpdatedAt: item.updatedAt,
      workshopCreatedAt: item.createdAt,
      subscriptions: item.subscriptions,
    });
  } catch (e) {
    // Someone else added it a moment ago.
    const raced = await findModByWorkshopId(workshopId);
    if (raced) redirect(`/mods/${raced}`);
    throw e;
  }
  await autoLinkMods();
  revalidatePath("/");
  redirect(`/mods/${modId}`);
}

export async function deleteModAction(form: FormData) {
  const session = await getSession();
  const modId = String(form.get("modId") ?? "");
  if (!isAdmin(session) || !isUuid(modId)) return;
  await deleteMod(modId);
  revalidatePath("/");
  redirect("/");
}

/* ---------- reviews ---------- */

/** Applies REVIEW_OWNERSHIP. Re-checks Steam when we don't already know the player owns STS2. */
async function ownershipProblem(steamId: string): Promise<string | null> {
  const policy = env.reviewOwnership;
  if (policy === "anyone") return null;
  let owns = (await getPlayer(steamId))?.owns_game ?? null;
  if (owns !== true) {
    const fresh = await getSts2Ownership(steamId);
    owns = fresh.owns;
    await updateOwnership(steamId, fresh.owns, fresh.minutes);
  }
  if (owns === false) return "Steam shows that you don’t own Slay the Spire 2, so you can’t post reviews yet.";
  if (owns === null && policy === "verified") {
    return "Reviews need Steam to confirm you own Slay the Spire 2. Set your Steam profile’s “Game details” to Public, then try again.";
  }
  return null;
}

export async function saveReviewAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Your Steam sign-in expired. Sign in again to post your review." };

  const modId = String(form.get("modId") ?? "");
  if (!isUuid(modId) || !(await getMod(modId, null))) return { error: "This mod isn’t listed any more." };

  let parsedScores: unknown = null, parsedNotes: unknown = null;
  try { parsedScores = JSON.parse(String(form.get("scores") ?? "{}")); } catch {}
  try { parsedNotes = JSON.parse(String(form.get("metricNotes") ?? "{}")); } catch {}
  const scores = cleanScores(parsedScores);
  if (!Object.keys(scores).length) return { error: "Score at least one metric before posting." };
  // A note only makes sense next to a score.
  const metricNotes = Object.fromEntries(Object.entries(cleanMetricNotes(parsedNotes)).filter(([id]) => id in scores));

  const notes = String(form.get("notes") ?? "").trim().slice(0, 4000);

  const blocked = await ownershipProblem(session.steamId);
  if (blocked) return { error: blocked };
  if (!(await takeRateToken(session.steamId, "review"))) return { error: RATE_LIMITS.review.message };

  await upsertReview({ modId, steamId: session.steamId, notes, scores, metricNotes });
  revalidateMod(modId);
  redirect(`/mods/${modId}`);
}

export async function deleteReviewAction(form: FormData) {
  const session = await getSession();
  const reviewId = String(form.get("reviewId") ?? "");
  const modId = String(form.get("modId") ?? "");
  if (!session || !isUuid(reviewId) || !isUuid(modId)) return;
  // Players delete their own review; admins can remove any.
  await deleteReview(reviewId, isAdmin(session) && form.get("asAdmin") === "1" ? null : session.steamId);
  revalidateMod(modId);
}

export async function voteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Sign in with Steam to vote." };
  const review = await getReviewMeta(String(form.get("reviewId") ?? ""));
  if (!review) return { error: "That review was deleted." };
  if (review.steam_id === session.steamId) return { error: "You can’t vote on your own review." };
  if (!(await takeRateToken(session.steamId, "vote"))) return { error: RATE_LIMITS.vote.message };
  await toggleVote(review.id, session.steamId);
  revalidatePath(`/mods/${review.mod_id}`);
  return { ok: Date.now() };
}

/* ---------- verified runs ---------- */

const DAY = 86400;

/** Save a player's scanned A10 run counts (one per character), then link any mods the new characters match. */
export async function scanRunsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Your Steam sign-in expired. Sign in again to scan your runs." };

  let raw: unknown = null;
  try { raw = JSON.parse(String(form.get("payload") ?? "")); } catch {}
  const parsed = CHARACTER_COUNTS.safeParse(raw);
  if (!parsed.success) return { error: "Those runs couldn’t be read. Choose your run history folder again." };
  if (!(await takeRateToken(session.steamId, "runs"))) return { error: RATE_LIMITS.runs.message };

  const latest = Date.now() / 1000 + DAY;
  const characters = parsed.data.characters
    .filter((c, i, all) => isModdedCharacter(c.characterId) && all.findIndex((o) => o.characterId === c.characterId) === i)
    .map((c) => ({ ...c, lastPlayed: Math.min(c.lastPlayed, Math.floor(latest)) }));
  await upsertCharacterRuns(session.steamId, characters);
  await markRunsScanned(session.steamId);
  await autoLinkMods();

  const total = characters.reduce((n, c) => n + c.a10Runs, 0);
  revalidatePath("/", "layout");
  return {
    ok: Date.now(),
    message: `Saved ${total} A10 ${total === 1 ? "run" : "runs"} across ${characters.length} ${characters.length === 1 ? "character" : "characters"}.`,
  };
}

/**
 * When a mod's Workshop title didn't match any character, the first reviewer says which of their characters it adds.
 * They must have verified A10 runs with it, and it can't already belong to another mod. Admins can correct it later.
 */
export async function linkCharacterAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Your Steam sign-in expired. Sign in again." };
  const modId = String(form.get("modId") ?? "");
  const characterId = String(form.get("characterId") ?? "");
  const mod = isUuid(modId) ? await getMod(modId, null) : null;
  if (!mod) return { error: "This mod isn’t listed any more." };
  if (mod.characterIds.length) return { ok: Date.now() }; // someone linked it a moment ago
  if (!isModdedCharacter(characterId)) return { error: "Pick the character this mod adds." };
  const mine = await getCharacterRuns(session.steamId);
  if (!mine.some((c) => c.characterId === characterId)) return { error: "You haven’t verified any A10 runs with that character." };
  if ((await linkedCharacterIds()).has(characterId)) return { error: `${characterName(characterId)} already belongs to another mod.` };
  await setModCharacterIds(modId, [characterId]);
  revalidateMod(modId);
  return { ok: Date.now() };
}

/** Admins: set which in-game character ids belong to a mod (comma-separated). */
export async function setCharacterIdsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  const modId = String(form.get("modId") ?? "");
  if (!isAdmin(session) || !isUuid(modId)) return { error: "Only admins can change this." };
  const ids = [...new Set(String(form.get("characterIds") ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
  const bad = ids.filter((id) => !RUN_SUMMARY.shape.characterId.safeParse(id).success);
  if (bad.length) return { error: `Not a character id: ${bad.join(", ")}. They look like CHARACTER.MODNAME-CHARACTER_NAME.` };
  await setModCharacterIds(modId, ids);
  if (!ids.length) await autoLinkMods();
  revalidateMod(modId);
  return { ok: Date.now(), message: ids.length ? "Saved." : "Cleared. The site will try to link it again by name." };
}

/* ---------- comments ---------- */

export async function addCommentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Sign in with Steam to join the discussion." };
  const modId = String(form.get("modId") ?? "");
  const reviewIdRaw = String(form.get("reviewId") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write something before posting." };
  if (body.length > COMMENT_MAX) return { error: `Comments can be up to ${COMMENT_MAX} characters.` };
  if (!isUuid(modId)) return { error: "This mod isn’t listed any more." };

  let reviewId: string | null = null;
  if (reviewIdRaw) {
    const review = await getReviewMeta(reviewIdRaw);
    if (!review || review.mod_id !== modId) return { error: "That review was deleted." };
    reviewId = review.id;
  } else if (!(await getMod(modId, null))) {
    return { error: "This mod isn’t listed any more." };
  }
  if (!(await takeRateToken(session.steamId, "comment"))) return { error: RATE_LIMITS.comment.message };

  await insertComment({ modId, reviewId, steamId: session.steamId, body });
  revalidatePath(`/mods/${modId}`);
  return { ok: Date.now() };
}

export async function deleteCommentAction(form: FormData) {
  const session = await getSession();
  const commentId = String(form.get("commentId") ?? "");
  const modId = String(form.get("modId") ?? "");
  if (!session || !isUuid(commentId) || !isUuid(modId)) return;
  await deleteComment(commentId, isAdmin(session) && form.get("asAdmin") === "1" ? null : session.steamId);
  revalidatePath(`/mods/${modId}`);
}
