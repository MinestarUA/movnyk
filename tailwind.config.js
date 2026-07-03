/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
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
    themes: ["dracula"],
  },
  plugins: [daisyui],
};
