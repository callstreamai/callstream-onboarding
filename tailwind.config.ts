import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Match the client portal's 15px typography scale without shrinking
      // rem-based layout spacing, icons, or 44px touch targets.
      fontSize: {
        xs: ["11.25px", { lineHeight: "16.875px" }],
        sm: ["13.125px", { lineHeight: "19.6875px" }],
        base: ["15px", { lineHeight: "22.5px" }],
        lg: ["16.875px", { lineHeight: "26.25px" }],
        xl: ["18.75px", { lineHeight: "26.25px" }],
        "2xl": ["22.5px", { lineHeight: "30px" }],
        "3xl": ["28.125px", { lineHeight: "33.75px" }],
        "4xl": ["33.75px", { lineHeight: "37.5px" }],
      },
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
