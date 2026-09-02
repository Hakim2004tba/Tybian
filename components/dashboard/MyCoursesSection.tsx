import { getSessionUser } from "@/lib/auth/session";
import { getEnrolledCoursesPage, getProgressForCourses } from "@/lib/data/student-dashboard";
import { DashboardCourseCard } from "@/components/dashboard/DashboardCourseCard";
import { Pagination } from "@/components/dashboard/Pagination";
import { Reveal } from "@/components/ui/Reveal";
import { Card } from "@/components/ui/Card";

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
  const user = await getSessionUser();
  const { items: courses, totalCount, pageSize } = await getEnrolledCoursesPage(user!.id, page);

  if (courses.length === 0 && page === 1) {
    return (
      <Card>
        <p className="text-[14px] text-text-secondary-light">
          لا توجد دورات مسجَّل بها بعد.
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
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course, i) => (
          <Reveal key={course.id} delay={Math.min(i, 6) * 50}>
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
