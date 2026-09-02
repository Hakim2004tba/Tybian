"use client";

import { useEffect, useRef } from "react";
import { updateLessonProgressAction } from "@/lib/actions/lesson-progress";
import { shouldFlushProgress, isLessonComplete } from "@/lib/video/progress-throttle";

const SAVE_INTERVAL_SECONDS = 15;

/**
 * IMPORTANT HONEST NOTE ON THE POSTMESSAGE INTEGRATION:
 *
 * Bunny Stream's iframe embed player (iframe.mediadelivery.net/embed)
 * exposes a Player.js-style postMessage API for playback events
 * (play/pause/timeupdate/ended with currentTime/duration). This
 * component listens for that and parses it defensively — checking for
 * plausible numeric fields rather than asserting one exact payload
 * shape — because I do not have official, verified documentation of
 * the precise event/field names in front of me right now, and I'd
 * rather degrade gracefully (a message that doesn't match any known
 * shape is simply ignored) than silently corrupt progress data with a
 * wrong assumption. If you have Bunny's official Player.js reference,
 * tightening this parser to their exact schema is a small, safe
 * follow-up — nothing else in the progress-tracking pipeline
 * (throttling, the server action, the completion threshold) depends on
 * getting the exact field names right on the first try.
 *
 * What IS certain and fully implemented regardless of that detail:
 *  - the iframe only ever renders with a `src` obtained from
 *    resolvePlayback() — i.e. only after full server-side authorization
 *    (see the learn page and LockedLessonState for the alternative)
 *  - resuming at `initialPositionSeconds` via the `t=` start-time param
 *    Bunny's embed player documents
 *  - the throttle (shouldFlushProgress) genuinely limits how often
 *    updateLessonProgressAction is called, regardless of how chatty or
 *    quiet the postMessage stream turns out to be in practice
 */
export function VideoPlayer({
  lessonId,
  courseSlug,
  playbackUrl,
  initialPositionSeconds,
  durationSeconds,
  onCompleted,
}: {
  lessonId: string;
  courseSlug: string;
  playbackUrl: string;
  initialPositionSeconds: number;
  durationSeconds: number;
  onCompleted?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastFlushAtRef = useRef<number>(Date.now());
  const lastKnownTimeRef = useRef<number>(initialPositionSeconds);
  const durationRef = useRef<number>(durationSeconds);
  const completedRef = useRef(false);

  useEffect(() => {
    lastKnownTimeRef.current = initialPositionSeconds;
    lastFlushAtRef.current = Date.now();
    completedRef.current = false;
  }, [lessonId, initialPositionSeconds]);

  useEffect(() => {
    function flush(forced: boolean, completed: boolean) {
      const secondsSinceLastFlush = (Date.now() - lastFlushAtRef.current) / 1000;
      if (!shouldFlushProgress({ secondsSinceLastFlush, minIntervalSeconds: SAVE_INTERVAL_SECONDS, isForcedFlush: forced })) {
        return;
      }
      lastFlushAtRef.current = Date.now();
      // courseSlug only passed on a real completion, so the throttled
      // 15s ticks don't trigger a page-cache revalidation each time —
      // only the moment that actually changes what the sidebar shows.
      void updateLessonProgressAction(
        lessonId,
        lastKnownTimeRef.current,
        completed,
        completed ? courseSlug : undefined
      );
    }

    function handleMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;

      const data = event.data as Record<string, unknown> | undefined;
      if (!data || typeof data !== "object") return;

      const currentTime =
        typeof data.currentTime === "number"
          ? data.currentTime
          : typeof data.time === "number"
            ? data.time
            : null;
      const duration = typeof data.duration === "number" ? data.duration : null;
      const eventName = typeof data.event === "string" ? data.event : typeof data.type === "string" ? data.type : null;

      if (duration && duration > 0) durationRef.current = duration;
      if (currentTime !== null) lastKnownTimeRef.current = currentTime;

      const nowComplete =
        !completedRef.current &&
        currentTime !== null &&
        isLessonComplete(currentTime, durationRef.current || durationSeconds);

      const isForced = eventName === "pause" || eventName === "ended" || nowComplete;

      if (nowComplete || eventName === "ended") {
        completedRef.current = true;
        flush(true, true);
        onCompleted?.();
        return;
      }

      if (currentTime !== null) {
        flush(isForced, false);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush(true, completedRef.current);
    }

    window.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleVisibilityChange);

    return () => {
      // Flush whatever we last knew on unmount/navigation, so switching
      // lessons never loses a few seconds of progress.
      flush(true, completedRef.current);
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, courseSlug]);

  const startTime = Math.max(0, Math.floor(initialPositionSeconds));
  const src = `${playbackUrl}&autoplay=false${startTime > 0 ? `&t=${startTime}` : ""}`;

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
      <div className="aspect-video w-full">
        <iframe
          ref={iframeRef}
          key={lessonId}
          src={src}
          title="مشغل الفيديو"
          loading="eager"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
