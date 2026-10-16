import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { bankReady, subjectBySlug, topicBySlug, topicQuestions } from "@/lib/data/qcm-bank";
import { QcmSession } from "@/components/qcm/QcmSession";

export const dynamic = "force-dynamic";

export default async function TopicPracticePage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>;
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params;
  if (!(await bankReady())) notFound();

  const subject = await subjectBySlug(subjectSlug);
  if (!subject || Number(subject.is_active) !== 1) notFound();

  const topic = await topicBySlug(subject.id, topicSlug);
  if (!topic) notFound();

  const questions = await topicQuestions(topic.id);

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <Link
        href={`/dashboard/qcm/${subjectSlug}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary-light hover:text-primary"
      >
        <ChevronLeft size={15} className="rtl:rotate-180" />
        {subject.name}
      </Link>

      <div className="mt-3">
      <QcmSession
        questions={questions}
        topicTitle={topic.title}
        subjectHref={`/dashboard/qcm/${subjectSlug}`}
      />
      </div>
    </div>
  );
}
