import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://jamjet.dev',
  integrations: [
    starlight({
      title: 'JamJet',
      tagline: 'The agent-native runtime',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      social: {
        github: 'https://github.com/jamjet-labs/jamjet',
        discord: 'https://discord.gg/jamjet',
        'x.com': 'https://x.com/jamjetdev',
      },
      editLink: {
        baseUrl: 'https://github.com/jamjet-labs/jamjet/edit/main/docs/',
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
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Quickstart', slug: 'docs/quickstart' },
            { label: 'Core Concepts', slug: 'docs/concepts' },
          ],
        },
        {
          label: 'Workflow Authoring',
          items: [
            { label: 'YAML Workflows', slug: 'docs/yaml-workflows' },
            { label: 'Python SDK', slug: 'docs/python-sdk' },
          ],
        },
        {
          label: 'Agent Protocols',
          items: [
            { label: 'MCP Integration', slug: 'docs/mcp' },
            { label: 'A2A Integration', slug: 'docs/a2a' },
          ],
        },
        {
          label: 'Features',
          items: [
            { label: 'Eval Harness', slug: 'docs/eval' },
            { label: 'Observability', slug: 'docs/observability' },
          ],
        },
        {
          label: 'Production',
          items: [
            { label: 'Deployment', slug: 'docs/deployment' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'CLI Reference', slug: 'docs/cli' },
            { label: 'Examples', slug: 'docs/examples' },
          ],
        },
      ],
    }),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
