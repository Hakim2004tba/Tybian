// TIBYAN — teacher sidebar navigation.
// Mirrors config/admin-navigation.ts, but the label is a dictionary KEY
// rather than a word, so the teacher space reads in both languages.

import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, BookOpen, Users, MessageSquare, HelpCircle, Radio, Star, Paperclip } from "lucide-react";

export type TeacherNavKey =
  | "home" | "courses" | "students" | "questions" | "qcm" | "resources" | "meetings" | "reviews";

export const teacherNav: { key: TeacherNavKey; href: string; icon: LucideIcon }[] = [
  { key: "home", href: "/teacher", icon: LayoutDashboard },
  { key: "courses", href: "/teacher/courses", icon: BookOpen },
  { key: "students", href: "/teacher/students", icon: Users },
  { key: "questions", href: "/teacher/questions", icon: MessageSquare },
  { key: "qcm", href: "/teacher/qcm", icon: HelpCircle },
  { key: "resources", href: "/teacher/resources", icon: Paperclip },
  { key: "meetings", href: "/teacher/meetings", icon: Radio },
  { key: "reviews", href: "/teacher/reviews", icon: Star },
];
