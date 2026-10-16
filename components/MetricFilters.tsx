"use client";

import { CATEGORIES, METRIC_IDS, METRICS } from "@/lib/metrics";
import { useMetrics } from "./MetricsProvider";

export function MetricFilters() {
  const { enabled, toggle, setEnabled } = useMetrics();
  return (
    <details className="filters" open>
      <summary>
        <h2>Metrics counted</h2>
        <span className="count num">{enabled.size} of {METRICS.length} on</span>
      </summary>
      <div className="filters-body">
        <p>Every total is the average of the metrics switched on here. Your choice is remembered on this device.</p>
        {CATEGORIES.map((c) => {
          const ids = c.metrics.map((m) => m.id);
          const on = ids.filter((id) => enabled.has(id)).length;
          const all = on === ids.length;
          return (
            <div className="fgroup" key={c.key} style={{ "--cat": `var(--c-${c.key})` } as React.CSSProperties}>
              <button
                type="button"
                className="fgroup-head"
                title={all ? `Switch off all ${c.name} metrics` : `Switch on all ${c.name} metrics`}
                onClick={() => {
                  const next = new Set(enabled);
                  ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
                  setEnabled(next);
                }}
              >
                <span>{c.name}</span>
                <span className="num">{on}/{ids.length}</span>
              </button>
              <div className="chips">
                {c.metrics.map((m) => (
                  <button key={m.id} type="button" className="chip" aria-pressed={enabled.has(m.id)} title={m.question} onClick={() => toggle(m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="frow">
          <button type="button" className="btn small" onClick={() => setEnabled(METRIC_IDS)}>All on</button>
          <button type="button" className="btn small" onClick={() => setEnabled(CATEGORIES.find((c) => c.key === "bal")!.metrics.map((m) => m.id))}>
            A10 Balance only
          </button>
        </div>
      </div>
    </details>
  );
}
