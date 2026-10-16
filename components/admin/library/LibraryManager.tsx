"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  Folder, FolderPlus, FolderOpen, Eye, EyeOff, Trash2, Pencil, ChevronUp, ChevronDown,
  FileText, ExternalLink, X, ChevronLeft,
} from "lucide-react";
import {
  createFolderAction, updateFolderAction, toggleFolderPublishedAction, deleteFolderAction,
  updateDocumentAction, toggleDocumentPublishedAction, deleteDocumentAction, moveDocumentAction,
  type ActionState,
} from "@/lib/admin/actions/library";
import { LibraryUploader } from "@/components/admin/library/LibraryUploader";
import { SubmitButton } from "@/components/auth/SubmitButton";
import type { LibraryFolder, LibraryDocument } from "@/lib/data/library";

const initial: ActionState = { error: null };

/**
 * The admin's view of one level of the library.
 *
 * Folders and documents together, because that is how the material is
 * actually shaped — "السنة الأولى / Anatomie / Cours 3" is a path, not
 * two separate screens — and because uploading belongs next to the
 * folder being filled rather than behind a wizard that asks where to
 * put the file after choosing it.
 *
 * The uploader appears only INSIDE a folder: a document with no folder
 * has no audience, since the year that decides who may read it lives on
 * the root of the chain.
 */
