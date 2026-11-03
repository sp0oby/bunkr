import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

// The public site address, for canonical links, share cards and the sitemap. On Vercel it
// defaults to the project's production domain; set SITE_URL to override (custom domain).
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const SITE_URL = (process.env.SITE_URL ?? (vercel ? `https://${vercel}` : '')).replace(/\/+$/, '');

/** Fill %SITE_URL% in the pages, and write robots.txt + sitemap.xml into the build. */
function seo(): Plugin {
  return {
    name: 'bunkr-seo',
    // 'pre' so Vite's own %ENV% replacement never sees (and warns about) the placeholder.
    transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', SITE_URL) },
    generateBundle() {
      if (!SITE_URL) this.warn('SITE_URL is not set: share cards use relative links and no sitemap is written.');
      const robots = ['User-agent: *', 'Allow: /', ...(SITE_URL ? [`Sitemap: ${SITE_URL}/sitemap.xml`] : [])];
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots.join('\n') + '\n' });
      if (!SITE_URL) return;
      const urls = ['/', '/guide.html'].map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [preact(), seo()],
  server: { port: 5173 },
  build: {
    // Two pages: the game, and the public How to Play guide.
    rollupOptions: { input: { main: 'index.html', guide: 'guide.html' } },
  },
});
