import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CourseHero } from "@/components/course-details/CourseHero";
import { WhatYouWillLearn } from "@/components/course-details/WhatYouWillLearn";
import { CourseContent } from "@/components/course-details/CourseContent";
import { PricingPanel } from "@/components/course-details/PricingPanel";
import { ReviewsSection } from "@/components/course-details/ReviewsSection";
import { QuestionsSection } from "@/components/course-details/QuestionsSection";
import {
  getCourseBySlug,
  getCourseStructureForStudent,
  getStudentAccessState,
  getCoursePricing,
} from "@/lib/data/course-details";
import { getCourseReviews, getCourseQuestions, getMyReviewState } from "@/lib/data/course-reviews";

export default async function CourseDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const sections = await getCourseStructureForStudent(course.id);
  const allLessonIds = sections.flatMap((s) => s.lessons.map((l) => l.id));
  const firstLessonId = sections[0]?.lessons[0]?.id ?? null;

  const [access, pricing, reviewsSummary, questions, myReview] = await Promise.all([
    getStudentAccessState(course.id, allLessonIds),
    getCoursePricing(course.id),
    getCourseReviews(course.id),
    getCourseQuestions(allLessonIds),
    getMyReviewState(course.id),
  ]);

  return (
    <div className="bg-bg-light">
      <CourseHero course={course} />

      <Container className="grid gap-8 py-3xl lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <Reveal>
            <WhatYouWillLearn outcomes={course.learning_outcomes} />
          </Reveal>

          {course.description && (
            <Reveal delay={60}>
              <div className="rounded-lg border border-border-light bg-surface-light p-lg shadow-md">
                <h3 className="mb-3 text-[17px]">وصف الدورة</h3>
                <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-text-secondary-light">
                  {course.description}
                </p>
              </div>
            </Reveal>
          )}

          <Reveal delay={120}>
            <CourseContent courseSlug={course.slug} sections={sections} access={access} />
          </Reveal>

          <Reveal delay={180}>
            <ReviewsSection summary={reviewsSummary} courseId={course.id} courseSlug={course.slug} myReview={myReview} />
          </Reveal>
          <Reveal delay={220}>
            <QuestionsSection questions={questions} />
          </Reveal>
        </div>

        <Reveal variant="scale" className="lg:sticky lg:top-24 lg:self-start">
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
