import { Hero } from "@/components/home/Hero";
import { AcademicYears } from "@/components/home/AcademicYears";
import { FeaturedCourses } from "@/components/home/FeaturedCourses";
import { PlatformShowcase } from "@/components/home/PlatformShowcase";
import { PlatformMockup } from "@/components/home/PlatformMockup";
import { AboutTibyan } from "@/components/home/AboutTibyan";
import { Testimonials } from "@/components/home/Testimonials";
import { CTASection } from "@/components/home/CTASection";
import { getDictionary } from "@/lib/i18n/locale";
import { getHomepageStats } from "@/lib/data/homepage";
import { getSessionUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/route-access";
import { redirect } from "next/navigation";
import { IntroSection } from "@/components/home/IntroSection";

/**
 * Statistics.tsx and Partners.tsx were removed from the homepage
 * entirely (not just unused — deleted) rather than left wired in with
 * fabricated numbers/institution names. Statistics duplicated the real
 * stats now in Hero's own panel; Partners claimed unconfirmed
 * partnerships with real, named universities, which isn't something to
 * keep "mostly honest" — either a real partnership exists and can be
 * listed truthfully, or the section doesn't belong on the page yet.
 */
export default async function Home() {
  /*
    A SIGNED-IN PERSON NEVER GETS THE MARKETING HOMEPAGE.

    It used to be students only, so a teacher or an admin returning to
    the site — which on a phone is every time the app is reopened from
    the home screen — landed on the sign-up page for a platform they
    already run, and had to navigate back into their own account by
    hand. Each role now goes to its own area.

    This is the one page the student shell could not cover. The shell is
    applied per section (/courses, /articles, /contact ...), and "/" is
    not a section; it IS the marketing page, the thing a student is no
    longer meant to land on. Wrapping it in the rail would have produced
    a student sidebar next to "Explore Courses" and "Start Learning" —
    two calls to action aimed at someone who already signed up.

    Without this, hiding the navbar left "/" with no navigation at all,
    which is exactly what it looked like.
  */
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user.role));

  const { locale, dict } = await getDictionary();
  const stats = await getHomepageStats();

  return (
    <>
      <Hero locale={locale} dict={dict} stats={stats} />
      <IntroSection />
      <AcademicYears />
      <FeaturedCourses />
      <PlatformMockup />
      <PlatformShowcase />
      <AboutTibyan />
      <Testimonials />
      <CTASection />
    </>
  );
}
