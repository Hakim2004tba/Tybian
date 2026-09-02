import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/ui/Reveal";

export function AboutTibyan() {
  return (
    <section className="bg-bg-light py-4xl">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal className="relative overflow-hidden rounded-xl border border-border-light">
          <Image
            src="/courses/neuro.svg"
            alt="رسم علمي يمثل الجهاز العصبي"
            width={600}
            height={400}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </Reveal>

        <Reveal delay={100}>
          <Badge variant="violet">من نحن</Badge>
          <h2 className="mt-4">بُنيت من داخل الكلية، لطلبة الطب</h2>
          <p className="mt-4 text-text-secondary-light leading-relaxed">
            تبيان ليست منصة تعليمية عامة أُضيف إليها محتوى طبي — بل مشروع
            وُلد من تجربة طلبة الطب اليومية: صعوبة تنظيم المحاضرات، تشتت
            الملخصات، وغياب أداة واحدة تجمع كل سنة دراسية في مكان واحد.
          </p>
          <p className="mt-4 text-text-secondary-light leading-relaxed">
            هدفنا بسيط: أن يجد كل طالب طب، من السنة الأولى إلى السابعة،
            مساراً تعليمياً واضحاً وموثوقاً، بمحتوى يراجعه أساتذة مختصون،
            وبتجربة تحترم وقته ومجهوده.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <div>
              <div className="num text-2xl font-bold text-primary">2025</div>
              <div className="mt-1 text-[13px] text-text-muted-light">سنة الانطلاق</div>
            </div>
            <div>
              <div className="num text-2xl font-bold text-primary">7</div>
              <div className="mt-1 text-[13px] text-text-muted-light">سنوات دراسية مغطاة بالكامل</div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
