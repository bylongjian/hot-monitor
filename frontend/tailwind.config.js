/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgba(255,255,255,0.03)",
          hover: "rgba(255,255,255,0.06)",
          border: "rgba(255,255,255,0.07)",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "Consolas", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "slide-in": "slideIn 0.25s ease-out",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        spotlight: "spotlight 2s ease 0.75s 1 forwards",
        breathing: "breathing 3s ease-in-out infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(59,130,246,0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(59,130,246,0.45)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        spotlight: {
          "0%": { opacity: "0", transform: "translate(-72%, -62%) scale(0.5)" },
          "100%": { opacity: "1", transform: "translate(-50%, -40%) scale(1)" },
        },
        breathing: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
