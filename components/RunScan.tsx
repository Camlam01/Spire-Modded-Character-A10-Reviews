"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { scanRunsAction } from "@/app/actions";
import { characterName, parseRunFile, SKIP_LABELS, tallyRuns, type RunSkip, type RunSummary } from "@/lib/runs";

type Found = { file: File; path: string };
interface Scan { files: number; runs: RunSummary[]; skips: Partial<Record<RunSkip, number>> }

/* ---------- remembering the folder (Chrome and Edge) ---------- */

// Minimal typings for the File System Access API, which TypeScript's DOM library doesn't fully include.
type DirHandle = {
  kind: "directory"; name: string;
  entries(): AsyncIterable<[string, DirHandle | FileHandle]>;
  queryPermission(o: { mode: "read" }): Promise<PermissionState>;
  requestPermission(o: { mode: "read" }): Promise<PermissionState>;
};
type FileHandle = { kind: "file"; name: string; getFile(): Promise<File> };
const picker = () => (globalThis as unknown as { showDirectoryPicker?: (o?: object) => Promise<DirHandle> }).showDirectoryPicker;

const IDB = { db: "sts2r", store: "handles", key: "runFolder" };
function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(IDB.db, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(IDB.store);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        const req = run(open.result.transaction(IDB.store, mode).objectStore(IDB.store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => resolve(undefined);
      };
    } catch { resolve(undefined); }
  });
}
const loadHandle = () => idb<DirHandle>("readonly", (s) => s.get(IDB.key));
const saveHandle = (h: DirHandle) => idb("readwrite", (s) => s.put(h, IDB.key));
const forgetHandle = () => idb("readwrite", (s) => s.delete(IDB.key));

async function filesFromHandle(dir: DirHandle, prefix = dir.name): Promise<Found[]> {
  const out: Found[] = [];
  for await (const [name, h] of dir.entries()) {
    const path = `${prefix}/${name}`;
    if (h.kind === "directory") {
      if (/^(shader_cache|vulkan|logs|sentry|mods)$/i.test(name)) continue; // big folders with no runs
      out.push(...(await filesFromHandle(h, path)));
    } else if (name.endsWith(".run")) {
      out.push({ file: await h.getFile(), path });
    }
  }
  return out;
}

/** Collect .run files under a dropped folder (drag and drop gives entries, not a flat file list). */
async function filesFromDrop(items: DataTransferItemList): Promise<Found[]> {
  const out: Found[] = [];
  const walk = async (entry: FileSystemEntry | null): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      if (!entry.name.endsWith(".run")) return;
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ file, path: entry.fullPath });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  for (const item of [...items]) await walk(item.webkitGetAsEntry());
  return out;
}

/* ---------- component ---------- */

