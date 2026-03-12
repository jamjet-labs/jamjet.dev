import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://jamjet.dev',
  integrations: [
    sitemap(),
    starlight({
      title: 'JamJet',
      tagline: 'The agent-native runtime',
      logo: {
        src: './src/assets/logo-pixel.png',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      social: {
        github: 'https://github.com/jamjet-labs/jamjet',
        'x.com': 'https://x.com/jamjetdev',
      },
      editLink: {
        baseUrl: 'https://github.com/jamjet-labs/jamjet/edit/main/docs/',
      },
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { slug: 'quickstart' },
            { slug: 'concepts' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'yaml-workflows' },
            { slug: 'python-sdk' },
            { slug: 'java-sdk' },
            { slug: 'api-reference' },
            { slug: 'enterprise' },
            { slug: 'eval' },
            { slug: 'mcp' },
            { slug: 'a2a' },
            { slug: 'observability' },
            { slug: 'deployment' },
            { slug: 'cli' },
            { slug: 'examples' },
          ],
        },
        {
          label: 'Migrate to JamJet',
          items: [
            { slug: 'migrate/from-langgraph' },
            { slug: 'migrate/from-crewai' },
            { slug: 'migrate/from-openai-direct' },
          ],
        },
        {
          label: 'Compare',
          items: [
            { slug: 'compare' },
            { label: 'Benchmarks', link: '/benchmarks' },
          ],
        },
      ],
      components: {
        Header: './src/components/Header.astro',
        Sidebar: './src/components/Sidebar.astro',
      },
      customCss: ['./src/styles/global.css'],
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://jamjet.dev/og.svg' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:type', content: 'website' },
        },
      ],
    }),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
