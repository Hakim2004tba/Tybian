import { getSessionUser } from "@/lib/auth/session";
import { getEnrolledCoursesPage, getProgressForCourses } from "@/lib/data/student-dashboard";
import { DashboardCourseCard } from "@/components/dashboard/DashboardCourseCard";
import { Pagination } from "@/components/dashboard/Pagination";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * Paginated: fetches only ONE page of enrollments (6 courses), then
 * scopes the progress RPC to just those 6 course ids — never the
 * student's full enrollment/progress history at once, regardless of how
 * many courses they're enrolled in.
 */
export async function MyCoursesSection({
  page,
  currentParams,
}: {
  page: number;
  currentParams: Record<string, string | undefined>;
}) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  const { items: courses, totalCount, pageSize } = await getEnrolledCoursesPage(user!.id, page);

  if (courses.length === 0 && page === 1) {
    return (
      <Card>
        <p className="text-[14px] text-text-secondary-light">
          {t.courses.noEnrolled}
        </p>
      </Card>
    );
  }

  const progress = await getProgressForCourses(
    user!.id,
    courses.map((c) => c.id)
  );
  const progressByCourse = new Map(progress.map((p) => [p.course_id, p]));

  return (
    <div>
      {/* Capped at 2 columns: this grid now sits in the ~700px left rail
          of the dashboard, where the previous xl:grid-cols-3 produced
          ~210px cards. Below xl the rail becomes full width and two
          columns still read correctly. */}
      <div className="grid gap-5 sm:grid-cols-2">
        {courses.map((course, i) => (
          /* min-w-0: a grid item defaults to min-width:auto, so a
             child wider than the column — a long unbroken course title
             — widens the TRACK instead of wrapping, and the whole grid
             pushes off a phone screen. */
          <Reveal key={course.id} delay={Math.min(i, 6) * 50} className="min-w-0">
            <DashboardCourseCard course={course} progress={progressByCourse.get(course.id)} />
          </Reveal>
        ))}
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        paramName="coursesPage"
        basePath="/dashboard"
        currentParams={currentParams}
      />
    </div>
  );
}
