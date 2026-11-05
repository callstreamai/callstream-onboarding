import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cs: {
          bg: "#000000",
          surface: "#0a0a0a",
          card: "#0c0c0c",
          border: "#1c1c1c",
          "border-hover": "#383838",
          "text-primary": "#f5f5f5",
          "text-secondary": "#a0a0a0",
          "text-muted": "#a0a0a0",
          "text-label": "#a0a0a0",
          accent: {
            brand: "#d560b2",
            green: "#4ade80",
            blue: "#60a5fa",
            purple: "#a78bfa",
            orange: "#fb923c",
            red: "#f87171",
            cyan: "#22d3ee",
          },
        },
      },
      fontFamily: {
        mono: ["CallStream Mono", "ui-monospace", "monospace"],
        sans: [
          "CallStream Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
