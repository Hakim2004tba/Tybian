import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { CourseCard } from "@/components/home/CourseCard";
import { getFeaturedCourses } from "@/lib/data/homepage";

/**
 * Which courses appear here is entirely admin-controlled
 * (courses.is_featured/featured_order, toggled from /admin/courses) —
 * no automatic "most popular" heuristic and no hardcoded course list.
 * If the admin hasn't featured anything yet, the section is skipped
 * entirely rather than falling back to an arbitrary/fake selection.
 */
export async function FeaturedCourses() {
  const courses = await getFeaturedCourses(6);
  if (courses.length === 0) return null;

  return (
    <section className="bg-bg-dark py-4xl">
      <Container>
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="teal">دورات مختارة</Badge>
            <h2 className="mt-4 text-text-primary-dark">دورات مختارة بعناية</h2>
          </div>
          <Link href="/courses">
            <Button variant="outline" className="border-border-dark text-text-primary-dark">
              عرض كل الدورات
            </Button>
          </Link>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <Reveal key={course.id} delay={i * 70}>
              <CourseCard course={course} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
