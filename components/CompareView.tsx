"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ModSummary } from "@/lib/data";
import { CATEGORIES } from "@/lib/metrics";
import { categoryAverage, combinedTotal, formatScore } from "@/lib/scoring";
import { catStyle, Medal } from "./Medal";
import { useMetrics } from "./MetricsProvider";

const SLOTS = 3;

export function CompareView({ mods, initial }: { mods: ModSummary[]; initial: string[] }) {
  const router = useRouter();
  const { enabled, enabledIds } = useMetrics();
  const [picked, setPicked] = useState<string[]>(initial);
  const byId = new Map(mods.map((m) => [m.id, m]));
  const chosen = picked.map((id) => byId.get(id)).filter((m): m is ModSummary => !!m);

  const choose = (slot: number, id: string) => {
    const next = [...picked];
    if (id) next[slot] = id; else next.splice(slot, 1);
    const clean = [...new Set(next.filter(Boolean))].slice(0, SLOTS);
    setPicked(clean);
    router.replace(clean.length ? `/compare?ids=${clean.join(",")}` : "/compare", { scroll: false });
  };

  if (mods.length < 2) {
    return <div className="empty"><h3>Not enough mods to compare yet</h3><p>Once at least two character mods are listed, you can compare them here.</p></div>;
  }

  // Highlight the highest value in a row, only when at least two mods have one and they differ.
  const best = (vals: (number | null)[]) => {
    const real = vals.filter((v): v is number => v != null);
    if (real.length < 2 || Math.max(...real) === Math.min(...real)) return null;
    return Math.max(...real);
  };
  const cells = (vals: (number | null)[], offLabel?: boolean) => {
    const top = best(vals);
    return vals.map((v, i) => (
      <td key={i} className={`num${top != null && v === top ? " best" : ""}`}>{offLabel ? "off" : formatScore(v)}</td>
    ));
  };

  const slotCount = Math.min(SLOTS, chosen.length + 1);
  const totals = chosen.map((m) => combinedTotal(m.stats, enabledIds));
  const totalBest = best(totals);

  return (
    <>
      <div className="compare-pickers">
        {Array.from({ length: slotCount }, (_, i) => (
          <select key={i} id={`pick-${i}`} aria-label={`Mod ${i + 1}`} value={picked[i] ?? ""} onChange={(e) => choose(i, e.target.value)}>
            <option value="">{i < chosen.length ? "Remove this mod" : "Add a mod to compare…"}</option>
            {mods.filter((m) => m.id === picked[i] || !picked.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        ))}
      </div>

      {chosen.length ? (
        <div className="table-wrap">
          <table className="ctable">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Metric</span></th>
                {chosen.map((m) => <th key={m.id} scope="col"><Link href={`/mods/${m.id}`}>{m.title}</Link></th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="total">
                <td>Total</td>
                {chosen.map((m, i) => (
                  <td key={m.id}><div className="medal-cell"><Medal value={totals[i]} size="sm" /></div>{totalBest != null && totals[i] === totalBest ? <span className="sr-only">Best</span> : null}</td>
                ))}
              </tr>
              <tr>
                <td>Reviews</td>
                {chosen.map((m) => <td key={m.id} className="num">{m.reviewCount}</td>)}
              </tr>
              {CATEGORIES.map((c) => {
                const avgs = chosen.map((m) => categoryAverage(m.stats, c.key, enabled));
                const off = avgs[0]?.off ?? false;
                return [
                  <tr key={c.key} className="cathead" style={catStyle(c.key)}>
                    <td>{c.name}</td>
                    {cells(avgs.map((a) => a.value), off)}
                  </tr>,
                  ...c.metrics.map((mt) => (
                    <tr key={mt.id} className={enabled.has(mt.id) ? "" : "off"} title={mt.question}>
                      <td>{mt.label}</td>
                      {cells(chosen.map((m) => m.stats[mt.id]?.avg ?? null))}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty"><h3>Pick a mod to start</h3><p>Choose mods from the menus above. You can compare up to three at once.</p></div>
      )}
    </>
  );
}
