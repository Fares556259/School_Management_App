import type { Config } from "tailwindcss";
import { apricot, brand, designRadius, designShadow, ink, paper } from './src/styles/tokens';

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        brand,
        ink,
        paper,
        apricot,
        // Keep older utility classes visually aligned while screens migrate to tokens.
        blue: brand,
        indigo: brand,
        slate: ink,
        gray: ink,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Compatibility for existing chart categories and old skeletons.
        lamaSky: '#B8DCDD',
        lamaSkyLight: '#EDF6F5',
        lamaPurple: brand[200],
        lamaPurpleLight: brand[50],
        lamaYellow: apricot,
        lamaYellowLight: '#FFF1E7',
        // Premium Palette
        premium: {
          dark: ink[900],
          darkMuted: ink[800],
          accent: brand[600],
          accentHover: brand[700],
          glassWhite: "rgba(255, 255, 255, 0.05)",
          glassBorder: "rgba(255, 255, 255, 0.1)",
        }
      },
      borderRadius: {
        control: designRadius.control,
        panel: designRadius.panel,
        dialog: designRadius.dialog,
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'var(--font-arabic)', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'var(--font-manrope)', 'sans-serif'],
        // Legacy names resolve to the same family during migration.
        jakarta: ['var(--font-manrope)', 'var(--font-arabic)', 'sans-serif'],
        montserrat: ['var(--font-manrope)', 'var(--font-arabic)', 'sans-serif'],
      },
      boxShadow: {
        panel: designShadow.panel,
        overlay: designShadow.overlay,
        premium: designShadow.panel,
        'premium-hover': '0 6px 18px -8px rgb(24 33 54 / 0.18)',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

