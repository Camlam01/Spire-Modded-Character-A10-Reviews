"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addModAction } from "@/app/actions";

export function AddModForm() {
  const [state, formAction, pending] = useActionState(addModAction, null);
  const [link, setLink] = useState("");
  return (
    <form className="form" action={formAction}>
      <h2>Add a character mod</h2>
      <p className="scale-note">
        Paste the mod’s Steam Workshop link. The name, author, description and preview image are read from Steam, and only
        Slay the Spire 2 Workshop items are accepted.
      </p>
      <div className="field">
        <label htmlFor="workshop">Steam Workshop link</label>
        <input id="workshop" name="workshop" type="text" inputMode="url" required autoComplete="off"
          value={link} onChange={(e) => setLink(e.target.value)}
          placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=…" />
      </div>
      {state?.error ? <p className="err" role="alert">{state.error}</p> : null}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={pending}>{pending ? "Checking Steam…" : "Add mod"}</button>
        <Link className="btn" href="/">Cancel</Link>
      </div>
    </form>
  );
}
