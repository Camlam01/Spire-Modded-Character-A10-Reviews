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

const DB_HELP: Record<string, { title: string; steps: React.ReactNode }> = {
  missing_tables: {
    title: "The database has no tables yet",
    steps: <>Open your project in Supabase, go to <strong>SQL Editor</strong>, paste the whole of <code>supabase/setup.sql</code> and press <strong>Run</strong>. Then reload this page.</>,
  },
  outdated_tables: {
    title: "The database needs an update",
    steps: <>Some newer tables are missing. In Supabase’s <strong>SQL Editor</strong>, run the files in <code>supabase/migrations</code> you haven’t run yet. Then reload this page.</>,
  },
  bad_key: {
    title: "Supabase rejected the site’s key",
    steps: <>Check that <code>SUPABASE_SERVICE_ROLE_KEY</code> is the <strong>service_role</strong> secret key (not the anon or publishable key) from Supabase → Project Settings → API, then redeploy.</>,
  },
  unreachable: {
    title: "The site can’t reach the database",
    steps: <>Check <code>SUPABASE_URL</code> matches your project’s URL. A free Supabase project pauses after a week without visitors; if it’s paused, restore it from the Supabase dashboard.</>,
  },
};

/** Shown instead of the site while the database isn't ready. */
export function DatabaseNotice({ problem }: { problem: string }) {
  const help = DB_HELP[problem] ?? DB_HELP.unreachable;
  return (
    <div className="empty setup">
      <h3>{help.title}</h3>
      <p>{help.steps}</p>
    </div>
  );
}
