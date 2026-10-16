"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne } from "@/lib/db";
import { recomputeCourseAggregates } from "@/lib/data/course-aggregates";
import { requireRouteAccess } from "@/lib/auth/session";
import { extractVimeoVideoId } from "@/lib/video/extract-vimeo-id";
import { extractYoutubeVideoId } from "@/lib/video/extract-youtube-id";

export type ActionState = { error: string | null; success?: string | null };

async function assertAdmin() {
  await requireRouteAccess("/admin");
}

/**
 * Attaches a video the admin has already uploaded to Vimeo. There is no
 * upload flow through this platform at all: the admin uploads on
 * vimeo.com (their own account, their own bandwidth) and pastes the
 * link here.
 *
 * The only network call is Vimeo's public oEmbed endpoint, which needs
 * no API key or access token — it confirms the video actually exists
 * and is embeddable, and returns the real title, thumbnail and (unlike
 * YouTube's oEmbed) the exact duration, so the admin never has to type
 * a duration by hand.
 *
 * An unlisted Vimeo video is addressed as vimeo.com/<id>/<hash>, and
 * both halves are stored — the embed will not play without the hash.
 */
export async function attachVimeoVideoAction(
  lessonId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const raw = String(formData.get("vimeoUrlOrId") ?? "").trim();
  const titleOverride = String(formData.get("title") ?? "").trim();

  if (!raw) return { error: "الرجاء لصق رابط الفيديو من Vimeo" };

  const ref = extractVimeoVideoId(raw);
  if (!ref) {
    return { error: "تعذّر التعرّف على معرّف الفيديو — تأكد أنه رابط Vimeo صحيح مثل vimeo.com/123456789" };
  }


  // Like YouTube (see 0032), a Vimeo video is an external reference
  // rather than an owned asset, so the same video may legitimately back
  // more than one lesson. No uniqueness check.

  const canonical = ref.hash
    ? `https://vimeo.com/${ref.videoId}/${ref.hash}`
    : `https://vimeo.com/${ref.videoId}`;

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");

  let oembedTitle: string | null = null;
  let thumbnailUrl: string | null = null;
  let durationSeconds = 0;
  let oembedFailure: string | null = null;

  try {
    // THE REFERER IS REQUIRED, not decorative. Videos restricted to
    // this platform's domain (the recommended privacy setting) answer an
    // anonymous oEmbed request with a truncated payload —
    // `domain_status_code: 403`, no title, no thumbnail and no
    // duration — which is why every attached lesson was saved with 0
    // minutes and every course advertised "0 hours". Presenting the
    // site's own origin gets the real metadata back.
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(canonical)}`, {
      headers: siteOrigin ? { Referer: siteOrigin } : {},
    });
    if (res.ok) {
      const data = await res.json();

      // Vimeo answers 200 with a STRIPPED payload when the video is
      // domain-restricted and the caller is not on its allow-list: no
      // title, no thumbnail, no duration, just `domain_status_code:
      // 403`. That reads like a working call with no metadata, which is
      // exactly how every lesson ended up stored with 0 minutes.
      if (data?.domain_status_code === 403) {
        oembedFailure = `إعدادات خصوصية Vimeo تمنع هذا النطاق. أضف ${siteOrigin ?? "نطاق المنصة"} إلى النطاقات المسموح بها في إعدادات الفيديو على Vimeo.`;
      } else {
        oembedTitle = typeof data.title === "string" ? data.title : null;
        thumbnailUrl = typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
        durationSeconds = typeof data.duration === "number" ? Math.round(data.duration) : 0;
      }
    } else if (res.status === 403) {
      // Vimeo answers 403 for a private video, and for an unlisted one
      // whose hash is missing or wrong — by far the most common paste
      // mistake, so name it instead of reporting a generic failure.
      oembedFailure =
        "رفضت Vimeo عرض هذا الفيديو — إن كان غير مُدرج (unlisted) فانسخ الرابط الكامل بالرمز الخاص (vimeo.com/123456789/abcdef1234)، وإن كان خاصاً (private) فغيّر خصوصيته إلى unlisted.";
    } else if (res.status === 404) {
      oembedFailure = "لم تعثر Vimeo على هذا الفيديو — تأكد من صحة الرابط.";
    } else {
      oembedFailure = `ردّت Vimeo برمز ${res.status}.`;
    }
  } catch {
    // Network failure reaching Vimeo is not fatal on its own — fall
    // through to the manual-title path below rather than blocking the
    // attach over a momentary outage.
  }

  if (oembedFailure) return { error: oembedFailure };

  if (!oembedTitle && !titleOverride) {
    return { error: "تعذّر التحقق من الفيديو على Vimeo — تأكد من الرابط، أو أدخل عنواناً يدوياً" };
  }

  const dbVideoId = newId();

  try {
    // youtube_video_id stays NULL, which videos_source_check requires
    // for a vimeo row — and MariaDB actually enforces that check.
    await execute(
      `INSERT INTO videos
         (id, source, vimeo_video_id, vimeo_hash, title, status, duration_seconds, thumbnail_url)
       VALUES (?, 'vimeo', ?, ?, ?, 'ready', ?, ?)`,
      [
        dbVideoId,
        ref.videoId,
        ref.hash,
        titleOverride || oembedTitle || "فيديو من Vimeo",
        durationSeconds,
        thumbnailUrl,
      ]
    );
    await execute(`UPDATE lessons SET video_id = ? WHERE id = ?`, [dbVideoId, lessonId]);
    // videos_count and duration_minutes both change; the trigger that
    // used to maintain them does not exist on MariaDB.
    await recomputeCourseAggregates(courseId);
  } catch (error) {
    return { error: "تعذّر حفظ سجل الفيديو: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تم ربط فيديو Vimeo بنجاح" };
}

