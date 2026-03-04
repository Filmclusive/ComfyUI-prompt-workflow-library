/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-hover": "rgb(var(--color-surface-hover) / <alpha-value>)",
        "surface-2": "rgb(var(--color-surface-2) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        fg: "rgb(var(--color-fg) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        "muted-2": "rgb(var(--color-muted-2) / <alpha-value>)",
        placeholder: "rgb(var(--color-placeholder) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-hover": "rgb(var(--color-accent-hover) / <alpha-value>)",
        "accent-ring": "rgb(var(--color-accent-ring) / <alpha-value>)",
        "danger-surface": "rgb(var(--color-danger-surface) / <alpha-value>)",
        "danger-border": "rgb(var(--color-danger-border) / <alpha-value>)",
        "danger-fg": "rgb(var(--color-danger-fg) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        "danger-hover": "rgb(var(--color-danger-hover) / <alpha-value>)",
        "warning-surface": "rgb(var(--color-warning-surface) / <alpha-value>)",
        "warning-border": "rgb(var(--color-warning-border) / <alpha-value>)",
        "warning-fg": "rgb(var(--color-warning-fg) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Verdana", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
