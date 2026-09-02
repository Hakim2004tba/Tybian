export type Locale = "ar" | "en";
export const LOCALES: Locale[] = ["ar", "en"];
export const DEFAULT_LOCALE: Locale = "ar";

/**
 * Deliberately a plain nested object (not next-intl or any i18n
 * library) — the site's 40+ existing routes were all built directly
 * under `app/`, not `app/[locale]/`, and restructuring every route into
 * a locale-prefixed tree at this stage would be a large, high-risk
 * change to make in one pass across an app this size. This cookie-based
 * approach (see lib/i18n/locale.ts) delivers real bilingual UI —
 * language switching, RTL/LTR, translated content — without touching
 * the URL structure or risking every existing page/link.
 *
 * Coverage as of this pass: navbar, footer, homepage hero, and the auth
 * pages (login/register/forgot-password). This is a genuine slice, not
 * the whole site — extending it to more pages means adding keys here
 * and swapping hardcoded strings for `dict.section.key` in those pages,
 * following the exact same pattern already used in the covered pages.
 */
export const dictionaries = {
  ar: {
    nav: {
      home: "الرئيسية",
      courses: "الدورات",
      about: "من نحن",
      articles: "المقالات",
      contact: "تواصل معنا",
      search: "بحث",
      login: "تسجيل الدخول",
      account: "حسابي",
      register: "سجل الآن",
    },
    footer: {
      tagline: "منصة تعليم طبي عربية موجهة لطلبة الطب من السنة الأولى إلى السابعة.",
      quickLinks: "روابط سريعة",
      legal: "قانوني",
      privacy: "سياسة الخصوصية",
      terms: "شروط الاستخدام",
      rights: "جميع الحقوق محفوظة",
    },
    hero: {
      title: "معرفة تُضيء دربك الطبي",
      subtitle: "منصة تعليم طبي شاملة لطلبة الطب الجزائريين، من أول محاضرة تشريح إلى مناقشة التخرج.",
      cta: "ابدأ التعلم",
      secondaryCta: "استكشف الدورات",
    },
    auth: {
      loginTitle: "مرحباً بعودتك",
      loginSubtitle: "سجّل الدخول لمتابعة رحلتك في تبيان",
      registerTitle: "أنشئ حسابك",
      registerSubtitle: "انضم إلى آلاف طلبة الطب في تبيان",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      fullName: "الاسم الكامل",
      academicYear: "السنة الدراسية",
      forgotPassword: "نسيت كلمة المرور؟",
      loginButton: "دخول إلى المنصة",
      registerButton: "إنشاء الحساب",
      noAccount: "ليس لديك حساب؟",
      createAccount: "أنشئ حساباً",
      haveAccount: "لديك حساب بالفعل؟",
    },
  },
  en: {
    nav: {
      home: "Home",
      courses: "Courses",
      about: "About",
      articles: "Articles",
      contact: "Contact",
      search: "Search",
      login: "Log In",
      account: "My Account",
      register: "Sign Up",
    },
    footer: {
      tagline: "An Arabic medical education platform for Algerian medical students, from year 1 to year 7.",
      quickLinks: "Quick Links",
      legal: "Legal",
      privacy: "Privacy Policy",
      terms: "Terms of Use",
      rights: "All rights reserved",
    },
    hero: {
      title: "Knowledge that lights your medical path",
      subtitle: "A complete medical education platform for Algerian medical students — from your first anatomy lecture to your graduation defense.",
      cta: "Start Learning",
      secondaryCta: "Explore Courses",
    },
    auth: {
      loginTitle: "Welcome back",
      loginSubtitle: "Log in to continue your journey on TIBYAN",
      registerTitle: "Create your account",
      registerSubtitle: "Join thousands of medical students on TIBYAN",
      email: "Email address",
      password: "Password",
      fullName: "Full name",
      academicYear: "Academic year",
      forgotPassword: "Forgot your password?",
      loginButton: "Log in",
      registerButton: "Create account",
      noAccount: "Don't have an account?",
      createAccount: "Create one",
      haveAccount: "Already have an account?",
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];
