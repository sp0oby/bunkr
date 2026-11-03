import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: { port: 5173 },
  build: {
    // Two pages: the game, and the public How to Play guide.
    rollupOptions: { input: { main: 'index.html', guide: 'guide.html' } },
  },
});
