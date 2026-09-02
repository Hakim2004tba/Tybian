// TIBYAN — admin sidebar navigation config.
// Edit this array to add/remove/reorder sidebar sections. Both the
// desktop sidebar and the mobile drawer read from here.

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  GraduationCap,
  CalendarRange,
  BookOpen,
  ListVideo,
  Video,
  Tag,
  ClipboardCheck,
  CreditCard,
  Star,
  MessageSquare,
  Bell,
  Settings,
  FileText,
  Mail,
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
  { label: "السنوات الدراسية", href: "/admin/academic-years", icon: CalendarRange },
  { label: "الدورات", href: "/admin/courses", icon: BookOpen },
  { label: "الدروس", href: "/admin/lessons", icon: ListVideo },
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
