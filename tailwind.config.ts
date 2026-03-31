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
          card: "#111111",
          border: "#1e1e1e",
          "border-hover": "#2a2a2a",
          "text-primary": "#ffffff",
          "text-secondary": "#a0a0a0",
          "text-muted": "#666666",
          "text-label": "#888888",
          accent: {
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
        sans: [
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
