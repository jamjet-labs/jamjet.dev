import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://jamjet.dev',
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/quickstart') &&
        !page.includes('/concepts') &&
        !page.includes('/mcp') &&
        !page.includes('/a2a') &&
        !page.includes('/compare'),
    }),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  redirects: {
    '/usecases': '/showcase',
    '/examples': '/showcase',
  },
});
