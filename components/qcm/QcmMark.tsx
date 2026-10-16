/**
 * The QCM wordmark.
 *
 * DRAWN, not set in the page font. The three letters are the heading
 * of a whole section of the platform and have to look identical on
 * every device; typing "QCM" in a heavy weight renders differently
 * wherever the font falls back, which is exactly where a mark must
 * not drift. Paths also tint with `currentColor`, so the same mark
 * sits on a light card and on the purple header without a second
 * asset.
 *
 * The C overlaps the Q, as in the reference mark — the counter of the
 * Q is cut so the C reads as sitting in front of it rather than
 * colliding with it.
 */
export function QcmMark({
  className = "",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 44"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={className}
      fill="currentColor"
    >
      {title && <title>{title}</title>}

      {/* Q — with the bite out of its right side where the C lands. */}
      <path d="M20.5 2C9.2 2 2 10.3 2 21.3 2 32.3 9.2 40.6 20.5 40.6c3.2 0 6.1-.7 8.6-1.9l5.4 5.3 5.6-5.7-5-4.9c2.5-3.1 3.9-7.3 3.9-12.1 0-11-7.2-19.3-18.5-19.3Zm0 7.9c6.2 0 10 4.6 10 11.4 0 2.4-.5 4.6-1.4 6.3l-5.2-5.1-5.6 5.7 5 4.9c-.9.3-1.8.4-2.8.4-6.2 0-10-4.6-10-11.5 0-6.8 3.8-11.4 10-11.4Z" />

      {/* C — the counterform, set slightly low so the row has rhythm. */}
      <path d="M58.8 8.6c-6.4 0-10.3 4.6-10.3 11.5s3.9 11.5 10.3 11.5c3.5 0 6.2-1.3 8-3.6l6.3 5.1c-3.3 4.4-8.3 6.9-14.6 6.9C46.9 40 39.6 31.7 39.6 20.1S46.9.2 58.5.2c6.2 0 11.2 2.5 14.5 6.8l-6.3 5.2c-1.8-2.3-4.4-3.6-7.9-3.6Z" />

      {/* M */}
      <path d="M78.4 2.6h9.9l9.2 20.1 9.2-20.1h9.9v37.4h-8.4V19.1l-7.4 15.8h-6.6l-7.4-15.8V40h-8.4V2.6Z" />
    </svg>
  );
}
