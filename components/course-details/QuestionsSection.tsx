import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { CourseQuestion } from "@/lib/data/course-reviews";
import { getDictionary } from "@/lib/i18n/locale";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit" });

export async function QuestionsSection({ questions }: { questions: CourseQuestion[] }) {
  const { dict } = await getDictionary();
  const t = dict.courseDetails;
  return (
    <Card>
      <h3 className="text-[17px]">{t.questions}</h3>

      {questions.length === 0 ? (
        <p className="mt-3 text-[13.5px] text-text-muted-light">{t.questionsEmpty}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {questions.map((q) => (
            <div key={q.id} className="flex gap-3">
              <MessageCircle size={16} className="mt-0.5 shrink-0 text-text-muted-light" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-text-muted-light">
                  <span className="font-medium text-text-primary-light">{q.profiles?.full_name ?? t.student}</span>
                  {q.lessons?.title && <span>{t.on} {q.lessons.title}</span>}
                  <span className="num">· {dateFormatter.format(new Date(q.created_at))}</span>
                </div>
                <p className="mt-1.5 text-[14px] text-text-secondary-light">{q.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
