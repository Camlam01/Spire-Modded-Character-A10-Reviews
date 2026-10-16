"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { METRIC_IDS } from "@/lib/metrics";

const KEY = "sts2r:enabled";

interface MetricsState {
  enabled: ReadonlySet<string>;
  enabledIds: string[];
  toggle: (id: string) => void;
  setEnabled: (ids: Iterable<string>) => void;
}

const Ctx = createContext<MetricsState | null>(null);

/** Which metrics count toward totals. Each viewer's choice is remembered in their browser. */
export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setState] = useState<ReadonlySet<string>>(() => new Set(METRIC_IDS));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(saved)) setState(new Set(saved.filter((id) => METRIC_IDS.includes(id))));
    } catch {}
  }, []);

  const setEnabled = useCallback((ids: Iterable<string>) => {
    const next = new Set(ids);
    setState(next);
    try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch {}
  }, []);

  const value = useMemo<MetricsState>(() => ({
    enabled,
    enabledIds: METRIC_IDS.filter((id) => enabled.has(id)),
    setEnabled,
    toggle: (id) => {
      const next = new Set(enabled);
      if (next.has(id)) next.delete(id); else next.add(id);
      setEnabled(next);
    },
  }), [enabled, setEnabled]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMetrics(): MetricsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMetrics must be used inside MetricsProvider");
  return v;
}
