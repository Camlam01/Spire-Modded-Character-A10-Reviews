"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { scanRunsAction } from "@/app/actions";
import { characterName, parseRunFile, tallyRuns, VERIFY_RULE, type RunSkip, type RunSummary } from "@/lib/runs";

type Found = { file: File; path: string };
interface Scan { files: number; runs: RunSummary[]; skips: Partial<Record<RunSkip, number>> }

// The browser's standard folder picker (an <input> with webkitdirectory) is used rather than the File System Access
// API: Chrome refuses that API for anything under AppData, which is where STS2 keeps its run history.

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

/** Windows' folder picker understands %AppData%, so pasting this jumps straight to the run history. */
const RUNS_PATH = String.raw`%AppData%\SlayTheSpire2\steam`;

export function RunScan({ viewerId, lastScanned }: { viewerId: string; lastScanned: string | null }) {
  const folderInput = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [payload, setPayload] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState(scanRunsAction, null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", ""); // React has no prop for folder pickers
  }, []);

  // Read the files, then send the per-character counts straight away.
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
    if (!files) { setProblem("No run files were in that folder. Copy the folder path above and paste it into the folder window’s address bar."); return; }
    // Only the per-character counts leave the browser.
    const characters = tallyRuns(runs).byCharacter;
    if (!characters.length) return;
    const json = JSON.stringify({ characters });
    const body = new FormData();
    body.set("payload", json);
    setPayload(json);
    startTransition(() => formAction(body));
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(RUNS_PATH);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: select the path so the player can press Ctrl+C.
      const el = document.getElementById("runs-path");
      if (el) window.getSelection()?.selectAllChildren(el);
    }
  };

  const tally = scan ? tallyRuns(scan.runs) : null;
  const busy = reading || pending;

  return (
    <section className="steps scan">
      <h3>Scan your run history</h3>
      <p>
        Lists the modded characters you’ve played at A10 and verifies your reviews of them ({VERIFY_RULE}).
        Counts all runs completed in full. Your files are read in your browser and never uploaded.
      </p>
      <p className="by">{lastScanned ? `Last scanned ${new Date(lastScanned).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.` : "You haven’t scanned your runs yet."}</p>

      <ol className="pick-steps">
        <li>
          <div className="actions">
            <button type="button" className="btn" onClick={copyPath}>{copied ? "Copied ✓" : "Copy folder path"}</button>
            <code className="path-inline" id="runs-path">{RUNS_PATH}</code>
          </div>
        </li>
        <li>
          <div className="actions">
            <label className={`btn primary${busy ? " disabled" : ""}`} htmlFor="run-folder">{lastScanned ? "Choose folder and rescan" : "Choose folder"}</label>
            <input id="run-folder" ref={folderInput} type="file" multiple className="sr-only" disabled={busy}
              onChange={(e) => {
                const files = e.target.files;
                if (files) read([...files].map((file) => ({ file, path: file.webkitRelativePath || file.name })));
                e.target.value = ""; // lets the same folder be chosen again for a rescan
              }} />
          </div>
        </li>
        <li>
          In the window that opens, click the <strong>address bar</strong> at the top, press <kbd>Ctrl</kbd>+<kbd>V</kbd> and{" "}
          <kbd>Enter</kbd>, then click <strong>Upload</strong> or <strong>Select Folder</strong>. Your browser then asks whether to
          “upload” the files; that’s its standard wording. Allow it: they’re read on this page and never uploaded.
        </li>
      </ol>
      <details>
        <summary>On a Mac or Linux, or prefer drag and drop?</summary>
        <div className="steps-inner">
          <p className="by">
            On Mac the folder is probably <code>~/Library/Application Support/SlayTheSpire2/steam</code>, and on Linux and Steam Deck
            <code>~/.local/share/SlayTheSpire2/steam</code>. You can also drag the folder onto the box below.
          </p>
          <div
            className={`dropzone small${dragging ? " over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={async (e) => { e.preventDefault(); setDragging(false); await read(await filesFromDrop(e.dataTransfer.items)); }}
          >
            <p className="by">Drop your SlayTheSpire2 “steam” folder here</p>
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
            <p className="by num">{Object.values(scan.skips).reduce((a, b) => a + (b ?? 0), 0)} runs weren’t counted (not completed in full, below A10, co-op or custom).</p>
          ) : null}
        </div>
      ) : null}
      {state?.error ? <p className="notice error" role="alert">{state.error}</p> : null}
      {state?.message && !busy ? <p className="notice" role="status">{state.message}</p> : null}
      {state?.error && payload ? (
        <form action={formAction}><input type="hidden" name="payload" value={payload} /><button type="submit" className="btn small">Try saving again</button></form>
      ) : null}
    </section>
  );
}
