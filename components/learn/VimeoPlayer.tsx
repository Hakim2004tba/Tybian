"use client";

import { useEffect, useRef } from "react";
import Player from "@vimeo/player";
import { updateLessonProgressAction } from "@/lib/actions/lesson-progress";
import { shouldFlushProgress, isLessonComplete } from "@/lib/video/progress-throttle";

const SAVE_INTERVAL_SECONDS = 15;

/**
 * Vimeo-sourced lessons, WITH real watch-progress tracking.
 *
 * The Bunny player this replaces had to parse raw postMessage traffic
 * defensively because its event schema wasn't verifiable. Vimeo instead
 * publishes an official player SDK (@vimeo/player) with documented
 * `timeupdate` / `ended` / `pause` events carrying `seconds` and
 * `duration`, so progress here rests on a specified API rather than a
 * guess at a payload shape — no defensive field-sniffing needed.
 *
 * Everything downstream is unchanged and shared with the previous
 * implementation: the same 15s throttle (shouldFlushProgress), the same
 * completion threshold (isLessonComplete), the same server action. Only
 * the source of the time/duration numbers differs.
 *
 * As before, the iframe only ever renders with a `playbackUrl` produced
 * by resolvePlayback() — i.e. after full server-side authorization.
 */
export function VimeoPlayer({
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
  const containerRef = useRef<HTMLDivElement>(null);
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
    const container = containerRef.current;
    if (!container) return;

    function flush(forced: boolean, completed: boolean) {
      const secondsSinceLastFlush = (Date.now() - lastFlushAtRef.current) / 1000;
      if (
        !shouldFlushProgress({
          secondsSinceLastFlush,
          minIntervalSeconds: SAVE_INTERVAL_SECONDS,
          isForcedFlush: forced,
        })
      ) {
        return;
      }
      lastFlushAtRef.current = Date.now();
      // courseSlug only on a real completion, so throttled ticks don't
      // revalidate the page cache 4x a minute — only the moment that
      // actually changes what the sidebar shows.
      void updateLessonProgressAction(
        lessonId,
        lastKnownTimeRef.current,
        completed,
        completed ? courseSlug : undefined
      );
    }

    // The SDK types `url` as a branded VimeoUrl template type, which a
    // runtime-built string can't satisfy statically. The URL is produced
    // by buildVimeoEmbedUrl() on the server and is always a
    // player.vimeo.com embed, so the cast asserts what the shape already
    // is rather than loosening a real check.
    const player = new Player(container, { url: playbackUrl as unknown as never });

    if (initialPositionSeconds > 0) {
      // Rejects if the video is shorter than the stored position (e.g.
      // the admin replaced the video with a shorter cut) — starting from
      // 0 is the right fallback, not an error the student should see.
      player.setCurrentTime(initialPositionSeconds).catch(() => {});
    }

    player.getDuration().then(
      (d) => {
        if (d > 0) durationRef.current = d;
      },
      () => {}
    );

    function onTimeUpdate(data: { seconds: number; duration: number }) {
      if (data.duration > 0) durationRef.current = data.duration;
      lastKnownTimeRef.current = data.seconds;

      if (
        !completedRef.current &&
        isLessonComplete(data.seconds, durationRef.current || durationSeconds)
      ) {
        completedRef.current = true;
        flush(true, true);
        onCompleted?.();
        return;
      }

      flush(false, false);
    }

    function onEnded() {
      completedRef.current = true;
      flush(true, true);
      onCompleted?.();
    }

    function onPause(data: { seconds: number }) {
      lastKnownTimeRef.current = data.seconds;
      flush(true, completedRef.current);
    }

    player.on("timeupdate", onTimeUpdate);
    player.on("ended", onEnded);
    player.on("pause", onPause);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush(true, completedRef.current);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleVisibilityChange);

    return () => {
      // Flush whatever we last knew before tearing down, so switching
      // lessons never loses the last few seconds of progress.
      flush(true, completedRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleVisibilityChange);
      player.off("timeupdate", onTimeUpdate);
      player.off("ended", onEnded);
      player.off("pause", onPause);
      void player.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, courseSlug, playbackUrl]);

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
      <div ref={containerRef} className="aspect-video w-full [&>iframe]:h-full [&>iframe]:w-full" />
    </div>
  );
}
