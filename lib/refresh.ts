import "server-only";
import { getPlayerSummaries, getWorkshopItems } from "./steam";
import { staleMods, updateModFromWorkshop } from "./data";

/**
 * Re-read stale mods from the Workshop: title, description, preview, author name, update date and subscribers.
 * Runs after a response is sent (see `after()` in the pages), so a slow Steam never delays a page.
 */
export async function refreshStaleMods(limit = 50, onlyId?: string): Promise<void> {
  const mods = await staleMods(limit, onlyId);
  if (!mods.length) return;
  const items = await getWorkshopItems(mods.map((m) => m.workshop_id));
  if (!items) return; // Steam didn't answer; try again next time

  const creatorIds = [...new Set(mods.map((m) => m.creator_steam_id).filter((v): v is string => !!v))];
  const creators = creatorIds.length ? await getPlayerSummaries(creatorIds) : new Map();

  for (const m of mods) {
    const found = items.get(m.workshop_id);
    if (!found?.ok) {
      // Hidden, removed or moved: keep what we have and check again later.
      await updateModFromWorkshop(m.id, {});
      continue;
    }
    const it = found.item;
    await updateModFromWorkshop(m.id, {
      title: it.title,
      description: it.description,
      previewUrl: it.previewUrl,
      creatorName: (it.creatorSteamId && creators.get(it.creatorSteamId)?.personaName) || null,
      workshopUpdatedAt: it.updatedAt,
      workshopCreatedAt: it.createdAt,
      subscriptions: it.subscriptions,
    });
  }
}
