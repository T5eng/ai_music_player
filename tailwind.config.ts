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
        surface: {
          DEFAULT: "#0f0f14",
          raised: "#1a1a24",
          overlay: "#252533",
        },
        accent: {
          DEFAULT: "#a855f7",
          glow: "#c084fc",
          muted: "#7c3aed",
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        slideUp: "slideUp 0.4s ease-out",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
