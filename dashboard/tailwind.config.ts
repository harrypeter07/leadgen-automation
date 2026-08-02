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
        // Editorial Token Extensions
        editorial: {
          bgPrimary: "var(--bg-primary)",
          bgSecondary: "var(--bg-secondary)",
          bgSidebar: "var(--bg-sidebar)",
          surfacePrimary: "var(--surface-primary)",
          surfaceElevated: "var(--surface-elevated)",
          textPrimary: "var(--text-primary)",
          textSecondary: "var(--text-secondary)",
          borderSubtle: "var(--border-subtle)",
          borderStrong: "var(--border-strong)",
          accentPrimary: "var(--accent-primary)",
          accentHover: "var(--accent-hover)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        hero: "var(--radius-hero)",
        dialog: "var(--radius-dialog)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        glow: "0 0 20px -3px rgba(59, 130, 246, 0.3)",
        "glow-lg": "0 0 30px -5px rgba(59, 130, 246, 0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
