import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050a07",
        forest: "#07120d",
        panel: "#101613",
        panelSoft: "#151c18",
        line: "#243029",
        neon: "#45e68a",
        acid: "#a7f56a",
        gold: "#e7b94f",
        goldLight: "#ffd977",
      },
      boxShadow: {
        glow: "0 18px 60px rgba(0,0,0,.24), 0 0 28px rgba(69,230,138,.06)",
        gold: "0 0 24px rgba(231,185,79,.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
