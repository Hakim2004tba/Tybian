import { Mail, MapPin, Clock } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ContactForm } from "@/components/contact/ContactForm";

export default function ContactPage() {
  return (
    <div className="bg-bg-light py-3xl">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Badge variant="violet">تواصل معنا</Badge>
          <h1 className="mt-4">نحن هنا لمساعدتك</h1>
          <p className="mt-3 text-text-secondary-light">
            لديك سؤال حول دورة، مشكلة تقنية، أو اقتراح لتطوير المنصة؟
            راسلنا وسنرد عليك في أقرب وقت ممكن.
          </p>

          <div className="mt-8 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Mail size={17} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">البريد الإلكتروني</div>
                <div className="num text-[13.5px] text-text-secondary-light">support@tibyan.dz</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Clock size={17} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">وقت الرد</div>
                <div className="text-[13.5px] text-text-secondary-light">عادة خلال 24-48 ساعة</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <MapPin size={17} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">الجزائر</div>
                <div className="text-[13.5px] text-text-secondary-light">منصة تعليمية عبر الإنترنت بالكامل</div>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <ContactForm />
        </Card>
      </Container>
    </div>
  );
}
