import { Bell, ListChecks, LayoutDashboard, Library, MessageSquare, BookOpen, Radio, Target, TrendingUp, User, Newspaper, LifeBuoy, FileText } from "lucide-react";

/**
 * One nav list, imported by both the desktop sidebar (a server
 * component) and the mobile drawer inside StudentTopbar (a client
 * component). Kept in its own module with no "use client"/"server-only"
 * marking so either side can import it without dragging the other's
 * runtime along — and so the two navigations can never drift apart.
 *
 * Every entry is a REAL ROUTE. The earlier version pointed several
 * items at in-page anchors (/dashboard#progress), which meant the nav
 * could not show where you were and the browser back button did
 * nothing useful. Certificates and support were removed rather than
 * left linking to pages that do not exist — notifications came back
 * once /dashboard/notifications existed to point at.
 */
export type StudentNavKey =
  | "home"
  | "explore"
  | "myCourses"
  | "meetings"
  | "qcmBank"
  | "studyTracking"
  | "progress"
  | "notifications"
  | "messages"
  | "profile"
  | "lessons"
  | "articles"
  | "contact";

export const STUDENT_NAV: {
  href: string;
  key: StudentNavKey;
  icon: typeof LayoutDashboard;
}[] = [
  /* The label is a dictionary key, not the words themselves — the
     sidebar reads it through dict.dash.nav so both languages share one
     list of destinations. */
  { href: "/dashboard", key: "home", icon: LayoutDashboard },
  { href: "/dashboard/explore", key: "explore", icon: Library },
  { href: "/dashboard/courses", key: "myCourses", icon: BookOpen },
  /*
    The university's own material, sitting between the platform's
    courses and the live sessions — it is study, not a support page,
    so it belongs among the destinations a student opens daily.
  */
  { href: "/dashboard/lessons", key: "lessons", icon: FileText },
  { href: "/dashboard/meetings", key: "meetings", icon: Radio },
  /* ListChecks, not HelpCircle: a question mark is what you show
     for help and support, and it sat two rows from the real support
     link. A list with ticks is literally what a QCM is. */
  { href: "/dashboard/qcm", key: "qcmBank", icon: ListChecks },
  { href: "/dashboard/study", key: "studyTracking", icon: Target },
  { href: "/dashboard/progress", key: "progress", icon: TrendingUp },
  { href: "/dashboard/notifications", key: "notifications", icon: Bell },
  /*
    Conversations — with a teacher about a course, and with the
    platform. Reachable on its own now: it started as a quiet corner
    for teacher questions, but an admin writing to a student is
    something they must be able to answer without hunting for the
    notification that announced it.
  */
  { href: "/dashboard/messages", key: "messages", icon: MessageSquare },
  { href: "/dashboard/profile", key: "profile", icon: User },
  /*
    Articles and Contact live on the public site, but a signed-in
    student no longer sees the marketing navbar anywhere — so without
    these two entries those pages became unreachable without signing
    out. They are listed last, after the study destinations, because
    they are the least frequent of the seven.
  */
  { href: "/articles", key: "articles", icon: Newspaper },
  { href: "/contact", key: "contact", icon: LifeBuoy },
] as const;
