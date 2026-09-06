import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        page: "#F6F9DE",
        "page-alt": "#EFF4D6",
        "card-cream": "#F1F4D9",
        ink: {
          DEFAULT: "#0D2018",
          soft: "#14281F",
          muted: "#3A4A41",
        },
        lime: {
          DEFAULT: "#D6EC6F",
          text: "#17331F",
        },
        sage: {
          DEFAULT: "#A4BC93",
          text: "#2E3B2C",
        },
        lavender: {
          DEFAULT: "#DEDBF3",
          text: "#2A2740",
        },
        cream: {
          panel: "#F0F3D6",
        },
        text: {
          heading: "#0D2018",
          body: "#3D4A40",
          muted: "#7C8A7E",
          onDark: "#F6F9DE",
          onDarkMuted: "#A9B8A6",
        },
        border: {
          subtle: "#DCE3C4",
          ink: "#0D2018",
        },
        // Legacy HSL color fallbacks
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#0D2018",
          foreground: "#F6F9DE",
        },
        secondary: {
          DEFAULT: "#EFF4D6",
          foreground: "#0D2018",
        },
        accent: {
          DEFAULT: "#D6EC6F",
          foreground: "#17331F",
        },
      },
      fontFamily: {
        display: ["General Sans", "Inter", "sans-serif"],
        body: ["General Sans", "Inter", "sans-serif"],
        sans: ["General Sans", "Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        pill: "9999px",
      },
      letterSpacing: {
        eyebrow: "0.08em",
        button: "0.04em",
        tight: "-0.02em",
      },
      boxShadow: {
        none: "none",
        hover: "0 2px 8px rgba(13, 32, 24, 0.06)",
        "hover-subtle": "0 2px 8px rgba(13, 32, 24, 0.06)",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
    },
  },
  plugins: [],
};

export default config;
