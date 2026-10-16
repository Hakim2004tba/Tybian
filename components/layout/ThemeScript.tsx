import { type Theme, THEME_COOKIE } from "@/lib/theme/theme";

/**
 * Applies the theme before the browser paints.
 *
 * Runs synchronously, as the first thing in <body> — React sets no
 * class until it hydrates, and a class applied after hydration is a
 * class applied after the page has already been drawn in the wrong
 * colours. That white flash is the single most noticeable defect a dark
 * mode can ship with.
 *
 * It only has work to do for "system": an explicit choice is already on
 * <html> from the server. The listener keeps a "system" page in step
 * when the device flips at sunset without a reload.
 *
 * The script is a fixed string with no interpolated user input — the
 * theme value is one of three literals validated in getTheme().
 */
export function ThemeScript({ theme }: { theme: Theme }) {
  const source = `
(function () {
  try {
    var root = document.documentElement;
    var choice = ${JSON.stringify(theme)};
    if (choice === "system") {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var apply = function (dark) { root.classList.toggle("dark", dark); };
      apply(mq.matches);
      mq.addEventListener("change", function (e) {
        if (document.cookie.indexOf("${THEME_COOKIE}=") === -1) apply(e.matches);
      });
    }
  } catch (e) {
    /* A blocked cookie or an old matchMedia must not stop the page. */
  }
})();`;

  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
