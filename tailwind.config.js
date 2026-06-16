/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'Rubik', 'system-ui', 'sans-serif']
      },
      colors: {
        // Brand = indigo (modern, vibrant, professional)
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        },
        // Accent = violet for gradients
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9'
        }
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.06)',
        lift: '0 4px 12px rgba(15,23,42,0.05), 0 12px 32px rgba(15,23,42,0.08)',
        glow: '0 10px 40px -10px rgba(99,102,241,0.45)',
        ring: '0 0 0 4px rgba(99,102,241,0.18)'
      },
      backgroundImage: {
        'grad-brand': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
        'grad-brand-soft': 'linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)',
        'mesh':
          'radial-gradient(at 20% 20%, rgba(99,102,241,0.18) 0px, transparent 50%),' +
          'radial-gradient(at 80% 0%, rgba(139,92,246,0.18) 0px, transparent 50%),' +
          'radial-gradient(at 70% 80%, rgba(217,70,239,0.14) 0px, transparent 50%)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '60%': { opacity: '1', transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' }
        },
        'blob': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-20px) scale(1.1)' },
          '66%': { transform: 'translate(-20px,20px) scale(0.95)' }
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        'pop-in': 'pop-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        'blob': 'blob 18s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite'
      }
    }
  },
  plugins: []
};
