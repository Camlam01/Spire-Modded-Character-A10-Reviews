import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmAction } from "@/components/ConfirmAction";
import { dismissReportAction, removeReportedAction } from "@/app/actions";
import { listOpenReports } from "@/lib/data";
import { siteNotReady } from "@/lib/ready";
import { getSession, isAdmin } from "@/lib/session";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  if (await siteNotReady()) return null;
  const session = await getSession();
  if (!isAdmin(session)) notFound(); // the page doesn't exist for anyone else
  const reports = await listOpenReports();

  return (
    <>
      <div className="intro">
        <h2>Reports</h2>
        <p>Reviews and comments that players have flagged. Remove the post, or dismiss the report if it’s fine. Either way the report closes.</p>
      </div>
      {reports.length ? (
        <div className="reviews">
          {reports.map((r) => (
            <article key={r.targetId} className="report-card">
              <div className="by num">
                {r.targetType === "review" ? "Review" : "Comment"}
                {r.modTitle ? <> on <Link href={`/mods/${r.modId}`}>{r.modTitle}</Link></> : null}
                {" · "}reported by {r.reporterName}{r.reportCount > 1 ? ` and ${r.reportCount - 1} more` : ""}
                {" · "}{new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <p><strong>Reason:</strong> {r.reason}</p>
              {r.content ? (
                <>
                  <div className="by">Posted by <Link href={`/players/${r.content.authorId}`}>{r.content.authorName}</Link>:</div>
                  <blockquote>{r.content.text}</blockquote>
                </>
              ) : (
                <p className="by">This has already been removed.</p>
              )}
              <div className="actions">
                {r.content ? (
                  <ConfirmAction label={r.targetType === "review" ? "Remove review" : "Remove comment"} prompt="Remove it for everyone?"
                    action={removeReportedAction} fields={{ targetId: r.targetId, targetType: r.targetType, modId: r.modId ?? "" }} />
                ) : null}
                <form action={dismissReportAction}>
                  <input type="hidden" name="targetId" value={r.targetId} />
                  <button type="submit" className="btn small">{r.content ? "Dismiss, it’s fine" : "Close report"}</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty"><h3>No open reports</h3><p>When players flag a review or comment, it appears here.</p></div>
      )}
    </>
  );
}
