import { Mail, MapPin, Clock } from "lucide-react";
import { platformEmail } from "@/lib/mail";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ContactForm } from "@/components/contact/ContactForm";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { getDictionary } from "@/lib/i18n/locale";

export default async function ContactPage() {
  const { dict } = await getDictionary();
  const t = dict.pages.contact;
  return (
    <div className="bg-bg-light py-3xl">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Badge variant="violet">{t.badge}</Badge>
          <h1 className="mt-4">{t.title}</h1>
          <p className="mt-3 text-text-secondary-light">
            {t.body}
          </p>

          <div className="mt-8 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Mail size={17} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">{t.email}</div>
                <div className="num text-[13.5px] text-text-secondary-light">{platformEmail()}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Clock size={17} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">{t.replyTime}</div>
                <div className="text-[13.5px] text-text-secondary-light">{t.replyTimeValue}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <MapPin size={17} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">{t.country}</div>
                <div className="text-[13.5px] text-text-secondary-light">{t.countryValue}</div>
              </div>
            </div>

            {/* A contact page is where people look for the accounts, so
                they belong here as well as in the footer. */}
            <div className="pt-1">
              <div className="mb-3 text-[14px] font-semibold">{t.followUs}</div>
              <SocialLinks tone="light" />
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
