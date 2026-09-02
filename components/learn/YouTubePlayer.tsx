/**
 * IMPORTANT HONEST SCOPE NOTE: unlike VideoPlayer.tsx (Bunny), this
 * does NOT attempt automatic watch-progress tracking. YouTube's iframe
 * uses its own IFrame Player API with a completely different
 * postMessage schema than Bunny's — reusing VideoPlayer's Bunny-specific
 * listener here would silently do nothing (or worse, misparse
 * unrelated YouTube messages) rather than genuinely track progress.
 * Rather than fake it, this is a plain embed: the student's position
 * simply isn't auto-saved for YouTube-sourced lessons, and completion
 * relies on the same manual "تحديد كمكتمل" button already built
 * (components/learn/MarkCompleteButton.tsx) — a real, working fallback,
 * not a missing feature. If genuine auto-tracking for YouTube is wanted
 * later, it needs the youtube-iframe-api script + its documented
 * onStateChange events, implemented and tested against the real API.
 */
export function YouTubePlayer({ playbackUrl }: { playbackUrl: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
      <div className="aspect-video w-full">
        <iframe
          src={playbackUrl}
          title="مشغل الفيديو"
          loading="eager"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
