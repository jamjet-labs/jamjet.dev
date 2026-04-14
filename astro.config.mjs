import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://jamjet.dev',
  integrations: [
    sitemap(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  redirects: {
    '/usecases': '/showcase',
    '/examples': '/showcase',
  },
});
