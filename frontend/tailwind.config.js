/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff8f1",
          100: "#feeedc",
          500: "#ea580c",
          600: "#c2410c",
          700: "#9a3412",
          900: "#431407",
        },
        chocolate: {
          50: "#fdf8f6",
          100: "#f2e8e5",
          800: "#4a2818",
          900: "#2d160c",
        },
      },
    },
  },
  plugins: [],
};

