import { SignedInShell } from "@/components/dashboard/StudentShell";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CourseHero } from "@/components/course-details/CourseHero";
import { WhatYouWillLearn } from "@/components/course-details/WhatYouWillLearn";
import { CourseContent } from "@/components/course-details/CourseContent";
import { PricingPanel } from "@/components/course-details/PricingPanel";
import { ReviewsSection } from "@/components/course-details/ReviewsSection";
import {
  getCourseBySlug,
  getCourseStructureForStudent,
  getStudentAccessState,
  getCoursePricing,
} from "@/lib/data/course-details";
import { getCourseReviews, getMyReviewState } from "@/lib/data/course-reviews";
import { getDictionary } from "@/lib/i18n/locale";
import { packsContaining } from "@/lib/data/packs";
import { PackBanner } from "@/components/packs/PackBanner";
import { getSessionUser } from "@/lib/auth/session";

async function CourseDetailsPageInner({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { dict } = await getDictionary();
  const t = dict.learn;
  const { slug } = await params;

  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const packs = await packsContaining(course.id);

  const sections = await getCourseStructureForStudent(course.id);
  const allLessonIds = sections.flatMap((s) => s.lessons.map((l) => l.id));
  const firstLessonId = sections[0]?.lessons[0]?.id ?? null;

  const [access, pricing, reviewsSummary, myReview] = await Promise.all([
    getStudentAccessState(course.id, allLessonIds),
    getCoursePricing(course.id),
    getCourseReviews(course.id),
    getMyReviewState(course.id),
  ]);

  return (
    <div className="bg-bg-light">
      <CourseHero course={course} />

      <Container className="grid gap-8 py-3xl lg:grid-cols-[1.6fr_1fr]">
        {/*
          min-w-0, and it is not cosmetic.

          A grid item defaults to `min-width: auto`, which means it
          refuses to shrink below the widest thing inside it. One long
          lesson title in the course contents — "Carbohydrates :Structure
          (1)" beside its duration, in a row that does not wrap — set
          that floor at 377px on a 375px phone. The column then pushed
          the whole page 18px wider than the screen, and everything from
          the header down shifted sideways. It reads as a broken page,
          not as one wide title.

          `min-w-0` lets the track shrink and the text inside wrap or
          truncate, which is what it was already styled to do.
        */}
        <div className="flex min-w-0 flex-col gap-6">
          <Reveal>
            <WhatYouWillLearn outcomes={course.learning_outcomes} />
          </Reveal>

          {course.description && (
            <Reveal delay={60}>
              <div className="rounded-lg border border-border-light bg-surface-light p-lg shadow-md">
                <h3 className="mb-3 text-[17px]">{t.courseDescription}</h3>
                <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-text-secondary-light">
                  {course.description}
                </p>
              </div>
            </Reveal>
          )}

          {packs.length > 0 && (
            <Reveal delay={100}>
              <PackBanner packs={packs} />
            </Reveal>
          )}

          <Reveal delay={120}>
            <CourseContent courseSlug={course.slug} sections={sections} access={access} />
          </Reveal>

          <Reveal delay={180}>
            <ReviewsSection summary={reviewsSummary} courseId={course.id} courseSlug={course.slug} myReview={myReview} />
          </Reveal>
        </div>

        <Reveal variant="scale" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <PricingPanel
            courseSlug={course.slug}
            firstLessonId={firstLessonId}
            pricing={pricing}
            access={access}
          />
        </Reveal>
      </Container>
    </div>
  );
}

/*
  The student shell is applied HERE rather than in a shared
  app/courses/layout.tsx, because the one page under /courses that must
  NOT have it — the lesson player — is nested below that layout and a
  child cannot opt out of an ancestor. Wrapping the two pages that want
  the rail keeps the player full-width without moving its URL.
*/
export default async function CourseDetailsPage(props: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <SignedInShell>
      <CourseDetailsPageInner {...props} />
    </SignedInShell>
  );
}
