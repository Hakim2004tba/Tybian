import { Hero } from "@/components/home/Hero";
import { AcademicYears } from "@/components/home/AcademicYears";
import { FeaturedCourses } from "@/components/home/FeaturedCourses";
import { PlatformFeatures } from "@/components/home/PlatformFeatures";
import { AboutTibyan } from "@/components/home/AboutTibyan";
import { Testimonials } from "@/components/home/Testimonials";
import { CTASection } from "@/components/home/CTASection";
import { getDictionary } from "@/lib/i18n/locale";
import { getHomepageStats } from "@/lib/data/homepage";

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
  const { locale, dict } = await getDictionary();
  const stats = await getHomepageStats();

  return (
    <>
      <Hero locale={locale} dict={dict} stats={stats} />
      <AcademicYears />
      <FeaturedCourses />
      <PlatformFeatures />
      <AboutTibyan />
      <Testimonials />
      <CTASection />
    </>
  );
}
