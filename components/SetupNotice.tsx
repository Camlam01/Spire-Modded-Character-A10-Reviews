/** Shown instead of the site until the required settings exist. */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div className="empty setup">
      <h3>Finish setting up the site</h3>
      <p>These settings are missing: {missing.map((m, i) => <span key={m}>{i ? ", " : ""}<code>{m}</code></span>)}.</p>
      <ol>
        <li>On Vercel: add the Supabase database under <strong>Storage</strong> and <code>STEAM_API_KEY</code> under <strong>Settings → Environment Variables</strong>, then redeploy.</li>
        <li>On your computer: run <code>npm run setup</code>, then restart <code>npm run dev</code>.</li>
        <li><code>SETUP.md</code> walks through both.</li>
      </ol>
    </div>
  );
}

import type { DatabaseProblem } from "@/lib/data";

const DB_HELP: Record<DatabaseProblem["kind"], { title: string; steps: React.ReactNode }> = {
  missing_tables: {
    title: "The site can’t see part of the database",
    steps: <>If these were never created, paste the whole of <code>supabase/setup.sql</code> into Supabase’s <strong>SQL Editor</strong> and run it. If they do exist, Supabase’s API may not have noticed them yet: run <code>notify pgrst, &apos;reload schema&apos;;</code> in the SQL Editor. Then reload this page.</>,
  },
  bad_key: {
    title: "Supabase refused the site’s key",
    steps: <>Check that <code>SUPABASE_SERVICE_ROLE_KEY</code> is the <strong>service_role</strong> secret key (not the anon or publishable key) from Supabase → Project Settings → API, then redeploy.</>,
  },
  unreachable: {
    title: "The site can’t use the database",
    steps: <>Check <code>SUPABASE_URL</code> matches your project’s URL. A free Supabase project pauses after a week without visitors; if it’s paused, restore it from the Supabase dashboard.</>,
  },
};

/** Shown instead of the site while the database isn't ready, with Supabase's own message for each failure. */
export function DatabaseNotice({ problem }: { problem: DatabaseProblem }) {
  const help = DB_HELP[problem.kind];
  return (
    <div className="empty setup">
      <h3>{help.title}</h3>
      <p>{help.steps}</p>
      <p className="by">What Supabase said:</p>
      <ul className="db-failures">
        {problem.failures.map((f) => <li key={f.object}><code>{f.object}</code>: {f.message}</li>)}
      </ul>
    </div>
  );
}
