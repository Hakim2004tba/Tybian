import { Star } from "lucide-react";
import { getTeacherScope, listReviews } from "@/lib/data/teacher";
import { getDictionary } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function TeacherReviewsPage() {
  const { dict, locale } = await getDictionary();
  const t = dict.teacher.reviews;

  const scope = await getTeacherScope();
  if (!scope) return null;
  const reviews = await listReviews(scope);

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "en-GB", { dateStyle: "medium" });

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      {reviews.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border-light bg-white px-lg py-12 text-center">
          <Star size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] text-text-secondary-light">{t.empty}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-border-light bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < r.rating ? "text-gold" : "text-border-light"}
                      fill="currentColor"
                    />
                  ))}
                </div>
                <span className="num text-[12px] text-text-muted-light">
                  {fmt.format(new Date(`${r.created_at.replace(" ", "T")}Z`))}
                </span>
              </div>
              {r.comment && (
                <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary-light">{r.comment}</p>
              )}
              <p className="mt-2 text-[12px] text-text-muted-light">
                {r.student_name} · {r.course_title}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
