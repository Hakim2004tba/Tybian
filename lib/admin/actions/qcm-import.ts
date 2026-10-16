"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { execute, newId, pool } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { bankReady } from "@/lib/data/qcm-bank";

export type ImportState = {
  error: string | null;
  topic?: string;
  questions?: number;
};

/**
 * Imports ONE exported topic file into the bank.
 *
 * One file per call on purpose. A subject is eight hundred questions
 * across eighteen files; sending them in a single request on shared
 * hosting is a request that gets cut off halfway, leaving a bank
 * nobody can tell is half-written. The page calls this once per file
 * and shows each one land.
 *
 * RE-IMPORTING IS SAFE. Ids are derived from the source's own ids, and
 * every write is an upsert, so running the same file twice updates
 * rather than duplicating — the mistake that turns a bank of 869 into
 * a bank of 1738.
 */
export async function importTopicAction(
  subjectName: string,
  subjectSlug: string,
  fileName: string,
  json: string
): Promise<ImportState> {
  await requireRouteAccess("/admin");

  if (!(await bankReady())) {
    return { error: "شغّل ملفّ 25-qcm-bank.sql في phpMyAdmin أولاً." };
  }

  const name = subjectName.trim();
  const slug = subjectSlug.trim().toLowerCase();
  if (!name || !/^[a-z0-9-]{2,60}$/.test(slug)) {
    return { error: "اسم المادّة ومُعرّفها (حروف لاتينية صغيرة وشرطات) مطلوبان" };
  }

  let data: {
    title?: string;
    questions?: {
      id?: number | string;
      original_id?: number | string;
      statement?: string;
      question?: string;
      explanation?: string | null;
      media_urls?: string[];
      metadata?: { type?: string; tags?: string[] };
      options?: { letter?: string; text?: string; is_correct?: boolean }[];
    }[];
  };
  try {
    data = JSON.parse(json);
  } catch {
    return { error: `${fileName}: الملفّ ليس JSON صالحاً` };
  }

  const questions = data.questions ?? [];
  if (questions.length === 0) return { error: `${fileName}: لا أسئلة في هذا الملفّ` };

  /* Deterministic ids, so a second import writes the same rows. */
  const idFor = (...parts: string[]) =>
    createHash("sha1")
      .update(parts.join(" "))
      .digest("hex")
      .slice(0, 32)
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, "$1-$2-$3-$4-$5");

  const title = (data.title ?? fileName.replace(/\.json$/i, "")).slice(0, 255);
  const topicSlug =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 180) || "topic";

  const subjectId = idFor("subject", slug);
  const topicId = idFor("topic", slug, topicSlug);

  /* The subject becomes active the moment it has questions. */
  await execute(
    `INSERT INTO qcm_subjects (id, name, slug, is_active, sort_order)
     VALUES (?, ?, ?, 1, 0)
     ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1`,
    [subjectId, name, slug]
  );

  await execute(
    `INSERT INTO qcm_topics (id, subject_id, title, slug, sort_order)
     VALUES (?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE title = VALUES(title)`,
    [topicId, subjectId, title, topicSlug]
  );

  let written = 0;

  for (const [i, question] of questions.entries()) {
    const meta = question.metadata ?? {};
    const external = String(question.original_id ?? question.id ?? `${topicSlug}-${i}`);
    const questionId = idFor("question", topicId, external);
    const kind = String(meta.type ?? "QCU").toUpperCase() === "QCM" ? "qcm" : "qcu";
    const statement = question.statement ?? question.question ?? "";
    const media = question.media_urls ?? [];
    const tags = meta.tags ?? [];

    await execute(
      `INSERT INTO qcm_questions
         (id, topic_id, kind, statement, explanation, media, tags, external_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE kind = VALUES(kind), statement = VALUES(statement),
         explanation = VALUES(explanation), media = VALUES(media),
         tags = VALUES(tags), sort_order = VALUES(sort_order)`,
      [
        questionId,
        topicId,
        kind,
        statement,
        question.explanation ?? null,
        media.length ? JSON.stringify(media) : null,
        tags.length ? JSON.stringify(tags) : null,
        external,
        i,
      ]
    );

    const options = question.options ?? [];
    if (options.length > 0) {
      /* One statement for the whole question's options rather than one
         per option: five round trips per question is four thousand
         round trips for a subject. */
      const values = options.map(() => "(?, ?, ?, ?, ?, ?)").join(",");
      const args = options.flatMap((option, j) => {
        const letter = (option.letter ?? String.fromCharCode(65 + j)).slice(0, 1);
        return [
          idFor("option", questionId, letter),
          questionId,
          letter,
          option.text ?? "",
          option.is_correct ? 1 : 0,
          j,
        ];
      });
      await pool().query(
        `INSERT INTO qcm_options (id, question_id, letter, body, is_correct, position)
         VALUES ${values}
         ON DUPLICATE KEY UPDATE body = VALUES(body), is_correct = VALUES(is_correct),
           position = VALUES(position)`,
        args
      );
    }

    written++;
  }

  revalidatePath("/admin/qcm-import");
  revalidatePath("/dashboard/qcm");
  return { error: null, topic: title, questions: written };
}

/** Marks a subject "coming soon" again, or brings it back. */
export async function toggleSubjectAction(subjectId: string): Promise<void> {
  await requireRouteAccess("/admin");
  await execute(
    `UPDATE qcm_subjects SET is_active = 1 - is_active WHERE id = ?`,
    [subjectId]
  );
  revalidatePath("/admin/qcm-import");
  revalidatePath("/dashboard/qcm");
}

/** Adds an empty subject, so it shows as "coming soon". */
export async function addSubjectAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  await requireRouteAccess("/admin");
  if (!(await bankReady())) {
    return { error: "شغّل ملفّ 25-qcm-bank.sql في phpMyAdmin أولاً." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 191);
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();

  if (!name) return { error: "اكتب اسم المادّة" };
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
    return { error: "المُعرّف: حروف لاتينية صغيرة وأرقام وشرطات فقط" };
  }

  await execute(
    `INSERT INTO qcm_subjects (id, name, slug, is_active, sort_order)
     VALUES (?, ?, ?, 0, 99)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [newId(), name, slug]
  );

  revalidatePath("/admin/qcm-import");
  revalidatePath("/dashboard/qcm");
  return { error: null };
}
