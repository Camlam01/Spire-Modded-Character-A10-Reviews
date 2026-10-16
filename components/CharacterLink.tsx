"use client";

import { useActionState, useState } from "react";
import { linkCharacterAction, setCharacterIdsAction } from "@/app/actions";
import { characterName } from "@/lib/runs";

/** Asks the first reviewer which of their characters an unlinked mod adds. */
export function LinkCharacterForm({ modId, modTitle, options }: {
  modId: string; modTitle: string; options: { characterId: string; a10Runs: number }[];
}) {
  const [state, formAction, pending] = useActionState(linkCharacterAction, null);
  const [picked, setPicked] = useState("");
  return (
    <form action={formAction} className="steps">
      <h3>Which character does {modTitle} add?</h3>
      <p>The site couldn’t match this mod to a character by its name. Pick it from the modded characters in your run history; this links it for everyone.</p>
      <input type="hidden" name="modId" value={modId} />
      <fieldset className="choices">
        <legend className="sr-only">Your modded characters</legend>
        {options.map((c) => (
          <label key={c.characterId} className="choice">
            <input type="radio" name="characterId" value={c.characterId} checked={picked === c.characterId} onChange={() => setPicked(c.characterId)} />
            <span><strong>{characterName(c.characterId)}</strong> <span className="by num">{c.a10Runs} A10 {c.a10Runs === 1 ? "run" : "runs"} · <code>{c.characterId}</code></span></span>
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <button type="submit" className="btn primary" disabled={!picked || pending}>{pending ? "Linking…" : "Link this character"}</button>
        {state?.error ? <span className="err" role="alert">{state.error}</span> : null}
      </div>
    </form>
  );
}

/** Admins: correct which character ids belong to a mod. */
export function CharacterIdsForm({ modId, characterIds }: { modId: string; characterIds: string[] }) {
  const [state, formAction, pending] = useActionState(setCharacterIdsAction, null);
  const [value, setValue] = useState(characterIds.join(", "));
  return (
    <details className="admin-box">
      <summary>Admin: character ids</summary>
      <form action={formAction} className="steps-inner">
        <p className="by">Comma-separated, like <code>CHARACTER.THETAILOR-THE_TAILOR</code>. Add an id when a mod renames its character. Clear it to let the site match by name again.</p>
        <input type="hidden" name="modId" value={modId} />
        <div className="field"><label htmlFor="characterIds" className="sr-only">Character ids</label>
          <input id="characterIds" name="characterIds" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="actions">
          <button type="submit" className="btn small" disabled={pending}>Save character ids</button>
          {state?.error ? <span className="err">{state.error}</span> : state?.message ? <span className="by">{state.message}</span> : null}
        </div>
      </form>
    </details>
  );
}
