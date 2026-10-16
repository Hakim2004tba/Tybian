import type { Config } from "tailwindcss";

// TIBYAN theme tokens — sourced directly from /docs/DESIGN_SYSTEM.md.
// Do not add new colors/radii/spacing here without a corresponding entry
// (and rationale) in /docs/DESIGN_DECISIONS.md.

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    /*
      lib/ is scanned too. Tailwind finds classes by reading source
      text, so a class name written in an unscanned file is never
      generated and the element silently keeps no styling at all — no
      error, no warning, just an element sitting wherever the layout
      happens to drop it. A helper in lib/ui returning position classes
      cost exactly that.
    */
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6C4CF1",
          hover: "#5B3AE0",
          active: "#4A2ACB",
        },
        secondary: "#22D3B8",
        gold: {
          DEFAULT: "#E8B84B",
          hover: "#D9A63A",
        },
        /*
          THE `-light` TOKENS ARE NOW THEME VARIABLES, not fixed colours.
          ----------------------------------------------------------------
          Roughly a thousand class names across the app say `-light`
          (`bg-bg-light`, `text-text-primary-light`, `border-border-light`).
          Rewriting every one of them to a neutral name was the tidy way to
          add a dark theme and also the way to introduce a hundred silent
          mistakes in a codebase with no visual tests. So the VALUES move
          instead of the names: each resolves to a CSS variable that
          globals.css redefines under `.dark`, and every existing class
          follows the theme with no edit at all.

          The name is now a misnomer — `bg-bg-light` is dark in dark mode.
          That is a real cost, recorded here rather than hidden; renaming
          them is a mechanical follow-up that can be done safely later with
          the theme already working.

          `rgb(var(--x) / <alpha-value>)` rather than a plain hex, because
          the app leans on opacity modifiers everywhere — `bg-primary/10`,
          `border-white/70`. A variable holding a finished colour breaks
          all of them; one holding channels keeps them.

          The `-dark` tokens below stay FIXED. They paint the sections that
          are deliberately dark in both themes — the hero, the lesson
          player — and flipping those would invert a design decision rather
          than follow a preference.
        */
        bg: {
          dark: "#0A0714",
          light: "rgb(var(--c-bg) / <alpha-value>)",
        },
        surface: {
          dark: "#14101F",
          light: "rgb(var(--c-surface) / <alpha-value>)",
        },
        elevated: {
          dark: "#1C1730",
        },
        border: {
          dark: "#2E2748",
          light: "rgb(var(--c-border) / <alpha-value>)",
        },
        text: {
          "primary-dark": "#F5F3FF",
          "secondary-dark": "#B4ADD1",
          "muted-dark": "#7C7499",
          "primary-light": "rgb(var(--c-text-primary) / <alpha-value>)",
          "secondary-light": "rgb(var(--c-text-secondary) / <alpha-value>)",
          "muted-light": "rgb(var(--c-text-muted) / <alpha-value>)",
        },
        // Academy palette — the two colours the student dashboard is
        // built from. `deep` is the dark purple that carries the
        // sidebar and the strong sections; `lavender` is the light
        // surface the main content sits on. They are deliberately a
        // PAIR: the dashboard is meant to read as a balanced
        // dark/light composition, not a dark page with light accents.
        academy: {
          /*
            The rail and the content ground. Both are theme variables for
            the same reason as above — in dark mode the pair stops being a
            dark/light contrast and becomes two near-black surfaces, so the
            rail reads as part of the page instead of a panel glued to it.
          */
          deep: "rgb(var(--c-academy-deep) / <alpha-value>)",
          deeper: "rgb(var(--c-academy-deeper) / <alpha-value>)",
          deepest: "rgb(var(--c-academy-deepest) / <alpha-value>)",
          lavender: "rgb(var(--c-academy-lavender) / <alpha-value>)",
          "lavender-soft": "rgb(var(--c-academy-lavender-soft) / <alpha-value>)",
          "lavender-deep": "rgb(var(--c-academy-lavender-deep) / <alpha-value>)",
        },

        /*
          PAPER. Fixed white in both themes, and deliberately not a
          theme variable.

          The sketch surface is not a card — it is the sheet being drawn
          on. Its grid is painted into the canvas at a fixed #EEECF2 and
          the default ink is near-black, both chosen for white paper. In
          dark mode the generic `.bg-white` override turned the sheet
          near-black and left dark ink on it, which is how a drawing
          became invisible. A real notebook does not change colour when
          the room lights go off.
        */
        paper: "#FFFFFF",

        success: "#34C77B",
        warning: "#E8B84B",
        error: "#EF4B5F",
        info: "#4CA9F1",
      },
      fontFamily: {
        arabic: ["var(--font-plex-arabic)", "system-ui", "sans-serif"],
        latin: ["var(--font-inter)", "system-ui", "sans-serif"],
        num: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        full: "999px",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
        "4xl": "96px",
      },
      maxWidth: {
        content: "1440px",
        reading: "1200px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(23,15,46,0.06)",
        md: "0 4px 12px rgba(23,15,46,0.08)",
        lg: "0 12px 32px rgba(23,15,46,0.12)",
      },
      keyframes: {
        pulseSlow: {
          "0%, 100%": { opacity: "0.8", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        // Opacity only — no transform. A transform on this wrapper
        // creates a containing block for every `position: sticky`
        // descendant, which pinned the dashboard and admin sidebars to
        // the animated div instead of the viewport.
        pageIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
        /* A light sweeping across a surface — used on the year cards
           that have no courses yet, to say "being prepared" without a
           spinner claiming something is loading. */
        sheen: {
          "0%": { transform: "translateX(-140%)" },
          "60%, 100%": { transform: "translateX(240%)" },
        },
        /* A dot that breathes rather than blinks: a blink reads as an
           error light, a breath reads as waiting. */
        breathe: {
          "0%, 100%": { opacity: "0.35", transform: "scale(0.85)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        /* A panel arriving from just below, used for the QCM
           correction. It must be SHORT: it appears at the moment a
           student is waiting to know whether they were right, and any
           animation long enough to notice there is felt as lag. */
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        /* The score landing on the analysis screen. */
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        /* Very slow drift for the decorative blurs behind a section. */
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "33%": { transform: "translate3d(3%, -4%, 0) scale(1.06)" },
          "66%": { transform: "translate3d(-3%, 3%, 0) scale(0.97)" },
        },
      },
      animation: {
        "pulse-slow": "pulseSlow 9s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        float: "float 7s ease-in-out infinite",
        "page-in": "pageIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.8s ease infinite",
        sheen: "sheen 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        breathe: "breathe 2.4s ease-in-out infinite",
        drift: "drift 26s ease-in-out infinite",
        "rise-in": "riseIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        "pop-in": "popIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
