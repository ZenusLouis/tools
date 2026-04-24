import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-base": "var(--bg-base)",
        card: "var(--card)",
        "card-hover": "var(--card-hover)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        done: "var(--done)",
        "in-progress": "var(--in-progress)",
        blocked: "var(--blocked)",
        pending: "var(--pending)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        muted: "var(--muted)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [
    forms,
    typography,
  ],
};

export default config;
