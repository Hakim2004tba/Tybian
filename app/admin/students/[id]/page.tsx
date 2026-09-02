import { notFound } from "next/navigation";
import { Calendar, Phone, Activity, PlayCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PromoteToAdminButton } from "@/components/admin/PromoteToAdminButton";
import { GrantEnrollmentForm } from "@/components/admin/GrantEnrollmentForm";
import {
  getStudentDetail,
  getStudentEnrollments,
  getStudentRecentActivity,
} from "@/lib/data/admin-student-detail";
import { listCourses } from "@/lib/data/admin-courses";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
const planLabel: Record<string, string> = { three_months: "3 أشهر", lifetime: "مدى الحياة" };

const activityLabel: Record<string, string> = {
  login: "تسجيل دخول",
  lesson_view: "مشاهدة درس",
  lesson_complete: "إكمال درس",
  course_enroll: "تسجيل في دورة",
  review_submitted: "إضافة تقييم",
  comment_submitted: "إضافة تعليق",
  question_submitted: "طرح سؤال",
};

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [student, enrollments, activity, courses] = await Promise.all([
    getStudentDetail(id),
    getStudentEnrollments(id),
    getStudentRecentActivity(id),
    listCourses(),
  ]);

  if (!student) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="violet">تفاصيل الطالب</Badge>
          <h1 className="mt-3 text-2xl">{student.fullName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[13.5px] text-text-secondary-light">
            {student.academicYearName && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {student.academicYearName}
              </span>
            )}
            {student.phone && (
              <span className="flex items-center gap-1.5 num">
                <Phone size={14} /> {student.phone}
              </span>
            )}
            <span className="num text-text-muted-light">عضو منذ {dateFormatter.format(new Date(student.createdAt))}</span>
          </div>
        </div>
        <PromoteToAdminButton userId={student.id} userName={student.fullName} redirectOnSuccessTo="/admin/students" />
      </div>

      <GrantEnrollmentForm studentId={student.id} courses={courses.map((c) => ({ id: c.id, title: c.title }))} />

      <div>
        <h2 className="mb-4 text-[17px]">الدورات المشترى بها</h2>
        {enrollments.length === 0 ? (
          <Card>
            <p className="text-[13.5px] text-text-muted-light">لا توجد دورات مشترى بها بعد.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {enrollments.map((e) => {
              const pct = e.totalLessons > 0 ? Math.round((e.completedLessons / e.totalLessons) * 100) : 0;
              const isExpired = e.expiresAt && new Date(e.expiresAt) < new Date();
              return (
                <Card key={e.courseId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[15px]">{e.courseTitle}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12.5px] text-text-muted-light">
                        <Badge variant={e.planType === "lifetime" ? "gold" : "violet"}>{planLabel[e.planType] ?? e.planType}</Badge>
                        <span className="num flex items-center gap-1">
                          <Clock size={12} />
                          {e.expiresAt
                            ? isExpired
                              ? `منتهي — ${dateFormatter.format(new Date(e.expiresAt))}`
                              : `ينتهي في ${dateFormatter.format(new Date(e.expiresAt))}`
                            : "وصول دائم"}
                        </span>
                      </div>
                    </div>
                    <span className="num text-[13px] font-semibold text-primary">{pct}%</span>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border-light">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-primary to-primary-hover"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="num mt-1.5 text-[12px] text-text-muted-light">
                    {e.completedLessons} / {e.totalLessons} درس مكتمل
                  </div>

                  {e.lastLessonTitle && (
                    <div className="mt-3 flex items-center gap-2 text-[12.5px] text-text-secondary-light">
                      <PlayCircle size={13} className="text-text-muted-light" />
                      الدرس الحالي: {e.lastSectionTitle} — {e.lastLessonTitle}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-[17px]">
          <Activity size={17} />
          النشاط الأخير
        </h2>
        <Card padded={false}>
          {activity.length === 0 ? (
            <p className="p-lg text-[13.5px] text-text-muted-light">لا يوجد نشاط مسجَّل بعد.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-light">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-lg py-3">
                  <span className="text-[13.5px]">{activityLabel[a.activity_type] ?? a.activity_type}</span>
                  <span className="num text-[12px] text-text-muted-light">
                    {dateFormatter.format(new Date(a.created_at))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
