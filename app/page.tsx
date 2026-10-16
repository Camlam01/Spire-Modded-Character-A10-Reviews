import { after } from "next/server";
import { ModList } from "@/components/ModList";
import { listMods } from "@/lib/data";
import { missingEnv } from "@/lib/env";
import { refreshStaleMods } from "@/lib/refresh";
import { getSession } from "@/lib/session";

export default async function Home({ searchParams }: { searchParams: Promise<{ signin?: string }> }) {
  if (missingEnv().length) return null;
  const [{ signin }, session] = await Promise.all([searchParams, getSession()]);
  const mods = await listMods(session?.steamId ?? null);
  after(() => refreshStaleMods(50).catch((e) => console.error("Workshop refresh failed", e)));

  return (
    <>
      <div className="intro">
        <h2>Character mods, scored at A10</h2>
        <p>
          Community reviews of Slay the Spire 2 character mods from the Steam Workshop, written for players who want balanced,
          interesting characters at Ascension 10. Switch metrics on or off to rebuild every total around what you care about.
        </p>
      </div>
      {signin === "failed" ? (
        <div className="notice error">Steam sign-in didn’t complete. Try signing in again.</div>
      ) : null}
      <ModList mods={mods} canAdd={!!session} />
    </>
  );
}
