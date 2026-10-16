import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * Rendered INSTEAD OF any video element/iframe whenever
 * resolvePlayback() returns not-ok — there is no src, no iframe, no
 * player markup anywhere in this component. The video is never fetched
 * or loaded client-side for an unauthorized lesson; this is the visual
 * expression of "لا يتم تحميل الفيديو إلا عندما يكون المستخدم مصرحاً له".
 */
export async function LockedLessonState({ message, courseSlug }: { message: string; courseSlug: string }) {
  const { dict } = await getDictionary();
  const t = dict.learn;
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-bg-dark text-center shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
        <Lock size={24} className="text-text-muted-dark" />
      </div>
      <div>
        <p className="text-[15px] text-text-primary-dark">{message}</p>
        <p className="mt-1 text-[13px] text-text-muted-dark">{t.subscribeToWatch}</p>
      </div>
      <Link href={`/courses/${courseSlug}`}>
        <Button variant="gold" size="sm">
          {t.viewPlans}
        </Button>
      </Link>
    </div>
  );
}
