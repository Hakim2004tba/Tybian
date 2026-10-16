import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { threadFor } from "@/lib/data/teacher-inbox";
import { markThreadReadAction } from "@/lib/actions/teacher-inbox";
import { ThreadView } from "@/components/inbox/ThreadView";

export const dynamic = "force-dynamic";

export default async function TeacherThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const data = await threadFor(id, user.id);
  if (!data) notFound();

  await markThreadReadAction(id, true);

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <Link
        href="/teacher/questions"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary-light hover:text-primary"
      >
        <ChevronLeft size={15} className="rtl:rotate-180" />
        الأسئلة
      </Link>

      <h1 className="mt-3 text-[19px] font-bold text-text-primary-light">{data.thread.subject}</h1>
      <p className="mt-0.5 text-[12.5px] text-text-muted-light">
        {data.thread.courseTitle} · {data.thread.withName}
      </p>

      <div className="mt-5 max-w-2xl">
        <ThreadView
          threadId={id}
          messages={data.messages}
          status={data.thread.status}
        />
      </div>
    </div>
  );
}
