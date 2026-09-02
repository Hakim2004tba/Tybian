import type { Config } from "tailwindcss";

// TIBYAN theme tokens — sourced directly from /docs/DESIGN_SYSTEM.md.
// Do not add new colors/radii/spacing here without a corresponding entry
// (and rationale) in /docs/DESIGN_DECISIONS.md.

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
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
        bg: {
          dark: "#0A0714",
          light: "#F7F6FB",
        },
        surface: {
          dark: "#14101F",
          light: "#FFFFFF",
        },
        elevated: {
          dark: "#1C1730",
        },
        border: {
          dark: "#2E2748",
          light: "#E4E1EF",
        },
        text: {
          "primary-dark": "#F5F3FF",
          "secondary-dark": "#B4ADD1",
          "muted-dark": "#7C7499",
          "primary-light": "#170F2E",
          "secondary-light": "#564F72",
          "muted-light": "#948CB0",
        },
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
        pageIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
      },
      animation: {
        "pulse-slow": "pulseSlow 9s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        float: "float 7s ease-in-out infinite",
        "page-in": "pageIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.8s ease infinite",
      },
    },
  },
  plugins: [],
};

export default config;
