"use client";

import { useActionState, useState, useTransition } from "react";
import { MessageSquare, Pencil, Trash2, Flag, Pin, CornerDownLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  addCommentAction,
  addReplyAction,
  editCommentAction,
  deleteCommentAction,
  editReplyAction,
  deleteReplyAction,
  reportCommentAction,
  togglePinCommentAction,
  type DiscussionActionState,
} from "@/lib/actions/discussion";
import type { DiscussionComment } from "@/lib/data/learn";
import { useI18n } from "@/lib/i18n/I18nProvider";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit" });

function AuthorBadge({
  authorId,
  role,
  teacherProfileId,
}: {
  authorId: string;
  role: string | undefined;
  teacherProfileId: string | null;
}) {
  const { t: T } = useI18n();
  const t = T.learn.discussion;
  if (role === "admin") return <Badge variant="gold">{t.roleAdmin}</Badge>;
  if (role === "teacher" && authorId === teacherProfileId) return <Badge variant="violet">{t.roleTeacher}</Badge>;
  return null;
}

/**
 * "Any authenticated user may reply" at the RLS layer (comment_replies_insert_own,
 * 0009) — this badge is what actually communicates "التعليم يستطيع الرد على
 * أسئلة دوراته": we don't restrict WHO can reply, we make it visually
 * obvious WHEN the course's own teacher (or an admin) has responded.
 */
