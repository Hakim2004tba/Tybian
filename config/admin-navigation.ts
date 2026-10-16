// TIBYAN — admin sidebar navigation config.
// Edit this array to add/remove/reorder sidebar sections. Both the
// desktop sidebar and the mobile drawer read from here.

import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  LayoutDashboard,
  BarChart3,
  Users,
  GraduationCap,
  CalendarRange,
  BookOpen,
  ListVideo,
  HelpCircle,
  Ticket,
  Layers,
  Target,
  Library,
  Video,
  Radio,
  Tag,
  ClipboardCheck,
  CreditCard,
  Star,
  MessageSquare,
  Bell,
  Settings,
  FileText,
  Mail,
  UploadCloud,
  TrendingUp,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const adminNav: AdminNavItem[] = [
  { label: "لوحة التحكم", href: "/admin", icon: LayoutDashboard },
  { label: "التحليلات", href: "/admin/analytics", icon: BarChart3 },
  { label: "الطلاب", href: "/admin/students", icon: Users },
  { label: "الأساتذة", href: "/admin/teachers", icon: GraduationCap },
  { label: "المديرون", href: "/admin/admins", icon: ShieldCheck },
  { label: "السنوات الدراسية", href: "/admin/academic-years", icon: CalendarRange },
  { label: "اللقاءات المباشرة", href: "/admin/meetings", icon: Radio },
  { label: "محادثات الطلبة", href: "/admin/chats", icon: MessageSquare },
  { label: "الرسائل الجماعية", href: "/admin/campaigns", icon: Mail },
  { label: "الدخل لكل دورة", href: "/admin/revenue", icon: TrendingUp },
  { label: "الدورات", href: "/admin/courses", icon: BookOpen },
  { label: "الدروس", href: "/admin/lessons", icon: ListVideo },
  { label: "أسئلة QCM", href: "/admin/qcm", icon: HelpCircle },
  { label: "رفع أسئلة QCM", href: "/admin/qcm-import", icon: UploadCloud },
  /* Named "دروس الجامعة", not "الدروس": /admin/lessons above already
     carries that label for a COURSE's lessons, and two identical
     entries in one sidebar is a click people get wrong every time. */
  { label: "دروس الجامعة", href: "/admin/library", icon: Library },
  { label: "رموز الخصم", href: "/admin/promo", icon: Ticket },
  { label: "الباقات", href: "/admin/packs", icon: Layers },
  { label: "تتبّع الدراسة", href: "/admin/study-tracking", icon: Target },
  { label: "الفيديوهات", href: "/admin/videos", icon: Video },
  { label: "المقالات", href: "/admin/articles", icon: FileText },
  { label: "رسائل التواصل", href: "/admin/messages", icon: Mail },
  { label: "التسعير", href: "/admin/pricing", icon: Tag },
  { label: "التسجيلات", href: "/admin/enrollments", icon: ClipboardCheck },
  { label: "المدفوعات", href: "/admin/payments", icon: CreditCard },
  { label: "التقييمات", href: "/admin/reviews", icon: Star },
  { label: "التعليقات", href: "/admin/comments", icon: MessageSquare },
  { label: "الإشعارات", href: "/admin/notifications", icon: Bell },
  { label: "الإعدادات", href: "/admin/settings", icon: Settings },
];
