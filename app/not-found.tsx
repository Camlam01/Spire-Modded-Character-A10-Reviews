import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <h3>That page isn’t here</h3>
      <p>The mod may have been removed, or the link is mistyped.</p>
      <Link className="btn" href="/">Back to all mods</Link>
    </div>
  );
}
