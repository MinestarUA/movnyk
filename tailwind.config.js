/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "slide-in-top": {
          "0%": { transform: "translateY(-50px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-bottom": {
          "0%": { transform: "translateY(50px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "scale-in-center": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-scale": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "slide-in-top": "slide-in-top 0.6s cubic-bezier(0.250, 0.460, 0.450, 0.940) both",
        "slide-in-bottom": "slide-in-bottom 0.6s cubic-bezier(0.250, 0.460, 0.450, 0.940) both",
        "slide-in-left": "slide-in-left 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both",
        "slide-in-right": "slide-in-right 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both",
        "scale-in-center": "scale-in-center 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both",
        "fade-in": "fade-in 0.5s ease-in-out",
        "fade-in-scale": "fade-in-scale 0.5s ease-in-out",
      },
    },
  },
  daisyui: {
    themes: [
      {
        movnyk: {
          primary: "#ff5fa2",
          "primary-content": "#ffffff",
          secondary: "#b25ef0",
          "secondary-content": "#ffffff",
          accent: "#9184d9",
          "accent-content": "#ffffff",
          neutral: "#3f424d",
          "neutral-content": "#e9e9ed",
          "base-100": "#161826",
          "base-200": "#232532",
          "base-300": "#2b2d3a",
          "base-content": "#e9e9ed",
          success: "#63d68a",
          "success-content": "#0e1a12",
          warning: "#f0be5a",
          "warning-content": "#1c1608",
          error: "#ff5f6d",
          "error-content": "#1c0709",
          info: "#9184d9",
          "info-content": "#0f0f18",
          "--rounded-box": "0.875rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "999px",
        },
      },
    ],
  },
  plugins: [daisyui],
};
