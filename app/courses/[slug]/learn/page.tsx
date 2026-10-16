import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getStudentAccessState } from "@/lib/data/course-details";
import {
  getLearnCourse,
  getLearnStructure,
  flattenLessons,
  getLessonDetail,
  getLessonResources,
  getLessonDiscussion,
  getLastWatchedInCourse,
} from "@/lib/data/learn";
import { getLessonNote } from "@/lib/data/lesson-notes";
import { getLocale } from "@/lib/i18n/locale";
import { resolvePlayback } from "@/lib/video/resolve-playback";
import { getAdjacentLessons } from "@/lib/video/adjacent-lessons";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { MobileCourseDrawer } from "@/components/learn/MobileCourseDrawer";
import { LearnBreadcrumb } from "@/components/learn/LearnBreadcrumb";
import { BackToDashboard } from "@/components/learn/BackToDashboard";
import { VimeoPlayer } from "@/components/learn/VimeoPlayer";
import { YouTubePlayer } from "@/components/learn/YouTubePlayer";
import { LockedLessonState } from "@/components/learn/LockedLessonState";
import { VideoNotReadyState } from "@/components/learn/VideoNotReadyState";
import { LessonMeta } from "@/components/learn/LessonMeta";
import { LessonOverviewPanel } from "@/components/learn/LessonOverviewPanel";
import { LessonNotesPanel } from "@/components/learn/LessonNotesPanel";
import { ResourcesList } from "@/components/learn/ResourcesList";
import { DiscussionPanel } from "@/components/learn/DiscussionPanel";
import { LessonTabs } from "@/components/learn/LessonTabs";
import { QuizPanel } from "@/components/quiz/QuizPanel";
import { getQuizForStudent, listAttempts } from "@/lib/data/quiz";
import { PrevNextNav } from "@/components/learn/PrevNextNav";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { getDictionary } from "@/lib/i18n/locale";
import { RateCoursePanel } from "@/components/reviews/RateCoursePanel";
import { getMyReviewState } from "@/lib/data/course-reviews";

/**
 * The video is NEVER fetched or rendered client-side for a lesson the
 * server hasn't already authorized: resolvePlayback() runs entirely
 * server-side, and only its `ok: true` branch ever reaches
 * <VimeoPlayer>. Every other branch renders <LockedLessonState> or
 * <VideoNotReadyState>, neither of which contains any iframe/src at
 * all. This mirrors, and directly reuses, the exact same pipeline
 * /api/lessons/:id/playback uses — see lib/video/resolve-playback.ts.
 */