export function RunScan({ viewerId, lastScanned }: { viewerId: string; lastScanned: string | null }) {
  const folderInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [remembered, setRemembered] = useState<DirHandle | null>(null);
  const [canRemember, setCanRemember] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [payload, setPayload] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState("");
  const [state, formAction, pending] = useActionState(scanRunsAction, null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", ""); // React has no prop for folder pickers
    setCanRemember(!!picker());
    loadHandle().then((h) => { if (h) setRemembered(h); });
  }, []);

  // Read the files, then send the qualifying runs straight away.
  const read = async (found: Found[]) => {
    setReading(true);
    setProblem("");
    const runs: RunSummary[] = [];
    const skips: Scan["skips"] = {};
    let files = 0;
    for (const { file, path } of found) {
      if (!file.name.endsWith(".run") || file.size > 2_000_000) continue;
      files++;
      const r = parseRunFile(await file.text(), path, viewerId);
      if (r.ok) runs.push(r.run); else skips[r.reason] = (skips[r.reason] ?? 0) + 1;
    }
    setReading(false);
    setScan({ files, runs, skips });
    if (!files) { setProblem("No run files were in that folder. Choose the SlayTheSpire2 “steam” folder described above."); return; }
    // Only the per-character counts leave the browser.
    const characters = tallyRuns(runs).byCharacter;
    if (!characters.length) return;
    const json = JSON.stringify({ characters });
    const body = new FormData();
    body.set("payload", json);
    setPayload(json);
    startTransition(() => formAction(body));
  };

  const pickWithHandle = async () => {
    try {
      const h = await picker()!({ id: "sts2-runs", mode: "read" });
      await saveHandle(h);
      setRemembered(h);
      await read(await filesFromHandle(h));
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setProblem("That folder couldn’t be read. Try choosing it again.");
    }
  };
  const rescan = async () => {
    if (!remembered) return;
    try {
      const ok = (await remembered.queryPermission({ mode: "read" })) === "granted" || (await remembered.requestPermission({ mode: "read" })) === "granted";
      if (!ok) { setProblem("Your browser didn’t allow reading the folder. Choose it again below."); return; }
      await read(await filesFromHandle(remembered));
    } catch {
      setProblem("The remembered folder couldn’t be read. It may have moved; choose it again below.");
      await forgetHandle();
      setRemembered(null);
    }
  };

  const tally = scan ? tallyRuns(scan.runs) : null;
  const busy = reading || pending;

  return (
    <section className="steps scan">
      <h3>Scan your run history</h3>
      <p>
        This lists the characters you’ve played at Ascension 10 on your profile and counts toward every mod you review.
        Your files are read in your browser and never uploaded. Finished solo A10 runs are counted, wins and losses alike,
        and only the totals are sent: each character’s A10 run count and the date of its latest run. Each scan updates
        the characters it finds.
      </p>
      <p className="by">{lastScanned ? `Last scanned ${new Date(lastScanned).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.` : "You haven’t scanned your runs yet."}</p>

      {remembered ? (
        <div className="actions">
          <button type="button" className="btn primary" onClick={rescan} disabled={busy}>Rescan “{remembered.name}”</button>
          <button type="button" className="linkish" onClick={async () => { await forgetHandle(); setRemembered(null); }}>Forget this folder</button>
        </div>
      ) : null}

      <details open={!remembered}>
        <summary>{remembered ? "Choose a different folder" : "Where to find it"}</summary>
        <div className="steps-inner">
          <p>On Windows, paste this into the File Explorer address bar and press Enter, then go up one level so you can choose the <code>steam</code> folder:</p>
          <pre className="path">%AppData%\SlayTheSpire2\steam</pre>
          <p className="by">
            It holds a folder named after your Steam ID with every profile’s runs inside, modded and unmodded. On Mac and Linux it’s probably
            <code>~/Library/Application Support/SlayTheSpire2/steam</code> or <code>~/.local/share/SlayTheSpire2/steam</code>.
          </p>
          <div
            className={`dropzone${dragging ? " over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={async (e) => { e.preventDefault(); setDragging(false); await read(await filesFromDrop(e.dataTransfer.items)); }}
          >
            <p>Drag the folder here, or</p>
            <div className="actions">
              {canRemember ? (
                <button type="button" className="btn primary" onClick={pickWithHandle} disabled={busy}>Choose folder</button>
              ) : (
                <label className="btn primary" htmlFor="run-folder">Choose folder</label>
              )}
              <input id="run-folder" ref={folderInput} type="file" multiple className="sr-only"
                onChange={(e) => e.target.files && read([...e.target.files].map((file) => ({ file, path: file.webkitRelativePath || file.name })))} />
            </div>
            <p className="by">
              {canRemember
                ? "Your browser can remember this folder, so next time rescanning is one click."
                : "If your browser asks to “upload” the folder, that’s its standard wording; nothing is uploaded. Chrome and Edge can remember the folder for one-click rescans."}
            </p>
          </div>
        </div>
      </details>

      {busy ? <p className="notice" role="status">{reading ? "Reading your runs…" : "Saving your A10 runs…"}</p> : null}
      {problem ? <p className="notice error" role="alert">{problem}</p> : null}
      {scan && tally && !busy ? (
        <div className="scan-result" role="status">
          <p className="num">
            Read {scan.files} run {scan.files === 1 ? "file" : "files"} and found {tally.unique.length} A10 {tally.unique.length === 1 ? "run" : "runs"}
            {tally.byCharacter.length ? `: ${tally.byCharacter.map((c) => `${characterName(c.characterId)} ${c.a10Runs}`).join(", ")}` : ""}.
          </p>
          {Object.keys(scan.skips).length ? (
            <p className="by num">Not counted: {Object.entries(scan.skips).map(([k, n]) => `${n} that ${SKIP_LABELS[k as RunSkip]}`).join(", ")}.</p>
          ) : null}
        </div>
      ) : null}
      {state?.error ? <p className="notice error" role="alert">{state.error}</p> : null}
      {state?.message && !busy ? <p className="notice" role="status">{state.message}</p> : null}
      {/* Kept so the last payload can be resent by keyboard users if the automatic save failed. */}
      {state?.error && payload ? (
        <form ref={formRef} action={formAction}><input type="hidden" name="payload" value={payload} /><button type="submit" className="btn small">Try saving again</button></form>
      ) : null}
    </section>
  );
}
