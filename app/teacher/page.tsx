import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function TeacherHomePage() {
  const user = await getSessionUser();

  return (
    <div className="bg-bg-light py-3xl">
      <Container>
        <Badge variant="violet">مساحة الأستاذ</Badge>
        <h1 className="mt-3">مرحباً بك</h1>
        <p className="mt-2 text-text-secondary-light">
          الدور الحالي: <b>{user?.role}</b> — هذه لوحة مؤقتة تثبت أن حماية
          مسار /teacher تعمل بشكل صحيح لكل من الأستاذ والمشرف، وتُرفض على
          الطالب.
        </p>
        <Card className="mt-6 max-w-md">
          <p className="text-sm text-text-secondary-light">
            إدارة الدورات الفعلية (إنشاء/تعديل دروس، رفع فيديو) ستُبنى في
            مرحلة لاحقة — انظر <code>/teacher/courses</code> للمعاينة
            الحالية.
          </p>
        </Card>
      </Container>
    </div>
  );
}
