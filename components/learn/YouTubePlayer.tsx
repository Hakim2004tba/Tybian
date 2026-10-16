"use client";

import { useEffect, useRef } from "react";
import { updateLessonProgressAction } from "@/lib/actions/lesson-progress";
import { recordVideoDurationAction } from "@/lib/actions/video-duration";
import { shouldFlushProgress, isLessonComplete } from "@/lib/video/progress-throttle";

const SAVE_INTERVAL_SECONDS = 15;

/**
 * YouTube-sourced lessons, WITH watch-progress tracking.
 *
 * This used to be a plain embed with an honest note saying progress was
 * not tracked. That note was accurate but the consequence was not
 * acceptable once every lesson on the platform turned out to be a
 * YouTube video: no student's progress bar ever moved.
 *
 * It now drives the official IFrame Player API, which reports position
 * and duration on a documented interface — the same contract the Vimeo
 * player rests on. Everything downstream is shared and unchanged: the
 * 15-second throttle, the completion threshold, the same server action.
 *
 * The duration is also reported back once (recordVideoDurationAction),
 * because YouTube's oEmbed — the only YouTube API this project uses,
 * since it needs no key — does not return it, which is why courses were
 * advertising "0 hours".
 */

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Loads the IFrame API once per page, and resolves for every caller
 *  that asks while it is still in flight — two lessons opened quickly
 *  must not race into two script tags. */
let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return apiPromise;
}

/** Extracts the video id from the embed URL resolvePlayback() built, so
 *  this component keeps taking a playbackUrl like every other player
 *  rather than a bare id. */
function videoIdFrom(url: string): string | null {
  const match = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function YouTubePlayer({
  playbackUrl,
  lessonId,
  courseSlug,
  initialPositionSeconds = 0,
  durationSeconds = 0,
  onCompleted,
}: {
  playbackUrl: string;
  lessonId?: string;
  courseSlug?: string;
  initialPositionSeconds?: number;
  durationSeconds?: number;
  onCompleted?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastFlushAtRef = useRef(Date.now());
  const lastKnownTimeRef = useRef(initialPositionSeconds);
  const durationRef = useRef(durationSeconds);
  const completedRef = useRef(false);
  const reportedDurationRef = useRef(false);

  useEffect(() => {
    lastKnownTimeRef.current = initialPositionSeconds;
    lastFlushAtRef.current = Date.now();
    completedRef.current = false;
  }, [lessonId, initialPositionSeconds]);

  useEffect(() => {
    const host = hostRef.current;
    const videoId = videoIdFrom(playbackUrl);
    if (!host || !videoId) return;

    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    function flush(forced: boolean, completed: boolean) {
      if (!lessonId) return;
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
      // courseSlug only on a real completion, so the throttled ticks do
      // not revalidate the page cache four times a minute.
      void updateLessonProgressAction(
        lessonId,
        lastKnownTimeRef.current,
        completed,
        completed ? courseSlug : undefined
      );
    }

    function tick() {
      const player = playerRef.current;
      if (!player) return;

      const time = player.getCurrentTime?.() ?? 0;
      const total = player.getDuration?.() ?? 0;

      if (total > 0) {
        durationRef.current = total;
        // Reported once per mount, and the action itself refuses to
        // overwrite a duration that is already known.
        if (!reportedDurationRef.current && lessonId) {
          reportedDurationRef.current = true;
          void recordVideoDurationAction(lessonId, total);
        }
      }

      if (time > 0) lastKnownTimeRef.current = time;

      if (!completedRef.current && isLessonComplete(time, durationRef.current || durationSeconds)) {
        completedRef.current = true;
        flush(true, true);
        onCompleted?.();
        return;
      }

      flush(false, false);
    }

    void loadYouTubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(host, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          // Required for the API to talk to the iframe at all.
          enablejsapi: 1,
          origin: window.location.origin,
          start: Math.max(0, Math.floor(initialPositionSeconds)),
        },
        events: {
          onStateChange: (event: { data: number }) => {
            const YT = window.YT!;
            if (event.data === YT.PlayerState.PLAYING) {
              // Poll while playing: the API has no timeupdate event, so
              // position has to be read on an interval — one second is
              // well below the 15s save throttle, so this costs nothing
              // in requests.
              poll ??= setInterval(tick, 1000);
            } else {
              if (poll) {
                clearInterval(poll);
                poll = null;
              }
              // A pause or a seek is a real moment worth saving.
              if (event.data === YT.PlayerState.PAUSED) flush(true, completedRef.current);
              if (event.data === YT.PlayerState.ENDED) {
                completedRef.current = true;
                flush(true, true);
                onCompleted?.();
              }
            }
          },
        },
      });
    });

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush(true, completedRef.current);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      // Save whatever was last known before unmounting, so switching
      // lessons never loses the final seconds.
      flush(true, completedRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleVisibilityChange);
      try {
        playerRef.current?.destroy();
      } catch {
        // The iframe may already be gone with the unmounted subtree.
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackUrl, lessonId, courseSlug]);

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
      <div className="aspect-video w-full">
        <div ref={hostRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      </div>
    </div>
  );
}
