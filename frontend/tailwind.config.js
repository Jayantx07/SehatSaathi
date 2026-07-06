/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Sehat Saathi Design System
        brand: {
          50: "#f0f7ff",
          100: "#e0eefe",
          200: "#baddfd",
          300: "#7ec3fb",
          400: "#39a6f6",
          500: "#0f8ae8",
          600: "#036cc5",
          700: "#0457a0",
          800: "#084984",
          900: "#0d3d6d",
          950: "#092647",
        },
        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        danger: {
          50: "#fef2f2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
        },
        success: {
          50: "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "brand-gradient":
          "linear-gradient(135deg, #0f172a 0%, #0d3d6d 50%, #036cc5 100%)",
        "glow-gradient":
          "radial-gradient(ellipse at center, rgba(15, 138, 232, 0.15) 0%, transparent 70%)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "scan": "scan 2s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.02)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "scan": {
          "0%": { top: "0%", opacity: "1" },
          "100%": { top: "100%", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
