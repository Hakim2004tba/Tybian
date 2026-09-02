import { ShieldCheck, Brain, Video, LineChart, MessagesSquare, Smartphone } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";

const features = [
  { icon: Video, title: "فيديو محمي عالي الجودة", desc: "محاضرات مصوّرة بجودة عالية، محمية بروابط موقّتة تمنع أي مشاركة غير مصرّح بها." },
  { icon: LineChart, title: "تتبع دقيق للتقدم", desc: "استئناف المشاهدة من حيث توقفت، مع إحصائيات واضحة لكل مقياس ودورة." },
  { icon: ShieldCheck, title: "محتوى موثّق", desc: "كل درس يُراجَع من طرف أساتذة مختصين قبل النشر، لضمان دقة المعلومة الطبية." },
  { icon: MessagesSquare, title: "أسئلة ونقاش مباشر", desc: "اطرح أسئلتك تحت كل درس، وتفاعل مع الأستاذ وزملائك في نفس المقياس." },
  { icon: Brain, title: "مراجعة متباعدة ذكية", desc: "كل درس تُكمله يدخل تلقائياً في نظام مراجعة يذكّرك به في الوقت المناسب قبل أن تنساه." },
  { icon: Smartphone, title: "متاحة على كل الأجهزة", desc: "تجربة متكاملة على الحاسوب والهاتف، بدون فقدان تقدمك أبداً." },
];

export function PlatformFeatures() {
  return (
    <section className="bg-bg-light py-4xl">
      <Container>
        <Reveal className="text-center">
          <Badge variant="violet">لماذا تبيان</Badge>
          <h2 className="mx-auto mt-4 max-w-lg">منصة صُممت خصيصاً لاحتياجات طالب الطب</h2>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <Card className="h-full">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10">
                  <f.icon size={20} className="text-primary" strokeWidth={1.6} />
                </div>
                <h3 className="mt-4 text-[17px]">{f.title}</h3>
                <p className="mt-2 text-[14px] text-text-secondary-light">{f.desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
