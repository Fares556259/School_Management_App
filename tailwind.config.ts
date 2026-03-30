import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        lamaSky: "#C3EBFA",
        lamaSkyLight: "#EDF9FD",
        lamaPurple: "#CFCEFF",
        lamaPurpleLight: "#F1F0FF",
        lamaYellow: "#FAE27C",
        lamaYellowLight: "#FEFCE8",
        // Premium Palette
        premium: {
          dark: "#0F172A",
          darkMuted: "#1E293B",
          accent: "#6366F1",
          accentHover: "#4F46E5",
          glassWhite: "rgba(255, 255, 255, 0.05)",
          glassBorder: "rgba(255, 255, 255, 0.1)",
        }
      },
      boxShadow: {
        'premium': '0 10px 40px -15px rgba(0, 0, 0, 0.2)',
        'premium-hover': '0 20px 50px -20px rgba(99, 102, 241, 0.3)',
      }
    },
  },
  plugins: [],
};
export default config;

