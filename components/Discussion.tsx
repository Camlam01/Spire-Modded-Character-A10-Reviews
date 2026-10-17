"use client";

import { useActionState, useEffect, useState } from "react";
import type { CommentView } from "@/lib/data";
import { COMMENT_MAX } from "@/lib/limits";
import { addCommentAction, deleteCommentAction, voteAction } from "@/app/actions";
import { ConfirmAction } from "./ConfirmAction";
import { ReportButton } from "./ReportButton";

interface ThreadProps {
  modId: string;
  reviewId: string | null;
  comments: CommentView[];
  viewerId: string | null;
  admin: boolean;
  signInHref: string;
}

/** A flat discussion under a review, or under the combined review when `reviewId` is null. */
export function CommentThread({ modId, reviewId, comments, viewerId, admin, signInHref }: ThreadProps) {
  const [state, formAction, pending] = useActionState(addCommentAction, null);
  const [body, setBody] = useState("");
  useEffect(() => { if (state?.ok) setBody(""); }, [state?.ok]);
  const fieldId = `c-${reviewId ?? "combined"}`;

  return (
    <div className="thread">
      {comments.length ? (
        <ol className="comments">
          {comments.map((c) => {
            const mine = c.steamId === viewerId;
            return (
              <li key={c.id} className="comment">
                {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : <span className="avatar-blank" />}
                <div>
                  <div className="comment-head">
                    <strong>{c.profileUrl ? <a href={c.profileUrl} target="_blank" rel="noopener noreferrer">{c.personaName}</a> : c.personaName}</strong>
                    {mine ? <span className="tag">You</span> : null}
                    <time className="by" dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
                    {mine || admin ? (
                      <ConfirmAction label={mine ? "Delete" : "Remove"} prompt={mine ? "Delete your comment?" : "Remove this comment?"}
                        action={deleteCommentAction} fields={{ commentId: c.id, modId, ...(mine ? {} : { asAdmin: "1" }) }} />
                    ) : null}
                    {viewerId && !mine ? <ReportButton targetType="comment" targetId={c.id} /> : null}
                  </div>
                  <p>{c.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="by">No comments yet.</p>
      )}

      {viewerId ? (
        <form className="comment-form" action={formAction}>
          <input type="hidden" name="modId" value={modId} />
          <input type="hidden" name="reviewId" value={reviewId ?? ""} />
          <label htmlFor={fieldId} className="sr-only">Add a comment</label>
          <textarea id={fieldId} name="body" maxLength={COMMENT_MAX} required placeholder="Add to the discussion"
            value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="actions">
            <button type="submit" className="btn small primary" disabled={pending || !body.trim()}>{pending ? "Posting…" : "Post comment"}</button>
            {state?.error ? <span className="err" role="alert">{state.error}</span> : null}
          </div>
        </form>
      ) : (
        <a className="btn small steam" href={signInHref}>Sign in with Steam to comment</a>
      )}
    </div>
  );
}

/** "Helpful" toggle on a review. */
export function HelpfulButton({ reviewId, count, voted, disabledReason }: {
  reviewId: string; count: number; voted: boolean; disabledReason: string | null;
}) {
  const [state, formAction, pending] = useActionState(voteAction, null);
  if (disabledReason) {
    return <span className="helpful static num" title={disabledReason}>▲ {count} found this helpful</span>;
  }
  return (
    <form action={formAction} className="helpful-form">
      <input type="hidden" name="reviewId" value={reviewId} />
      <button type="submit" className="helpful num" aria-pressed={voted} disabled={pending}
        title={voted ? "Remove your helpful vote" : "Mark this review as helpful"}>
        ▲ Helpful · {count}
      </button>
      {state?.error ? <span className="err" role="alert">{state.error}</span> : null}
    </form>
  );
}
