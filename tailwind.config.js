// tailwind.config.js - Mobile-first responsive design
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        'safe-area': 'screen and (display-mode: standalone)',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'screen-safe': 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    // Custom plugin for PWA styles
    function({ addUtilities }) {
      addUtilities({
        '.pwa-safe-area': {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)', 
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        },
        '.touch-manipulation': {
          touchAction: 'manipulation',
        },
        '.select-none': {
          userSelect: 'none',
          webkitUserSelect: 'none',
        }
      });
    }
  ],
};