export async function attachYoutubeVideoAction(
  lessonId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const raw = String(formData.get("youtubeUrlOrId") ?? "").trim();
  const titleOverride = String(formData.get("title") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? 0);

  if (!raw) return { error: "الرجاء لصق رابط الفيديو أو معرّفه من يوتيوب" };

  const videoId = extractYoutubeVideoId(raw);
  if (!videoId) {
    return { error: "تعذّر التعرّف على معرّف الفيديو من النص المُدخل — تأكد أنه رابط يوتيوب صحيح" };
  }


  // A YouTube video is an external reference, not an owned asset — the
  // same video legitimately applies to more than one lesson (a shared
  // intro clip, the same public lecture referenced from two related
  // lessons, etc.), so no uniqueness check here. See 0032.

  let oembedTitle: string | null = null;
  let thumbnailUrl: string | null = null;

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
    );
    if (res.ok) {
      const data = await res.json();
      oembedTitle = typeof data.title === "string" ? data.title : null;
      thumbnailUrl = typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
    }
  } catch {
    // oEmbed unreachable — not fatal, we fall back to the admin-provided
    // title below. We do NOT fail the whole attach just because YouTube's
    // metadata endpoint was momentarily unreachable.
  }

  if (!oembedTitle && !titleOverride) {
    return {
      error: "تعذّر التحقق من وجود هذا الفيديو على يوتيوب — تأكد من صحة الرابط، أو أدخل عنواناً يدوياً",
    };
  }

  const dbVideoId = newId();

  try {
    await execute(
      `INSERT INTO videos
         (id, source, youtube_video_id, title, status, duration_seconds, thumbnail_url)
       VALUES (?, 'youtube', ?, ?, 'ready', ?, ?)`,
      [
        dbVideoId,
        videoId,
        titleOverride || oembedTitle || "فيديو من يوتيوب",
        Number.isFinite(durationMinutes) && durationMinutes > 0
          ? Math.round(durationMinutes * 60)
          : 0,
        thumbnailUrl,
      ]
    );
    await execute(`UPDATE lessons SET video_id = ? WHERE id = ?`, [dbVideoId, lessonId]);
    await recomputeCourseAggregates(courseId);
  } catch (error) {
    return { error: "تعذّر حفظ سجل الفيديو: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تم ربط فيديو يوتيوب بنجاح" };
}

/**
 * Renames the platform's own record of a video.
 *
 * Both remaining providers host videos the platform references rather
 * than owns, so there is nothing remote to push a rename to and no
 * transcode status to poll — what Bunny needed this action for is gone.
 * Title/duration/thumbnail were captured from the provider's oEmbed at
 * attach time; this only edits the local title.
 */
export async function refreshOrUpdateVideoAction(
  videoId: string,
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const newTitle = String(formData.get("title") ?? "").trim();
  if (!newTitle) return { error: null };


  const video = await queryOne<{ id: string }>(`SELECT id FROM videos WHERE id = ?`, [videoId]);
  if (!video) return { error: "الفيديو غير موجود" };

  try {
    await execute(`UPDATE videos SET title = ? WHERE id = ?`, [newTitle, videoId]);
  } catch {
    return { error: "تعذّر حفظ العنوان" };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null, success: "تم تحديث العنوان" };
}

export async function detachVideoAction(lessonId: string, courseId: string) {
  await assertAdmin();

  try {
    await execute(`UPDATE lessons SET video_id = NULL WHERE id = ?`, [lessonId]);
    await recomputeCourseAggregates(courseId);
  } catch (error) {
    return { error: "تعذّر فصل الفيديو عن الدرس: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}

/**
 * Removes the platform's record of a video and detaches it from its
 * lesson.
 *
 * This never deletes anything on YouTube or Vimeo: those videos live in
 * the uploader's own account and are only referenced here. Removing the
 * reference is the whole operation — which also means an admin who
 * wants the video actually gone must delete it in the provider's own
 * dashboard as well.
 */
export async function deleteVideoAction(videoId: string, lessonId: string, courseId: string) {
  await assertAdmin();

  const video = await queryOne<{ id: string }>(`SELECT id FROM videos WHERE id = ?`, [videoId]);
  if (!video) return { error: "الفيديو غير موجود" };

  await execute(`UPDATE lessons SET video_id = NULL WHERE id = ?`, [lessonId]);

  try {
    await execute(`DELETE FROM videos WHERE id = ?`, [videoId]);
    await recomputeCourseAggregates(courseId);
  } catch (error) {
    return { error: "تعذّر حذف الفيديو: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}/structure`);
  return { error: null };
}
