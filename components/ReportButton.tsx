"use client";

import { useActionState, useState } from "react";
import { reportAction } from "@/app/actions";

/** A small "Report" link that opens a one-line reason box and sends the report to the admins. */
export function ReportButton({ targetType, targetId }: { targetType: "review" | "comment"; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(reportAction, null);

  if (state?.message) return <span className="by report-done" role="status">{state.message}</span>;
  if (!open) {
    return <button type="button" className="linkish report-link" onClick={() => setOpen(true)}>Report</button>;
  }
  const fieldId = `report-${targetId}`;
  return (
    <form action={formAction} className="report-form">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <label htmlFor={fieldId} className="sr-only">What’s wrong with this {targetType}?</label>
      <input id={fieldId} name="reason" maxLength={500} required autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder={`What’s wrong? For example: spam, abusive, not a real ${targetType}`} />
      <button type="submit" className="btn small danger" disabled={pending || !reason.trim()}>{pending ? "Sending…" : "Send report"}</button>
      <button type="button" className="btn small" onClick={() => setOpen(false)}>Cancel</button>
      {state?.error ? <span className="err" role="alert">{state.error}</span> : null}
    </form>
  );
}
