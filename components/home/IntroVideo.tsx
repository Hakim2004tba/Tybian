"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";

/**
 * The explainer film, playing by itself.
 *
 * WHY MUTED. Every browser blocks a video that starts with sound —
 * Chrome and Safari both require muted+playsinline for unattended
 * autoplay, and a player that tries anyway simply does not start. So
 * it begins muted and loops, and a single button turns the sound on.
 * That is not a compromise: a page that starts talking the moment it
 * loads is a page people close.
 *
 * WHY IT ONLY LOADS WHEN SEEN. The iframe is not rendered until the
 * section comes near the viewport, so a visitor who never scrolls this
 * far pays nothing for it — on a phone on mobile data that is the
 * difference between a fast homepage and a slow one.
 *
 * Vimeo's `background=1` gives exactly this shape: autoplay, loop,
 * muted, no chrome. `muted=0` is then set through the player's own
 * parameters when the student asks for sound, by reloading the frame
 * with the same time — simpler and more reliable than the postMessage
 * API for one button.
 */
export function IntroVideo({
  videoId,
  hash,
  poster,
}: {
  videoId: string;
  hash: string | null;
  /** Shown until the frame loads, so the block never appears empty. */
  poster?: string | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    /*
      A MEASUREMENT AS WELL AS AN OBSERVER.

      IntersectionObserver is the right tool, but it does not fire
      while the document is not being rendered — a background tab, a
      hidden pane — and an element that is already on screen at mount
      would then sit empty until something else woke the page. The
      direct measurement covers exactly that case; the observer still
      handles everything below the fold.
    */
    const onScreen = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight + 300 && r.bottom > -300;
    };
    if (onScreen()) {
      setNear(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const params = new URLSearchParams({
    background: sound ? "0" : "1",
    autoplay: "1",
    loop: "1",
    muted: sound ? "0" : "1",
    autopause: "0",
    dnt: "1",
    playsinline: "1",
    title: "0",
    byline: "0",
    portrait: "0",
  });
  if (hash) params.set("h", hash);

  return (
    <div ref={hostRef} className="relative">
      {/* The glow behind it — the one decorative flourish, and it sits
          behind the frame rather than over it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/25 via-transparent to-secondary/20 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-academy-deep shadow-[0_30px_80px_-30px_rgba(10,7,20,0.8)]">
        <div className="relative aspect-video w-full">
          {near ? (
            <iframe
              key={sound ? "sound" : "silent"}
              src={`https://player.vimeo.com/video/${videoId}?${params.toString()}`}
              title="TIBYAN"
              allow="autoplay; fullscreen; picture-in-picture"
              className="absolute inset-0 h-full w-full"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center bg-cover bg-center"
              style={poster ? { backgroundImage: `url(${poster})` } : undefined}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
                <Play size={22} className="ms-0.5" />
              </span>
            </div>
          )}
        </div>

        {/* Sound is opt-in, and the control says which state it is in
            rather than which state it would switch to. */}
        <button
          type="button"
          onClick={() => setSound((v) => !v)}
          aria-label={sound ? "كتم الصوت" : "تشغيل الصوت"}
          className="absolute bottom-3 end-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
        >
          {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
      </div>
    </div>
  );
}
