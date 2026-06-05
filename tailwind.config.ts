import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        "surface-variant": "#d3e4fe",
        "surface-container": "#e5eeff",
        outline: "#76777d",
        "primary-fixed-dim": "#bec6e0",
        "on-tertiary": "#ffffff",
        tertiary: "#000000",
        "surface-container-lowest": "#ffffff",
        "on-primary-fixed-variant": "#3f465c",
        background: "#f8f9ff",
        "on-primary-fixed": "#131b2e",
        "surface-container-high": "#dce9ff",
        "surface-dim": "#cbdbf5",
        primary: "#000000",
        "error-container": "#ffdad6",
        "secondary-fixed": "#e0e3e5",
        "on-surface-variant": "#45464d",
        "on-secondary-fixed": "#191c1e",
        "tertiary-fixed": "#d8e3fb",
        "secondary-fixed-dim": "#c4c7c9",
        "on-error": "#ffffff",
        "inverse-surface": "#213145",
        "surface-container-highest": "#d3e4fe",
        "on-tertiary-fixed-variant": "#3c475a",
        "on-primary-container": "#7c839b",
        "on-error-container": "#93000a",
        "tertiary-fixed-dim": "#bcc7de",
        "on-background": "#0b1c30",
        "inverse-on-surface": "#eaf1ff",
        "on-secondary": "#ffffff",
        "surface-bright": "#f8f9ff",
        "on-surface": "#0b1c30",
        "tertiary-container": "#111c2d",
        "on-primary": "#ffffff",
        "on-tertiary-container": "#79849a",
        "outline-variant": "#c6c6cd",
        "primary-fixed": "#dae2fd",
        "on-secondary-fixed-variant": "#444749",
        "secondary-container": "#e0e3e5",
        secondary: "#5c5f61",
        "inverse-primary": "#bec6e0",
        error: "#ba1a1a",
        "on-secondary-container": "#626567",
        "primary-container": "#131b2e",
        "on-tertiary-fixed": "#111c2d",
        "surface-tint": "#565e74",
        surface: "#f8f9ff",
        "surface-container-low": "#eff4ff"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        md: "24px",
        "sidebar-width": "280px",
        xl: "64px",
        lg: "40px",
        sm: "12px",
        base: "8px",
        xs: "4px",
        "container-max": "1440px"
      },
      fontFamily: {
        inter: ["var(--font-inter)", "Inter", "sans-serif"],
        "headline-lg": ["var(--font-inter)", "Inter", "sans-serif"],
        "body-lg": ["var(--font-inter)", "Inter", "sans-serif"],
        "body-sm": ["var(--font-inter)", "Inter", "sans-serif"],
        "headline-md": ["var(--font-inter)", "Inter", "sans-serif"],
        "display-lg": ["var(--font-inter)", "Inter", "sans-serif"],
        "label-md": ["var(--font-inter)", "Inter", "sans-serif"],
        "body-md": ["var(--font-inter)", "Inter", "sans-serif"],
        "headline-sm": ["var(--font-inter)", "Inter", "sans-serif"],
        "label-sm": ["var(--font-inter)", "Inter", "sans-serif"]
      },
      fontSize: {
        "headline-lg": [
          "32px",
          { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }
        ],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "display-lg": [
          "48px",
          { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }
        ],
        "label-md": [
          "14px",
          { lineHeight: "20px", letterSpacing: "0.05em", fontWeight: "600" }
        ],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "500" }]
      },
      boxShadow: {
        panel: "0 18px 44px rgba(15, 23, 42, 0.08)",
        "panel-sm": "0 10px 30px rgba(15, 23, 42, 0.06)"
      }
    }
  },
  plugins: [forms]
};

export default config;
