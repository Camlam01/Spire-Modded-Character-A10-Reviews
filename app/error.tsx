"use client";

/** Shown when a page fails unexpectedly. Details go to the host's logs, not to visitors. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty">
      <h3>Something went wrong loading this page</h3>
      <p>
        Try again in a moment. If it keeps happening, the site’s owner can find the details in the Vercel logs
        {error.digest ? <> under error code <code>{error.digest}</code></> : null}.
      </p>
      <button type="button" className="btn" onClick={reset}>Try again</button>
    </div>
  );
}
