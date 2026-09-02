import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";
import { getSessionUser } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "تبيان | TIBYAN — منصة التعليم الطبي",
  description:
    "منصة تعليم طبي عربية موجهة لطلبة الطب من السنة الأولى إلى السنة السابعة.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const { locale, dict } = await getDictionary();
  const isRtl = locale === "ar";

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      className={`${plexArabic.variable} ${inter.variable}`}
    >
      <body className={`flex min-h-screen flex-col ${isRtl ? "font-arabic" : "font-latin"}`}>
        <Navbar isAuthenticated={!!user} role={user?.role ?? null} locale={locale} dict={dict} />
        <main className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer locale={locale} dict={dict} />
      </body>
    </html>
  );
}
