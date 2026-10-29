/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: ["Consolas", "ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
