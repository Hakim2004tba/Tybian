import Link from "next/link";
import Image from "next/image";
import { BookOpen, ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getAllProgress } from "@/lib/data/student-dashboard";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * "آخر الدورات التي دخلتها" — the compact recent-courses strip.
 *
 * Ordered by the real `last_activity_at` already present on each
 * progress row, so this is genuine recency rather than a re-ordering of
 * the enrolment list. Titles, covers and teachers come from ONE query
 * over the four ids that survive the slice — not a lookup per card.
 *
 * Renders nothing at all when the student has no activity yet: an empty
 * "recently accessed" rail is noise on a first-run dashboard, and the
 * enrolled-courses grid above already covers that state.
 */
export async function RecentCoursesStrip() {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  const progress = await getAllProgress(user!.id);

  const recent = progress
    .filter((p) => p.last_activity_at)
    .sort((a, b) => new Date(b.last_activity_at!).getTime() - new Date(a.last_activity_at!).getTime())
    .slice(0, 4);

  if (recent.length === 0) return null;

  const ids = recent.map((r) => r.course_id);
  const rows = await query<{
    id: string;
    slug: string;
    title: string;
    cover_url: string | null;
    teacher_name: string | null;
  }>(
    `SELECT c.id, c.slug, c.title, c.cover_url, p.full_name AS teacher_name
       FROM courses c
       LEFT JOIN teachers t ON t.id = c.teacher_id
       LEFT JOIN profiles p ON p.id = t.profile_id
      WHERE c.id IN (${ids.map(() => "?").join(",")})`,
    ids
  );

  const byId = new Map(
    rows.map((c) => {
      return [c.id, { ...c, teacherName: c.teacher_name }];
    })
  );

  const cards = recent
    .map((r) => {
      const c = byId.get(r.course_id);
      if (!c) return null;
      return {
        slug: c.slug as string,
        title: c.title as string,
        cover: (c.cover_url as string | null) ?? null,
        teacherName: c.teacherName as string | null,
        lessons: r.total_lessons,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (cards.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3.5 text-[17px] font-semibold text-text-primary-light">{t.courses.recentlyOpened}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.slug}
            href={`/courses/${c.slug}/learn`}
            className="group overflow-hidden rounded-lg border border-white/70 bg-white transition-all duration-200 hover:-translate-y-[3px] hover:border-primary hover:shadow-lg"
          >
            <div className="relative aspect-video bg-academy-deep">
              {c.cover ? (
                <Image src={c.cover} alt="" fill className="object-cover" unoptimized />
              ) : (
                <span className="flex h-full items-center justify-center text-white/25">
                  <BookOpen size={26} strokeWidth={1.5} />
                </span>
              )}
            </div>
            <div className="p-3.5">
              <h3 className="truncate text-[13.5px] font-semibold text-text-primary-light">{c.title}</h3>
              {c.teacherName && (
                <p className="mt-0.5 truncate text-[12px] text-text-muted-light">{c.teacherName}</p>
              )}
              <div className="mt-2.5 flex items-center justify-between">
                <span className="num text-[11.5px] text-text-muted-light">{c.lessons} {t.common.lessons}</span>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                  {t.common.continueLabel}
                  <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
