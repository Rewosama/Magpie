import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "var(--font-mono)",
          "SF Mono",
          "Fira Code",
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        "square-spin": "square-spin 1.5s linear infinite",
      },
      keyframes: {
        "square-spin": {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-144" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
