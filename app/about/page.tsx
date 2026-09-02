import { GraduationCap, Target, Heart, Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export default function AboutPage() {
  return (
    <div className="bg-bg-light">
      <section className="bg-bg-dark py-4xl">
        <Container className="text-center">
          <Badge variant="violet">من نحن</Badge>
          <h1 className="mx-auto mt-4 max-w-2xl text-text-primary-dark">
            بُنيت من داخل الكلية، لطلبة الطب
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary-dark">
            تبيان ليست منصة تعليمية عامة أُضيف إليها محتوى طبي — بل مشروع
            وُلد من تجربة طلبة الطب اليومية: صعوبة تنظيم المحاضرات، تشتت
            الملخصات، وغياب أداة واحدة تجمع كل سنة دراسية في مكان واحد.
          </p>
        </Container>
      </section>

      <section className="py-4xl">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="text-center">
              <Target size={22} className="mx-auto text-primary" />
              <h3 className="mt-3 text-[16px]">رسالتنا</h3>
              <p className="mt-2 text-[13.5px] text-text-secondary-light">
                مسار تعليمي واضح وموثوق لكل طالب طب، من أول محاضرة إلى مناقشة التخرج.
              </p>
            </Card>
            <Card className="text-center">
              <GraduationCap size={22} className="mx-auto text-primary" />
              <h3 className="mt-3 text-[16px]">محتوى موثّق</h3>
              <p className="mt-2 text-[13.5px] text-text-secondary-light">
                كل درس يُراجَع من طرف أساتذة مختصين قبل النشر، لضمان دقة المعلومة الطبية.
              </p>
            </Card>
            <Card className="text-center">
              <Heart size={22} className="mx-auto text-primary" />
              <h3 className="mt-3 text-[16px]">مصمَّمة لك</h3>
              <p className="mt-2 text-[13.5px] text-text-secondary-light">
                واجهة عربية بالكامل، تحترم وقتك ومجهودك كطالب طب مثقل بالمقررات.
              </p>
            </Card>
            <Card className="text-center">
              <Users size={22} className="mx-auto text-primary" />
              <h3 className="mt-3 text-[16px]">مجتمع تعليمي</h3>
              <p className="mt-2 text-[13.5px] text-text-secondary-light">
                نقاش مباشر مع الأساتذة وزملائك تحت كل درس، وليس مجرد فيديوهات معزولة.
              </p>
            </Card>
          </div>

          <Card className="mt-10 max-w-3xl mx-auto text-center">
            <p className="text-[14.5px] leading-relaxed text-text-secondary-light">
              هدفنا بسيط: أن يجد كل طالب طب، من السنة الأولى إلى السابعة،
              مساراً تعليمياً واضحاً وموثوقاً، بمحتوى يراجعه أساتذة مختصون،
              وبتجربة تحترم وقته ومجهوده.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <div className="num text-2xl font-bold text-primary">2025</div>
                <div className="mt-1 text-[13px] text-text-muted-light">سنة الانطلاق</div>
              </div>
              <div>
                <div className="num text-2xl font-bold text-primary">7</div>
                <div className="mt-1 text-[13px] text-text-muted-light">سنوات دراسية مغطاة بالكامل</div>
              </div>
            </div>
          </Card>
        </Container>
      </section>
    </div>
  );
}
