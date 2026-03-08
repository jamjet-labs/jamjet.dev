<div align="center">

<!-- Pixel art lightning bolt logo -->
<svg width="80" height="96" viewBox="0 0 30 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="0"  width="5" height="4" fill="#f5c518"/>
  <rect x="15" y="0"  width="5" height="4" fill="#f5c518"/>
  <rect x="5"  y="4"  width="5" height="4" fill="#f5c518"/>
  <rect x="10" y="4"  width="5" height="4" fill="#f5c518"/>
  <rect x="15" y="4"  width="5" height="4" fill="#f5c518"/>
  <rect x="20" y="4"  width="5" height="4" fill="#f5c518"/>
  <rect x="10" y="8"  width="5" height="4" fill="#f5c518"/>
  <rect x="15" y="8"  width="5" height="4" fill="#f5c518"/>
  <rect x="0"  y="12" width="5" height="4" fill="#f5c518"/>
  <rect x="5"  y="12" width="5" height="4" fill="#f5c518"/>
  <rect x="10" y="12" width="5" height="4" fill="#f5c518"/>
  <rect x="15" y="12" width="5" height="4" fill="#f5c518"/>
  <rect x="5"  y="16" width="5" height="4" fill="#f5c518"/>
  <rect x="10" y="16" width="5" height="4" fill="#f5c518"/>
  <rect x="15" y="16" width="5" height="4" fill="#f5c518"/>
  <rect x="20" y="16" width="5" height="4" fill="#f5c518"/>
  <rect x="25" y="16" width="5" height="4" fill="#f5c518"/>
  <rect x="10" y="20" width="5" height="4" fill="#f5c518"/>
  <rect x="15" y="20" width="5" height="4" fill="#f5c518"/>
  <rect x="10" y="24" width="5" height="4" fill="#f5c518"/>
  <rect x="15" y="24" width="5" height="4" fill="#f5c518"/>
</svg>

# jamjet.dev

**The official website and documentation for [JamJet](https://github.com/jamjet-labs/jamjet) — the agent-native runtime.**

[![Deploy](https://github.com/jamjet-labs/jamjet.dev/actions/workflows/deploy.yml/badge.svg)](https://github.com/jamjet-labs/jamjet.dev/actions/workflows/deploy.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-f5c518?style=flat-square)](LICENSE)

[jamjet.dev](https://jamjet.dev) · [Docs](https://jamjet.dev/quickstart) · [Blog](https://jamjet.dev/blog)

</div>

---

## What's in this repo

| Path | Content |
|------|---------|
| `src/pages/index.astro` | Marketing landing page (jamjet.dev) |
| `src/content/docs/` | All documentation pages (Markdown/MDX) |
| `src/content/blog/` | Blog posts |
| `src/pages/examples.astro` | Example gallery |
| `public/` | Static assets, favicon, OG image, CNAME |
| `.github/workflows/deploy.yml` | GitHub Pages deployment |

## Stack

- **[Astro](https://astro.build)** — static site generator
- **[Starlight](https://starlight.astro.build)** — docs theme (built on Astro)
- **[Tailwind CSS](https://tailwindcss.com)** — utility-first styling
- **GitHub Pages** — hosting at `jamjet.dev`

## Local development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:4321

# Build for production
npm run build

# Preview production build
npm run preview
```

## Adding documentation

Docs live in `src/content/docs/`. Each `.md` or `.mdx` file becomes a page.

```markdown
---
title: My Guide
description: A one-line description for SEO.
sidebar:
  order: 3
---

# My Guide

Content here...
```

The sidebar is configured in `astro.config.mjs`.

## Writing a blog post

Create a file in `src/content/blog/`:

```markdown
---
title: "Announcing JamJet v0.1.0"
date: 2026-03-08
description: "The first public release of the agent-native runtime."
author: jamjet-team
---

Post content here...
```

## Deployment

This site deploys automatically to GitHub Pages on every push to `main`.

**Custom domain setup:**
1. DNS: Add `CNAME` record pointing `jamjet.dev` → `jamjet-labs.github.io`
2. GitHub: Settings → Pages → Custom domain → `jamjet.dev` → Enable HTTPS
3. The `public/CNAME` file handles the domain config automatically

## Contributing

Content fixes and improvements are welcome! For large changes, open an issue first.

For roadmap discussions and larger changes, open an issue or start a GitHub Discussion.

---

<div align="center">
  <sub>© 2026 JamJet — Apache 2.0 · <a href="https://jamjet.dev">jamjet.dev</a></sub>
</div>
