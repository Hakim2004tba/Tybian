import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { sessionDetail, sessionQuestions } from "@/lib/data/qcm-sessions";
import { PersistedSession } from "@/components/qcm/PersistedSession";

export const dynamic = "force-dynamic";

export default async function RunSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) notFound();

  const { id } = await params;
  const { view } = await searchParams;

  const detail = await sessionDetail(user.id, id);
  if (!detail) notFound();

  const questions = await sessionQuestions(detail.questionIds);

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <Link
        href="/dashboard/qcm"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary-light transition hover:text-primary"
      >
        <ChevronLeft size={15} className="rtl:rotate-180" />
        QCM
      </Link>

      <div className="mt-3">
        <PersistedSession
          detail={detail}
          questions={questions}
          startOnAnalysis={view === "analysis"}
        />
      </div>
    </div>
  );
}
