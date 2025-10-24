/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
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
        primary: {
          DEFAULT: "#26a69a",
          dark: "#00796b",
          50: "#9AB1BE",
          100: "#8AA1AD",
          200: "#7A919C",
          300: "#6A818B",
          400: "#5A717A",
          500: "#4A6169",
          600: "#3A5158",
          700: "#2A4047",
          800: "#1A2E35",
          900: "#0D1B20",
        },
        accent: {
          DEFAULT: "#55a39a",
          50: "#DCF3EA",
          100: "#C1E3DA",
          200: "#A6D3CA",
          300: "#8BC3BA",
          400: "#70b3aa",
          500: "#55a39a",
          600: "#5D7C77",
          700: "#4D6C67",
          800: "#3D5C57",
          900: "#2D4C47",
        },
        neutral: {
          0: "#FFFFFF",
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#0D1B20",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
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
        "sound-wave": {
          "0%, 100%": {
            transform: "scaleY(1)",
          },
          "50%": {
            transform: "scaleY(0.5)",
          },
        },
        pulse: {
          "0%": {
            transform: "scale(1)",
            opacity: "1",
          },
          "100%": {
            transform: "scale(2.5)",
            opacity: "0",
          },
        },
        "gradient-move": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "blink-cursor": {
          "from, to": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "currentColor" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "sound-wave": "sound-wave 1.5s infinite ease-in-out",
        pulse: "pulse 2s infinite",
        "gradient-move": "gradient-move 10s ease infinite",
        "blink-cursor": "blink-cursor 0.7s step-end infinite",
      },
      fontFamily: {
        // Modern Primary Fonts
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["Playfair Display", "Georgia", "Times New Roman", "serif"],
        display: ["Playfair Display", "Georgia", "serif"],
        
        // Legacy Fonts (for compatibility)
        amiri: ["Amiri", "serif"],
        inter: ["Inter", "sans-serif"],
        lora: ["Playfair Display", "serif"], // Upgraded to Playfair Display
        poppins: ["Inter", "sans-serif"], // Consolidated to Inter
        kufi: ["Noto Kufi Arabic", "sans-serif"],
        
        // Multi-language Support
        arabic: ["Amiri", "Noto Sans Arabic", "Noto Kufi Arabic", "serif"],
        chinese: ["Noto Sans SC", "Noto Sans TC", "sans-serif"],
        cyrillic: ["Noto Sans", "Inter", "sans-serif"],
        devanagari: ["Noto Sans Devanagari", "sans-serif"],
        hebrew: ["Noto Sans Hebrew", "sans-serif"],
        thai: ["Noto Sans Thai", "sans-serif"],
        latin: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
