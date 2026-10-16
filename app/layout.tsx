import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";
import { getSessionUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";
import { getTheme } from "@/lib/theme/theme";
import { ThemeScript } from "@/components/layout/ThemeScript";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import "./globals.css";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { SketchLauncher } from "@/components/sketch/SketchLauncher";
import { ChromeVisibility } from "@/components/layout/ChromeVisibility";

// Arabic-first type system — see DESIGN_SYSTEM.md §4.
// Plex Arabic drives all UI/content; Inter is reserved for numerals/stats
// via the `.num` utility class, never for Arabic text.
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Metadata follows the reader's language too.
 *
 * A static `metadata` object is evaluated once, so the English visitor
 * was getting an Arabic <title> and description in the browser tab, in
 * search results and in every link preview — the one part of the page
 * that translating the components could never reach.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDictionary();
  return { title: dict.meta.title, description: dict.meta.description };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const { locale, dict } = await getDictionary();
  const isRtl = locale === "ar";
  const theme = await getTheme();

  /*
    A signed-in student never sees the marketing navbar or footer —
    not on the dashboard, not on a course, not on an article.

    Those bars are the public face of the site: "من نحن", "الدورات",
    "تسجيل الدخول". Once somebody is studying, they are a way back OUT
    of the product, and they stack a second navigation on top of the
    student rail on every page that has one. Leaving the platform is
    signing out, and that lives in the rail.

    Their replacement is StudentShell, applied by each section's own
    layout — see components/dashboard/StudentShell.tsx. Teachers and
    admins keep the public chrome outside their own areas, because they
    do move between the two.
  */
  const isStudent = user?.role === "student";

  /*
    THE SECTIONS THAT RENDER A SHELL OF THEIR OWN.

    A signed-in teacher or admin keeps the public chrome as they move
    around the site, but not on a page that already draws the platform
    rail — that stacked a marketing navbar on top of the sidebar, with
    "Sign out" appearing twice and the page scrolled down by a bar the
    student rail already replaces. /articles and /contact joined that
    list when they started keeping every signed-in role inside the
    platform (see SignedInShell), and this list is what kept it from
    following them.
  */
  /*
    /courses is here too now. It is still the public, shareable
    catalogue for a visitor — SignedInShell gives a guest the plain
    page — but a signed-in person browsing it was being dropped back
    into the marketing layout mid-session, which on a phone looks like
    leaving the platform entirely.
  */
  const shellRoutes = ["/dashboard", "/admin", "/articles", "/contact", "/courses"];
  const hideChromeOn = user ? shellRoutes : ["/dashboard", "/admin"];


  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      /*
        An explicit choice is on the element from the server, so a dark
        reader never sees a light first paint. "system" carries no class
        here — only the browser knows what it resolves to — and
        ThemeScript settles it synchronously below.
      */
      className={`${plexArabic.variable} ${inter.variable}${theme === "dark" ? " dark" : ""}`}
    >
      <body className={`flex min-h-screen flex-col bg-bg-light ${isRtl ? "font-arabic" : "font-latin"}`}>
        <ThemeScript theme={theme} />
        {/* Every client component below can now ask what language to
            speak — see lib/i18n/I18nProvider.tsx. */}
        <I18nProvider locale={locale}>
        {/* /dashboard and /admin render their own sidebar + topbar, so
            the marketing chrome is suppressed there rather than stacked
            on top of it. The check runs on the client so it follows
            client-side navigation instead of freezing on first load. */}
        {!isStudent && (
          <ChromeVisibility hideOn={hideChromeOn}>
            <Navbar isAuthenticated={!!user} role={user?.role ?? null} locale={locale} dict={dict} />
          </ChromeVisibility>
        )}
        <main className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
        {!isStudent && (
          <ChromeVisibility hideOn={hideChromeOn}>
            <Footer locale={locale} dict={dict} />
          </ChromeVisibility>
        )}

        {/* Study tools follow the student through the app they study in
            — the dashboard and the course pages — and nowhere else. An
            anonymous visitor cannot reach either backend, and a floating
            assistant over the marketing homepage is noise rather than a
            feature. */}
        {user && (
          <ChromeVisibility showOn={["/dashboard", "/courses/"]}>
            <SketchLauncher />
            <AiAssistant />
          </ChromeVisibility>
        )}
        </I18nProvider>
      </body>
    </html>
  );
}