export function LibraryManager({
  folder,
  folders,
  documents,
  academicYears,
  courses,
}: {
  folder: LibraryFolder | null;
  folders: LibraryFolder[];
  documents: LibraryDocument[];
  academicYears: { id: string; label: string }[];
  courses: { id: string; title: string }[];
}) {
  const [createState, create] = useActionState(createFolderAction, initial);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const atRoot = folder === null;

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- new folder ---------- */}
      <section className="rounded-xl border border-border-light bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-text-primary-light">
          <FolderPlus size={16} className="text-primary" />
          {atRoot ? "مجلّد جديد (سنة أو قسم)" : `مجلّد فرعي داخل «${folder.title}»`}
        </h2>

        {/*
          The nesting was always unlimited — you create a folder, open
          it, and create another inside. Nothing on the screen said so,
          so it read as one flat level. This says it.
        */}
        <p className="mb-3 text-[12.5px] leading-relaxed text-text-secondary-light">
          {atRoot
            ? "افتح أي مجلّد لتنشئ داخله مجلّدات أخرى، بلا حدّ للعمق — مثال: Semester 1 ← Anatomy ← Ostéologie ← Introduction."
            : "أنشئ هنا المستوى التالي، أو ارفع الملفّات مباشرةً في هذا المجلّد."}
        </p>

        <form action={create} className="flex flex-col gap-3">
          {folder && <input type="hidden" name="parentId" value={folder.id} />}

          {createState.error && (
            <p className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-[13px] text-error">
              {createState.error}
            </p>
          )}
          {createState.success && (
            <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success">
              {createState.success}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="title"
              required
              placeholder="الاسم — مثلاً: السنة الأولى، أو Anatomie"
              className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
            />

            {/*
              The year selector only at the root. A sub-folder inherits
              its audience from the chain above it — offering the choice
              there would let an admin set a value that is silently
              ignored, which is worse than not offering it.
            */}
            {atRoot && (
              <select
                name="academicYearId"
                defaultValue=""
                className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
              >
                <option value="">لكل السنوات</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            )}
          </div>

          <input
            name="description"
            placeholder="وصف قصير (اختياري)"
            className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
          />

          <SubmitButton className="w-fit">أنشئ المجلّد</SubmitButton>
        </form>
      </section>

      {/* ---------- upload ---------- */}
      {folder && (
        <section className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">
            ارفع ملفّات إلى «{folder.title}»
          </h2>
          <LibraryUploader folderId={folder.id} />
        </section>
      )}

      {/* ---------- folders ---------- */}
      {folders.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">المجلّدات</h2>
          <ul className="flex flex-col gap-2">
            {folders.map((f) => (
              <li key={f.id} className="rounded-xl border border-border-light bg-white p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {f.childCount > 0 ? <FolderOpen size={17} /> : <Folder size={17} />}
                  </span>

                  <Link
                    href={`/admin/library?folder=${f.id}`}
                    className="group/row flex min-w-0 flex-1 items-center gap-2 hover:text-primary"
                    title="افتح المجلّد"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-text-primary-light group-hover/row:text-primary">
                        {f.title}
                      </span>
                      <span className="num block text-[11.5px] text-text-muted-light">
                        {f.childCount > 0 && `${f.childCount} مجلّد · `}
                        {f.documentCount} ملفّ
                      </span>
                      {/*
                        WHO CAN SEE THIS, spelled out.

                        A root folder scoped to one academic year is
                        invisible to every other year — which is the
                        point of the setting and was impossible to tell
                        from this screen. Two folders created side by
                        side, one for "all years" and one for the first
                        year, looked identical here and the student saw
                        only one of them.
                      */}
                      {f.parentId === null && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] text-primary">
                          {f.academicYearId === null
                            ? "يراه كل الطلبة"
                            : `يراه طلبة: ${
                                academicYears.find((y) => y.id === f.academicYearId)?.label ??
                                "سنة محذوفة"
                              }`}
                        </span>
                      )}
                      {!f.isPublished && (
                        <span className="mt-1 ms-1 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10.5px] text-gold">
                          مخفي — لا يراه أحد
                        </span>
                      )}
                    </span>
                    {/* An affordance, not decoration: without it the row
                        looked like a label rather than a way in. */}
                    <ChevronLeft
                      size={16}
                      className="shrink-0 text-text-muted-light transition group-hover/row:text-primary rtl:rotate-180"
                    />
                  </Link>

                  <RowButton
                    label={f.isPublished ? "إخفاء" : "إظهار"}
                    onClick={() => startTransition(() => void toggleFolderPublishedAction(f.id))}
                    tone={f.isPublished ? "on" : "off"}
                  >
                    {f.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                  </RowButton>

                  <RowButton
                    label="تعديل"
                    onClick={() => setEditingFolder(editingFolder === f.id ? null : f.id)}
                  >
                    {editingFolder === f.id ? <X size={14} /> : <Pencil size={13} />}
                  </RowButton>

                  <RowButton
                    label="حذف"
                    danger
                    onClick={() => {
                      if (!window.confirm(`حذف «${f.title}» وكل ما بداخله؟`)) return;
                      startTransition(() => void deleteFolderAction(f.id));
                    }}
                  >
                    <Trash2 size={13} />
                  </RowButton>
                </div>

                {editingFolder === f.id && (
                  <EditFolderForm
                    folder={f}
                    academicYears={academicYears}
                    onDone={() => setEditingFolder(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- documents ---------- */}
      {documents.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary-light">الملفّات</h2>
          <ul className="flex flex-col gap-2">
            {documents.map((d, i) => (
              <li key={d.id} className="rounded-xl border border-border-light bg-white p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText size={17} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-text-primary-light">
                      {d.title}
                    </span>
                    <span className="num block text-[11.5px] text-text-muted-light">
                      {d.kind.toUpperCase()} · {formatSize(d.sizeBytes)}
                      {d.kind !== "pdf" && d.kind !== "image" && " · تنزيل فقط"}
                    </span>
                  </span>

                  <RowButton
                    label="أعلى"
                    disabled={i === 0}
                    onClick={() => startTransition(() => void moveDocumentAction(d.id, "up"))}
                  >
                    <ChevronUp size={14} />
                  </RowButton>
                  <RowButton
                    label="أسفل"
                    disabled={i === documents.length - 1}
                    onClick={() => startTransition(() => void moveDocumentAction(d.id, "down"))}
                  >
                    <ChevronDown size={14} />
                  </RowButton>

                  <Link
                    href={`/dashboard/lessons/${d.id}`}
                    target="_blank"
                    title="معاينة"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border-light text-text-secondary-light hover:border-primary/40 hover:text-primary"
                  >
                    <ExternalLink size={13} />
                  </Link>

                  <RowButton
                    label={d.isPublished ? "إخفاء" : "إظهار"}
                    tone={d.isPublished ? "on" : "off"}
                    onClick={() => startTransition(() => void toggleDocumentPublishedAction(d.id))}
                  >
                    {d.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                  </RowButton>

                  <RowButton
                    label="تعديل"
                    onClick={() => setEditingDocument(editingDocument === d.id ? null : d.id)}
                  >
                    {editingDocument === d.id ? <X size={14} /> : <Pencil size={13} />}
                  </RowButton>

                  <RowButton
                    label="حذف"
                    danger
                    onClick={() => {
                      if (!window.confirm(`حذف «${d.title}»؟ سيُحذف الملفّ من القرص.`)) return;
                      startTransition(() => void deleteDocumentAction(d.id));
                    }}
                  >
                    <Trash2 size={13} />
                  </RowButton>
                </div>

                {editingDocument === d.id && (
                  <EditDocumentForm document={d} courses={courses} onDone={() => setEditingDocument(null)} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {folders.length === 0 && documents.length === 0 && (
        <p className="rounded-xl border border-border-light bg-white px-lg py-10 text-center text-[14px] text-text-secondary-light">
          لا شيء هنا بعد. أنشئ مجلّداً{folder ? " أو ارفع ملفّاً" : ""}.
        </p>
      )}
    </div>
  );
}

function EditFolderForm({
  folder, academicYears, onDone,
}: {
  folder: LibraryFolder;
  academicYears: { id: string; label: string }[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(updateFolderAction, initial);
  if (state.success) onDone();

  return (
    <form action={action} className="mt-3 flex flex-col gap-2.5 border-t border-border-light pt-3">
      <input type="hidden" name="id" value={folder.id} />
      {state.error && <p className="text-[12.5px] text-error">{state.error}</p>}

      <div className="grid gap-2.5 md:grid-cols-2">
        <input
          name="title"
          defaultValue={folder.title}
          required
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
        />
        {folder.parentId === null && (
          <select
            name="academicYearId"
            defaultValue={folder.academicYearId ?? ""}
            className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          >
            <option value="">لكل السنوات</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.label}</option>
            ))}
          </select>
        )}
      </div>

      <input
        name="description"
        defaultValue={folder.description ?? ""}
        placeholder="وصف قصير"
        className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
      />

      <SubmitButton className="w-fit">حفظ</SubmitButton>
    </form>
  );
}

function EditDocumentForm({
  document, courses, onDone,
}: {
  document: LibraryDocument;
  courses: { id: string; title: string }[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(updateDocumentAction, initial);
  if (state.success) onDone();

  return (
    <form action={action} className="mt-3 flex flex-col gap-2.5 border-t border-border-light pt-3">
      <input type="hidden" name="id" value={document.id} />
      {state.error && <p className="text-[12.5px] text-error">{state.error}</p>}

      <input
        name="title"
        defaultValue={document.title}
        required
        className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
      />
      <input
        name="description"
        defaultValue={document.description ?? ""}
        placeholder="وصف قصير"
        className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
      />

      {/* الدورة التي تشرح هذا الدرس — يراها الطالب كبطاقة تحت الملفّ. */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-text-secondary-light">الدورة الشارحة لهذا الدرس</span>
        <select
          name="courseId"
          defaultValue={document.courseId ?? ""}
          className="rounded-sm border border-border-light bg-surface-light px-3 py-2 text-[13.5px] outline-none focus:border-primary"
        >
          <option value="">— بلا دورة —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      <SubmitButton className="w-fit">حفظ</SubmitButton>
    </form>
  );
}

function RowButton({
  label, onClick, disabled, danger, tone, children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  tone?: "on" | "off";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-30 " +
        (danger
          ? "border-border-light text-error hover:border-error/40 hover:bg-error/10"
          : tone === "on"
            ? "border-success/40 bg-success/10 text-success"
            : tone === "off"
              ? "border-border-light text-text-muted-light"
              : "border-border-light text-text-secondary-light hover:border-primary/40 hover:text-primary")
      }
    >
      {children}
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
