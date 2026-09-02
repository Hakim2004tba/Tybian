// TIBYAN — primary navigation config.
// Edit this array to add/remove/reorder nav items across the whole app
// (desktop navbar + mobile nav share this single source of truth).

export type NavItem = {
  label: string;
  href: string;
};

export const primaryNav: NavItem[] = [
  { label: "الرئيسية", href: "/" },
  { label: "الدورات", href: "/courses" },
  { label: "من نحن", href: "/about" },
  { label: "المقالات", href: "/articles" },
  { label: "تواصل معنا", href: "/contact" },
];

// Right-side actions (search, auth, CTA) are handled separately in
// <Navbar /> since they carry logic (auth state) rather than plain links —
// but their labels are still centralized here for easy copy edits.
export const navActions = {
  search: "بحث",
  login: "تسجيل الدخول",
  account: "حسابي",
  register: "سجل الآن",
};
