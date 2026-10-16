import { MaybeStudentShell } from "@/components/dashboard/StudentShell";

/**
 * Public route, two chromes.
 *
 * A signed-out visitor gets the marketing navbar and footer from the
 * root layout — this page is still the shareable, indexable one. A
 * signed-in student gets their own sidebar instead, because the
 * marketing bar is no longer rendered for them and this page would
 * otherwise have no navigation at all.
 */
export default function AboutSectionLayout({ children }: { children: React.ReactNode }) {
  return <MaybeStudentShell>{children}</MaybeStudentShell>;
}
