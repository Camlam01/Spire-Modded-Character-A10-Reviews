"use client";

import { useState } from "react";

/** A small button that asks for confirmation inline before submitting a server action. */
export function ConfirmAction({ label, prompt, action, fields }: {
  label: string; prompt: string; action: (f: FormData) => Promise<void>; fields: Record<string, string>;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  if (!asking) return <button type="button" className="btn small danger" onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span className="confirm">
      <span>{prompt}</span>
      <form action={async (f) => { setPending(true); await action(f); setPending(false); setAsking(false); }}>
        {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <button type="submit" className="btn small danger" disabled={pending}>{pending ? "Working…" : label}</button>
      </form>
      <button type="button" className="btn small" onClick={() => setAsking(false)}>Keep</button>
    </span>
  );
}
