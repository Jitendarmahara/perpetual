/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Use CSS-variable channel format — the official Tailwind v3 way to support
        // opacity modifiers like bg-lime/20, text-bull/60, etc.
        lime: {
          DEFAULT: "rgb(var(--color-lime) / <alpha-value>)",
          foreground: "rgb(var(--color-lime-fg) / <alpha-value>)",
        },
        bull:             "rgb(var(--color-bull) / <alpha-value>)",
        bear:             "rgb(var(--color-bear) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          2:       "rgb(var(--color-surface-2) / <alpha-value>)",
        },
        border:            "rgb(var(--color-border) / <alpha-value>)",
        input:             "rgb(var(--color-input) / <alpha-value>)",
        "muted-foreground":"rgb(var(--color-muted-fg) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans:    ["var(--font-sans)",    "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)",    "ui-monospace",  "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
