import Link from "next/link";
import { CompareView } from "@/components/CompareView";
import { isUuid, listMods } from "@/lib/data";
import { missingEnv } from "@/lib/env";
import { getSession } from "@/lib/session";

export const metadata = { title: "Compare mods" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  if (missingEnv().length) return null;
  const [{ ids }, session] = await Promise.all([searchParams, getSession()]);
  const mods = await listMods(session?.steamId ?? null);
  const known = new Set(mods.map((m) => m.id));
  const selected = [...new Set((ids ?? "").split(",").filter((id) => isUuid(id) && known.has(id)))].slice(0, 3);

  return (
    <>
      <Link className="back" href="/">← All mods</Link>
      <div className="intro">
        <h2>Compare mods</h2>
        <p>Pick up to three character mods to see their combined scores side by side. The best score in each row is highlighted, and totals follow the metrics you have switched on.</p>
      </div>
      <CompareView mods={mods} initial={selected} />
    </>
  );
}
