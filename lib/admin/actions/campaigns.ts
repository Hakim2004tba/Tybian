"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, query, queryOne } from "@/lib/db";
import { requireRouteAccess, getSessionUser } from "@/lib/auth/session";
import { tablesExist } from "@/lib/db/tables";
import { sendCampaignEmail } from "@/lib/mail";
import {
  CAMPAIGN_TABLES, BATCH_SIZE, type CampaignState, type BatchResult,
} from "@/lib/admin/campaigns-shared";


export async function campaignsReady(): Promise<boolean> {
  return tablesExist(CAMPAIGN_TABLES);
}

/** Who a given audience resolves to. Used for the count AND the send,
 *  so the number shown before sending is the number that is sent to. */
async function audienceRows(
  audience: string,
  courseId: string | null,
  yearId: string | null
): Promise<{ id: string; email: string }[]> {
  /*
    Every branch requires a verified address. Sending to unverified
    accounts is how a domain's reputation is spent: they are the
    addresses most likely to be mistyped or abandoned, and the bounces
    land on the same domain the password-reset mail goes out from.
  */
  const base = `
    FROM profiles p
    JOIN users u ON u.id = p.id
   WHERE p.deleted_at IS NULL
     AND u.email_verified_at IS NOT NULL`;

  if (audience === "course" && courseId) {
    return query<{ id: string; email: string }>(
      `SELECT DISTINCT p.id, u.email ${base}
         AND EXISTS (
           SELECT 1 FROM enrollments e
            WHERE e.user_id = p.id AND e.course_id = ? AND e.deleted_at IS NULL
         )`,
      [courseId]
    );
  }

  if (audience === "year" && yearId) {
    return query<{ id: string; email: string }>(
      `SELECT DISTINCT p.id, u.email ${base} AND p.academic_year_id = ?`,
      [yearId]
    );
  }

  return query<{ id: string; email: string }>(`SELECT DISTINCT p.id, u.email ${base}`);
}

/** The headcount, before anything is written or sent. */
export async function countAudienceAction(
  audience: string,
  courseId: string | null,
  yearId: string | null
): Promise<number> {
  await requireRouteAccess("/admin");
  if (!(await campaignsReady())) return 0;
  return (await audienceRows(audience, courseId, yearId)).length;
}

/**
 * Writes the campaign and its recipient list. SENDS NOTHING.
 *
 * Separated from sending so the list is fixed before the first message
 * leaves: a student enrolling halfway through must not receive an
 * announcement the rest got an hour earlier, and — more importantly —
 * the set being sent to cannot change under a resumed send.
 */
export async function createCampaignAction(_prev: CampaignState, formData: FormData): Promise<CampaignState> {
  await requireRouteAccess("/admin");
  const user = await getSessionUser();

  if (!(await campaignsReady())) {
    return { error: "شغّل ملفّ 17-campaigns.sql في phpMyAdmin أولاً." };
  }

  const subject = String(formData.get("subject") ?? "").trim().slice(0, 255);
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  const courseId = String(formData.get("courseId") ?? "").trim() || null;
  const yearId = String(formData.get("academicYearId") ?? "").trim() || null;

  if (!subject) return { error: "اكتب عنوان الرسالة" };
  if (!body) return { error: "اكتب نصّ الرسالة" };
  if (audience === "course" && !courseId) return { error: "اختر الدورة" };
  if (audience === "year" && !yearId) return { error: "اختر السنة الدراسية" };

  const recipients = await audienceRows(audience, courseId, yearId);
  if (recipients.length === 0) return { error: "لا يوجد مستلمون بهذه الشروط" };

  const id = newId();
  await execute(
    `INSERT INTO email_campaigns
       (id, subject, body, audience, course_id, academic_year_id, status, total_count, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'sending', ?, ?)`,
    [id, subject, body, audience, courseId, yearId, recipients.length, user?.id ?? null]
  );

  /* One statement rather than one per recipient: a thousand round trips
     to write a list is itself enough to exhaust a request. */
  const values = recipients.map(() => "(?, ?, ?, ?)").join(",");
  const params = recipients.flatMap((r) => [newId(), id, r.id, r.email]);
  await execute(
    `INSERT INTO campaign_recipients (id, campaign_id, user_id, email) VALUES ${values}`,
    params
  );

  revalidatePath("/admin/campaigns");
  return { error: null, campaignId: id, success: `القائمة جاهزة: ${recipients.length} مستلماً.` };
}

/**
 * Sends the next batch. Called repeatedly until `done`.
 *
 * Each row is marked the moment its own send settles, not at the end of
 * the batch: if the request is cut off mid-way, everything already sent
 * is already recorded, and resuming picks up exactly where it stopped.
 * A failure marks that one row and the batch continues — one bad
 * address must not stop an announcement to four hundred people.
 */
export async function sendBatchAction(campaignId: string): Promise<BatchResult> {
  await requireRouteAccess("/admin");

  const campaign = await queryOne<{ subject: string; body: string }>(
    `SELECT subject, body FROM email_campaigns WHERE id = ?`,
    [campaignId]
  );
  if (!campaign) return { sent: 0, failed: 0, remaining: 0, done: true };

  const batch = await query<{ id: string; email: string }>(
    `SELECT id, email FROM campaign_recipients
      WHERE campaign_id = ? AND status = 'pending'
      LIMIT ${BATCH_SIZE}`,
    [campaignId]
  );

  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    try {
      await sendCampaignEmail(row.email, campaign.subject, campaign.body);
      await execute(
        `UPDATE campaign_recipients SET status = 'sent', sent_at = UTC_TIMESTAMP(3) WHERE id = ?`,
        [row.id]
      );
      sent++;
    } catch (error) {
      await execute(
        `UPDATE campaign_recipients SET status = 'failed', error = ? WHERE id = ?`,
        [String(error instanceof Error ? error.message : error).slice(0, 255), row.id]
      );
      failed++;
    }
  }

  await execute(
    `UPDATE email_campaigns c
        SET sent_count   = (SELECT COUNT(*) FROM campaign_recipients r
                             WHERE r.campaign_id = c.id AND r.status = 'sent'),
            failed_count = (SELECT COUNT(*) FROM campaign_recipients r
                             WHERE r.campaign_id = c.id AND r.status = 'failed')
      WHERE c.id = ?`,
    [campaignId]
  );

  const left = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM campaign_recipients
      WHERE campaign_id = ? AND status = 'pending'`,
    [campaignId]
  );
  const remaining = Number(left?.n ?? 0);

  if (remaining === 0) {
    await execute(
      `UPDATE email_campaigns
          SET status = 'sent', finished_at = UTC_TIMESTAMP(3)
        WHERE id = ?`,
      [campaignId]
    );
    revalidatePath("/admin/campaigns");
  }

  return { sent, failed, remaining, done: remaining === 0 };
}
