import { Clock } from "lucide-react";

/**
 * Rendered when resolvePlayback() fails for reason "no_video" or
 * "video_not_ready" — the student IS authorized (enrolled, or this is
 * a free-preview lesson), the video simply isn't attached/ready yet.
 * Deliberately distinct from LockedLessonState: no lock icon, no
 * "اشترك الآن" CTA — showing a subscription prompt here would be
 * actively misleading for someone who already has access.
 */
export function VideoNotReadyState({ message }: { message: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-bg-dark text-center shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Clock size={22} className="text-text-muted-dark" />
      </div>
      <p className="text-[14px] text-text-secondary-dark">{message}</p>
    </div>
  );
}
