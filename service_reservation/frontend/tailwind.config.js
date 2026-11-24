/** Palette et typographie relevées sur les maquettes PARC AUTO */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      colors: {
        page: '#F4F5F7',
        field: '#F1F2F4',
        ink: { DEFAULT: '#0F1115', soft: '#3C4049', muted: '#6B7180', faint: '#9AA0AC' },
        line: '#ECEDF0',
        brand: { DEFAULT: '#0B57D0', hover: '#0A4CB6', soft: '#E8F0FE', ring: '#9EBDF5' },
        pending: { DEFAULT: '#C2741B', text: '#B4610E', soft: '#FDF1E4' },
        danger: { DEFAULT: '#D93025', text: '#C5221F', soft: '#FDECEA' },
        success: { DEFAULT: '#188038', soft: '#E6F4EA' },
      },
      borderRadius: { card: '16px' },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04)',
        pop: '0 12px 32px -8px rgba(16,24,40,0.18), 0 2px 6px rgba(16,24,40,0.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.6)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
        'scale-in': 'scale-in .35s cubic-bezier(.2,.9,.3,1.3) both',
      },
    },
  },
  plugins: [],
}