export function DiscussionPanel({
  lessonId,
  courseSlug,
  comments,
  currentUserId,
  currentUserRole,
  teacherProfileId,
  canModerate,
}: {
  lessonId: string;
  courseSlug: string;
  comments: DiscussionComment[];
  currentUserId: string | null;
  currentUserRole: string | null;
  teacherProfileId: string | null;
  /** admin, or the owning teacher — allowed to pin */
  canModerate: boolean;
}) {
  const { t: T } = useI18n();
  const t = T.learn.discussion;
  const boundAction = addCommentAction.bind(null, lessonId, courseSlug);
  const [state, formAction, pending] = useActionState<DiscussionActionState, FormData>(boundAction, {
    error: null,
  });

  return (
    <Card tone="dark">
      <h3 className="mb-4 flex items-center gap-2 text-[15px] text-text-primary-dark">
        <MessageSquare size={16} />
        {t.title}
      </h3>

      <form action={formAction} className="mb-5">
        {state.error && <p className="mb-2 text-[12.5px] text-error">{state.error}</p>}
        <textarea
          name="body"
          rows={3}
          placeholder={t.placeholder}
          className="w-full rounded-sm border border-border-dark bg-surface-dark px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? t.sending : t.send}
        </button>
      </form>

      {comments.length === 0 ? (
        <p className="text-[13.5px] text-text-muted-dark">{t.empty}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {comments.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              courseSlug={courseSlug}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              teacherProfileId={teacherProfileId}
              canModerate={canModerate}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function CommentThread({
  comment,
  courseSlug,
  currentUserId,
  currentUserRole,
  teacherProfileId,
  canModerate,
}: {
  comment: DiscussionComment;
  courseSlug: string;
  currentUserId: string | null;
  currentUserRole: string | null;
  teacherProfileId: string | null;
  canModerate: boolean;
}) {
  const { t: T } = useI18n();
  const t = T.learn.discussion;
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [pending, startTransition] = useTransition();

  const isOwn = currentUserId === comment.userId;
  const isAdmin = currentUserRole === "admin";

  function runVoid(fn: () => Promise<{ error: string | null } | void>) {
    startTransition(() => {
      fn().then((r) => {
        if (r && "error" in r && r.error) window.alert(r.error);
      });
    });
  }

  if (editing) {
    return (
      <InlineEditForm
        action={editCommentAction.bind(null, comment.id, courseSlug)}
        defaultValue={comment.body}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#9c7cf5] text-[11px] font-semibold text-white">
          {(comment.profiles?.full_name ?? "?")[0]}
        </div>
        <span className="text-[13px] font-medium text-text-primary-dark">{comment.profiles?.full_name ?? t.roleStudent}</span>
        <AuthorBadge authorId={comment.userId} role={comment.profiles?.role} teacherProfileId={teacherProfileId} />
        {comment.is_pinned && (
          <Badge variant="gold">
            <Pin size={10} /> {t.pinned}
          </Badge>
        )}
        <span className="num text-[11px] text-text-muted-dark">{dateFormatter.format(new Date(comment.created_at))}</span>
      </div>

      <p className="mt-1.5 ms-9 text-[13.5px] text-text-secondary-dark">{comment.body}</p>

      <div className="ms-9 mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-text-muted-dark">
        <button onClick={() => setReplying((v) => !v)} className="flex items-center gap-1 hover:text-primary">
          <CornerDownLeft size={12} /> {t.reply}
        </button>
        {isOwn && (
          <>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 hover:text-primary">
              <Pencil size={12} /> {t.edit}
            </button>
            <button
              onClick={() => {
                if (window.confirm(t.confirmDeleteComment)) runVoid(() => deleteCommentAction(comment.id, courseSlug));
              }}
              disabled={pending}
              className="flex items-center gap-1 hover:text-error"
            >
              <Trash2 size={12} /> {t.delete}
            </button>
          </>
        )}
        {!isOwn && !isAdmin && (
          <button onClick={() => setReporting((v) => !v)} className="flex items-center gap-1 hover:text-error">
            <Flag size={12} /> {t.report}
          </button>
        )}
        {canModerate && (
          <button
            onClick={() => runVoid(() => togglePinCommentAction(comment.id, courseSlug, !comment.is_pinned))}
            disabled={pending}
            className="flex items-center gap-1 hover:text-gold"
          >
            <Pin size={12} /> {comment.is_pinned ? t.unpin : t.pin}
          </button>
        )}
      </div>

      {reporting && (
        <ReportForm commentId={comment.id} courseSlug={courseSlug} onDone={() => setReporting(false)} />
      )}

      {replying && (
        <div className="ms-9 mt-2">
          <InlineReplyForm
            action={addReplyAction.bind(null, comment.id, courseSlug)}
            onDone={() => setReplying(false)}
          />
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="ms-9 mt-3 flex flex-col gap-3 border-s border-border-dark ps-3">
          {comment.replies.map((r) => (
            <ReplyItem
              key={r.id}
              reply={r}
              courseSlug={courseSlug}
              currentUserId={currentUserId}
              teacherProfileId={teacherProfileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyItem({
  reply,
  courseSlug,
  currentUserId,
  teacherProfileId,
}: {
  reply: DiscussionComment["replies"][number];
  courseSlug: string;
  currentUserId: string | null;
  teacherProfileId: string | null;
}) {
  const { t: T } = useI18n();
  const t = T.learn.discussion;
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const isOwn = currentUserId === reply.userId;

  if (editing) {
    return (
      <InlineEditForm
        action={editReplyAction.bind(null, reply.id, courseSlug)}
        defaultValue={reply.body}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
        small
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-medium text-primary">{reply.profiles?.full_name ?? t.roleUser}</span>
        <AuthorBadge authorId={reply.userId} role={reply.profiles?.role} teacherProfileId={teacherProfileId} />
        <span className="num text-[10.5px] text-text-muted-dark">{dateFormatter.format(new Date(reply.created_at))}</span>
      </div>
      <p className="mt-1 text-[13px] text-text-secondary-dark">{reply.body}</p>
      {isOwn && (
        <div className="mt-1 flex gap-3 text-[11.5px] text-text-muted-dark">
          <button onClick={() => setEditing(true)} className="hover:text-primary">{t.edit}</button>
          <button
            onClick={() => {
              if (window.confirm(t.confirmDeleteReply)) {
                startTransition(() => {
                  deleteReplyAction(reply.id, courseSlug);
                });
              }
            }}
            disabled={pending}
            className="hover:text-error"
          >
            {t.delete}
          </button>
        </div>
      )}
    </div>
  );
}

function InlineEditForm({
  action,
  defaultValue,
  onCancel,
  onSaved,
  small,
}: {
  action: (prev: DiscussionActionState, formData: FormData) => Promise<DiscussionActionState>;
  defaultValue: string;
  onCancel: () => void;
  onSaved: () => void;
  small?: boolean;
}) {
  const { t: T } = useI18n();
  const t = T.learn.discussion;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      action({ error: null }, formData).then((result) => {
        if (result.error) setError(result.error);
        else onSaved();
      });
    });
  }

  return (
    <form onSubmit={handleSubmit} className={small ? "" : "ms-9"}>
      {error && <p className="mb-1 text-[11.5px] text-error">{error}</p>}
      <textarea
        name="body"
        rows={2}
        defaultValue={defaultValue}
        className="w-full rounded-sm border border-primary/40 bg-surface-dark px-3 py-2 text-[13px] outline-none"
      />
      <div className="mt-1.5 flex gap-2">
        <button type="submit" disabled={pending} className="text-[12px] font-semibold text-primary">
          {t.save}
        </button>
        <button type="button" onClick={onCancel} className="text-[12px] text-text-muted-dark">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function InlineReplyForm({
  action,
  onDone,
}: {
  action: (prev: DiscussionActionState, formData: FormData) => Promise<DiscussionActionState>;
  onDone: () => void;
}) {
  const { t: T } = useI18n();
  const t = T.learn.discussion;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      action({ error: null }, formData).then((result) => {
        if (result.error) setError(result.error);
        else onDone();
      });
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="mb-1 text-[11.5px] text-error">{error}</p>}
      <textarea
        name="body"
        rows={2}
        placeholder={t.replyPlaceholder}
        className="w-full rounded-sm border border-border-dark bg-surface-dark px-3 py-2 text-[13px] outline-none focus:border-primary"
      />
      <div className="mt-1.5 flex gap-2">
        <button type="submit" disabled={pending} className="text-[12px] font-semibold text-primary">
          {t.send}
        </button>
        <button type="button" onClick={onDone} className="text-[12px] text-text-muted-dark">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function ReportForm({
  commentId,
  courseSlug,
  onDone,
}: {
  commentId: string;
  courseSlug: string;
  onDone: () => void;
}) {
  const { t: T } = useI18n();
  const t = T.learn.discussion;
  const boundAction = reportCommentAction.bind(null, commentId, courseSlug);
  const [state, formAction, pending] = useActionState<DiscussionActionState, FormData>(boundAction, {
    error: null,
  });

  if (state.success) {
    return <p className="ms-9 mt-2 text-[12px] text-success">{state.success}</p>;
  }

  return (
    <form action={formAction} className="ms-9 mt-2 rounded-md border border-border-dark bg-elevated-dark p-3">
      {state.error && <p className="mb-1.5 text-[11.5px] text-error">{state.error}</p>}
      <select
        name="reason"
        defaultValue=""
        className="w-full rounded-sm border border-border-dark bg-surface-dark px-2.5 py-1.5 text-[12.5px]"
      >
        {/*
          The VALUE stays Arabic while only the label translates. It is
          what gets written to content_reports.reason and read by the
          moderation queue, so translating it would mean the same
          complaint arrives under two different strings depending on the
          reporter's language — and older reports would no longer match
          newer ones. The stored vocabulary is deliberately one language.
        */}
        <option value="" disabled>{t.reportReason}</option>
        <option value="محتوى غير لائق">{t.reasonInappropriate}</option>
        <option value="إزعاج أو ترويج">{t.reasonSpam}</option>
        <option value="معلومات مضللة">{t.reasonMisleading}</option>
        <option value="أخرى">{t.reasonOther}</option>
      </select>
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={pending} className="text-[12px] font-semibold text-error">
          {t.sendReport}
        </button>
        <button type="button" onClick={onDone} className="text-[12px] text-text-muted-dark">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
