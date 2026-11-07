import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://jamjet.dev',
  integrations: [
    // /investors stays public but is noindex, so keep it out of the sitemap.
    sitemap({ filter: (page) => !/\/investors\/?$/.test(new URL(page).pathname) }),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
