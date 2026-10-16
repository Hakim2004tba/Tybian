import { HelpCircle } from "lucide-react";
import { requireRouteAccess } from "@/lib/auth/session";
import { bankReady, listSubjects } from "@/lib/data/qcm-bank";
import { QcmImporter } from "@/components/admin/qcm/QcmImporter";
import { SubjectToggle } from "@/components/admin/qcm/SubjectToggle";
import { AddSubjectForm } from "@/components/admin/qcm/AddSubjectForm";

export const dynamic = "force-dynamic";

export default async function AdminQcmImportPage() {
  await requireRouteAccess("/admin");

  if (!(await bankReady())) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text-primary-light">QCM</h1>
        <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px]">
          شغّل <span className="num">tibyan-db/mysql/25-qcm-bank.sql</span> في phpMyAdmin أولاً.
        </p>
      </div>
    );
  }

  const subjects = await listSubjects();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-[22px] font-bold text-text-primary-light">
          <HelpCircle size={20} className="text-primary" />
          QCM
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary-light">
          ارفع ملفّات الأسئلة (JSON) لكل مادّة. المادّة تصير مفتوحة للطلبة بمجرّد
          وصول أوّل ملفّ، والمواد الفارغة تظهر لهم بشارة «قريباً».
        </p>
      </header>

      <QcmImporter />

      <section>
        <h2 className="mb-2.5 text-[15px] font-semibold text-text-primary-light">المواد</h2>

        {subjects.length === 0 ? (
          <p className="rounded-xl border border-border-light bg-white px-4 py-8 text-center text-[13.5px] text-text-secondary-light">
            لا توجد مواد بعد.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {subjects.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light bg-white p-3.5"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-text-primary-light">
                    {s.name}
                  </span>
                  <span className="num mt-0.5 block text-[12px] text-text-muted-light">
                    {s.questionCount} سؤالاً · {s.topicCount} محاور ·{" "}
                    <span className="num">{s.slug}</span>
                  </span>
                </span>
                <SubjectToggle subjectId={s.id} isActive={s.isActive} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 text-[15px] font-semibold text-text-primary-light">
          أضف مادّة «قريباً»
        </h2>
        <AddSubjectForm />
      </section>
    </div>
  );
}
