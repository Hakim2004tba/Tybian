import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { CourseCard } from "@/components/home/CourseCard";
import { getFeaturedCourses } from "@/lib/data/homepage";
import { getDictionary } from "@/lib/i18n/locale";
import { SectionAura } from "@/components/home/SectionAura";

/**
 * Which courses appear here is entirely admin-controlled
 * (courses.is_featured/featured_order, toggled from /admin/courses) —
 * no automatic "most popular" heuristic and no hardcoded course list.
 * If the admin hasn't featured anything yet, the section is skipped
 * entirely rather than falling back to an arbitrary/fake selection.
 */
export async function FeaturedCourses() {
  const { dict } = await getDictionary();
  const t = dict.home.featured;

  const courses = await getFeaturedCourses(6);
  if (courses.length === 0) return null;

  return (
    <section className="relative isolate overflow-hidden bg-bg-dark py-4xl">
      <SectionAura tone="dark" />
      <Container>
        <Reveal className="flex flex-col items-center gap-4 text-center md:flex-row md:flex-wrap md:items-end md:justify-between md:text-start">
          <div>
            <Badge variant="teal">{t.badge}</Badge>
            <h2 className="mt-4 text-text-primary-dark">{t.title}</h2>
          </div>
          <Link href="/courses">
            <Button variant="outline" className="border-border-dark text-text-primary-dark">
              {t.viewAll}
            </Button>
          </Link>
        </Reveal>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 md:mt-10 md:gap-6 lg:grid-cols-3">
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
