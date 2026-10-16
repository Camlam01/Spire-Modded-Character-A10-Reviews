import "server-only";
import { knownCharacterIds, linkedCharacterIds, setModCharacterIds, unlinkedMods } from "./data";
import { isModdedCharacter, matchCharactersToTitle } from "./runs";

/**
 * Link mods that have no character yet to the characters players have verified runs with, by matching each mod's
 * Workshop title to the character's mod prefix. Runs after every run scan and whenever a mod is added.
 */
export async function autoLinkMods(): Promise<void> {
  const mods = await unlinkedMods();
  if (!mods.length) return;
  const [known, linked] = await Promise.all([knownCharacterIds(), linkedCharacterIds()]);
  const candidates = known.filter((id) => isModdedCharacter(id) && !linked.has(id));
  if (!candidates.length) return;
  for (const m of mods) {
    const ids = matchCharactersToTitle(m.title, candidates);
    if (ids.length) await setModCharacterIds(m.id, ids);
  }
}