export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { dict } = await getDictionary();
  const t = dict.learn;

  const { slug } = await params;
  const { lesson: requestedLessonId } = await searchParams;

  const user = await requireAuth(`/courses/${slug}/learn`);
  const locale = await getLocale();

  const course = await getLearnCourse(slug);
  if (!course) notFound();

  const sections = await getLearnStructure(course.id);
  const flatLessons = flattenLessons(sections);

  /* Whether this student may rate the course, and what they said last
     time — the same state the course page uses, read once here. */
  const myReview = await getMyReviewState(course.id);

  if (flatLessons.length === 0) {
    return (
      <div className="min-h-[calc(100vh-73px)] bg-bg-dark py-3xl">
        <Container>
          <Card tone="dark" className="mx-auto max-w-md text-center">
            <p className="text-[14px] text-text-secondary-dark">
              {t.noLessons}
            </p>
          </Card>
        </Container>
      </div>
    );
  }

  // Resolve the current lesson: explicit ?lesson= param, else resume the
  // last-watched lesson ("عندما يعود الطالب: افتح الفيديو من آخر position
  // محفوظ"), else the first lesson in the course.
  let currentLessonId = requestedLessonId;
  let resumePositionSeconds = 0;

  if (currentLessonId && !flatLessons.some((l) => l.id === currentLessonId)) {
    currentLessonId = undefined; // ignore an invalid/foreign lesson id
  }

  if (!currentLessonId) {
    const lastWatched = await getLastWatchedInCourse(user.id, course.id);
    if (lastWatched && flatLessons.some((l) => l.id === lastWatched.lessonId)) {
      currentLessonId = lastWatched.lessonId;
      resumePositionSeconds = lastWatched.positionSeconds;
    } else {
      currentLessonId = flatLessons[0].id;
    }
  }

  const access = await getStudentAccessState(course.id, flatLessons.map((l) => l.id));
  /*
    The student-facing query, which omits the answer key — see
    lib/data/quiz.ts. Fetched here and passed down so the key never
    reaches the browser even in the server-rendered payload.
  */
  const [quizQuestions, quizAttempts] = await Promise.all([
    getQuizForStudent(currentLessonId),
    listAttempts(user.id, currentLessonId),
  ]);
  const previousBest =
    quizAttempts.length > 0
      ? Math.max(
          ...quizAttempts.map((a) =>
            a.total_questions === 0 ? 0 : Math.round((a.correct_count / a.total_questions) * 100)
          )
        )
      : null;

  // If we defaulted via ?lesson= being absent (not the last-watched
  // path above), still recover this lesson's own saved position so a
  // direct reload of the current lesson resumes correctly too.
  if (resumePositionSeconds === 0) {
    const progress = access.progressByLessonId.get(currentLessonId);
    if (progress) resumePositionSeconds = progress.lastPositionSeconds;
  }

  /* An unanswered private question, so the link points at it instead
     of offering a second one. */

  const [playback, lessonDetail, resources, discussion, noteBody] = await Promise.all([
    resolvePlayback(currentLessonId),
    getLessonDetail(currentLessonId),
    getLessonResources(currentLessonId),
    getLessonDiscussion(currentLessonId),
    getLessonNote(user.id, currentLessonId),
  ]);

  const adjacent = getAdjacentLessons(flatLessons, currentLessonId, access.hasAccess);
  const completedLessonIds = new Set(
    [...access.progressByLessonId.entries()].filter(([, p]) => p.isCompleted).map(([id]) => id)
  );
  const isCurrentLessonCompleted = completedLessonIds.has(currentLessonId);
  const durationSeconds = playback.ok ? playback.durationSeconds : 0;

  return (
    /*
      min-h-screen, not min-h-[calc(100vh-73px)]: that 73px was the
      marketing navbar's height, and a signed-in student no longer has
      one above this page. Subtracting it now leaves a strip of page
      background under the player.
    */
    <div className="flex min-h-screen flex-col bg-bg-dark lg:flex-row">
      <LearnSidebar
        courseTitle={course.title}
        courseSlug={course.slug}
        sections={sections}
        currentLessonId={currentLessonId}
        hasAccess={access.hasAccess}
        completedLessonIds={completedLessonIds}
      />

      <main className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 px-lg pt-lg lg:px-xl">
          <div className="flex min-w-0 items-center gap-3">
            {/* This page has no student rail — see the note on the
                wrapper in app/courses/page.tsx. The back button is the
                whole of its navigation. */}
            <BackToDashboard fallback={`/courses/${course.slug}`} />
            <LearnBreadcrumb courseSlug={course.slug} courseTitle={course.title} lessonTitle={lessonDetail?.title ?? ""} />
          </div>
          <MobileCourseDrawer
            courseTitle={course.title}
            courseSlug={course.slug}
            sections={sections}
            currentLessonId={currentLessonId}
            hasAccess={access.hasAccess}
            completedLessonIds={completedLessonIds}
            locale={locale}
          />
        </div>

        <div className="px-lg pt-4 lg:px-xl">
          {playback.ok ? (
            playback.source === "youtube" ? (
              <YouTubePlayer
                playbackUrl={playback.playbackUrl}
                lessonId={currentLessonId}
                courseSlug={course.slug}
                initialPositionSeconds={resumePositionSeconds}
                durationSeconds={playback.durationSeconds}
              />
            ) : (
              <VimeoPlayer
                lessonId={currentLessonId}
                courseSlug={course.slug}
                playbackUrl={playback.playbackUrl}
                initialPositionSeconds={resumePositionSeconds}
                durationSeconds={playback.durationSeconds}
              />
            )
          ) : playback.reason === "no_video" || playback.reason === "video_not_ready" ? (
            // The student IS authorized here — free preview, or a real
            // enrollment — the video itself just isn't attached/ready.
            // Showing the lock+subscribe UI in this case would be wrong.
            <VideoNotReadyState message={playback.message} />
          ) : (
            <LockedLessonState message={playback.message} courseSlug={course.slug} />
          )}
        </div>

        <div className="flex flex-col gap-6 p-lg lg:p-xl">
          <LessonMeta
            title={lessonDetail?.title ?? ""}
            courseTitle={course.title}
            durationSeconds={durationSeconds}
            lessonId={currentLessonId}
            courseSlug={course.slug}
            isCompleted={isCurrentLessonCompleted}
            hasAccess={access.hasAccess}
          />

          <PrevNextNav
            courseSlug={course.slug}
            adjacent={adjacent}
            completedCount={completedLessonIds.size}
            totalCount={flatLessons.length}
          />

          <LessonTabs
            tabs={[
              {
                id: "overview",
                label: t.tabs.overview,
                content: (
                  <LessonOverviewPanel
                    description={lessonDetail?.description ?? null}
                    teacherName={course.teacherName}
                    courseTitle={course.title}
                    durationSeconds={durationSeconds}
                  />
                ),
              },
              {
                id: "notes",
                label: t.tabs.notes,
                content: <LessonNotesPanel lessonId={currentLessonId} initialBody={noteBody} />,
              },
              {
                id: "resources",
                label: t.tabs.attachments,
                content:
                  resources.length > 0 ? (
                    <ResourcesList resources={resources} lessonId={currentLessonId} />
                  ) : (
                    <p className="text-[13.5px] text-text-muted-dark">{t.noAttachments}</p>
                  ),
              },
              {
                id: "qcm",
                label: dict.quiz.tabLabel,
                content: (
                  <QuizPanel
                    lessonId={currentLessonId}
                    questions={quizQuestions}
                    previousBest={previousBest}
                  />
                ),
              },
              {
                id: "discussion",
                label: t.tabs.discussion,
                content: (
                  <>
                    <DiscussionPanel
                      lessonId={currentLessonId}
                      courseSlug={course.slug}
                      comments={discussion}
                      currentUserId={user.id}
                      currentUserRole={user.role}
                      teacherProfileId={course.teacherProfileId}
                      canModerate={user.role === "admin" || (user.role === "teacher" && user.id === course.teacherProfileId)}
                    />

                  </>
                ),
              },
            ]}
          />

          {/*
            RATING, WHERE THE STUDENT ACTUALLY IS.

            It used to exist only on the course's sales page, which a
            student who had already bought the course had no reason to
            open again — so the people best placed to rate it were the
            ones who could not reach the form.
          */}
          {myReview.canReview && (
            <div className="mt-6">
              <RateCoursePanel
                courseId={course.id}
                courseSlug={course.slug}
                existingReview={myReview.existingReview}
                tone="dark"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
