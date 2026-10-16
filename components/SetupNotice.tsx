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
