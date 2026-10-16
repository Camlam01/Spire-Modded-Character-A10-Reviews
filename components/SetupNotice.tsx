/** Shown instead of the site until the required settings exist. */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div className="empty setup">
      <h3>Finish setting up the site</h3>
      <p>These settings are missing: {missing.map((m, i) => <span key={m}>{i ? ", " : ""}<code>{m}</code></span>)}.</p>
      <ol>
        <li>Copy <code>.env.example</code> to <code>.env.local</code> in the project folder.</li>
        <li>Fill in each value. <code>SETUP.md</code> explains where to find them.</li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
    </div>
  );
}
