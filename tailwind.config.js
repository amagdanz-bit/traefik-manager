module.exports = {
  content: ['./templates/**/*.html', './static/js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        traefik: {
          blue: '#24a1de',
          dark: '#0d1117',
          card: '#161b22',
          border: '#30363d',
          muted: '#8b949e',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      }
    }
  }
}
