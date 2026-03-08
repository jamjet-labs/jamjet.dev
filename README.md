<div align="center">

# jamjet.dev

**The official website and documentation for [JamJet](https://github.com/jamjet-labs/jamjet) — the agent-native runtime.**

[![Deploy](https://github.com/jamjet-labs/jamjet.dev/actions/workflows/deploy.yml/badge.svg)](https://github.com/jamjet-labs/jamjet.dev/actions/workflows/deploy.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-8b7355?style=flat-square)](LICENSE)

[jamjet.dev](https://jamjet.dev) · [Docs](https://jamjet.dev/quickstart) · [Blog](https://jamjet.dev/blog)

</div>

---

## Design Philosophy

The site follows four Japanese aesthetic principles that guide every visual and structural decision:

### Ma (間) — Negative Space

Ma is the intentional emptiness between elements. In Japanese art and architecture, what you *leave out* matters as much as what you put in. The void isn't absence — it's breathing room that gives meaning to what surrounds it.

**How we apply it:** 120px section spacing, generous padding, minimal content per viewport. The homepage has only four sections. Every element has room to breathe.

### Kanso (簡素) — Simplicity

Kanso means eliminating clutter and ornamentation to reveal the essential form. It's not minimalism for its own sake — it's the discipline of removing everything that doesn't serve the user's understanding.

**How we apply it:** No pixel grids, no glow effects, no gradient backgrounds, no decorative animations. Navigation has four items, not six. The shared `BaseLayout` eliminates duplication. If something doesn't help the visitor understand JamJet, it's removed.

### Shibui (渋い) — Understated Elegance

Shibui describes beauty that is subtle and unobtrusive — refined without being flashy. Objects with shibui reveal their depth over time rather than demanding attention on first glance. Think handmade ceramics, not neon signs.

**How we apply it:** Warm neutral palette (`#fafaf8` background, `#8b7355` earth accent) instead of bold yellow on black. Font weights 600–700 instead of 800–900. Muted hover states that shift border color rather than scaling or glowing. Colors that feel natural and grounded.

### Seijaku (静寂) — Stillness

Seijaku is energized calm — the tranquility found in a garden after rain. It's not lifelessness, but a composed presence that allows focus. Seijaku in design means the interface stays quiet and lets content speak.

**How we apply it:** No pulse animations, no translateY hover effects, no backdrop blur. Transitions are limited to subtle color shifts (0.15s–0.2s). The page doesn't move unless the user initiates it.

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#fafaf8` | Page background |
| `--bg-alt` | `#f5f4f0` | Alternating sections |
| `--bg-code` | `#2a2a28` | Code blocks (dark) |
| `--text` | `#1a1a18` | Headings, primary text |
| `--text-secondary` | `#6b6b63` | Body copy |
| `--text-muted` | `#8b8578` | Labels, captions |
| `--accent` | `#8b7355` | Warm earth accent |
| `--accent-hover` | `#c4956a` | Terracotta hover state |
| `--border` | `rgba(26,26,24,0.08)` | Subtle dividers |

## Project Structure

| Path | Content |
|------|---------|
| `src/layouts/BaseLayout.astro` | Shared nav + footer + meta tags |
| `src/styles/base.css` | Global marketing page styles |
| `src/styles/global.css` | Starlight docs overrides |
| `src/pages/index.astro` | Landing page |
| `src/pages/examples.astro` | Example gallery |
| `src/pages/usecases.astro` | Use cases + A2A case study |
| `src/pages/benchmarks.astro` | Performance benchmarks |
| `src/pages/blog/` | Blog index, posts, pagination |
| `src/content/docs/` | Documentation (Markdown/MDX) |
| `src/content/blog/` | Blog post content |
| `public/` | Static assets, favicon, OG image, CNAME |

## Stack

- **[Astro](https://astro.build)** — static site generator
- **[Starlight](https://starlight.astro.build)** — docs theme
- **[Tailwind CSS](https://tailwindcss.com)** — utility styling
- **GitHub Pages** — hosting at `jamjet.dev`

## Local Development

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # production build
npm run preview    # preview production build
```

## Adding Documentation

Docs live in `src/content/docs/`. Each `.md` or `.mdx` file becomes a page.

```markdown
---
title: My Guide
description: A one-line description for SEO.
sidebar:
  order: 3
---

Content here...
```

The sidebar is configured in `astro.config.mjs`.

## Writing a Blog Post

Create a file in `src/content/blog/`:

```markdown
---
title: "Post Title"
date: 2026-03-08
description: "One-line summary."
author: jamjet-team
---

Post content here...
```

## Deployment

Deploys automatically to GitHub Pages on push to `main`.

**Custom domain:** DNS `CNAME` record `jamjet.dev` → `jamjet-labs.github.io`. The `public/CNAME` file handles domain config.

## Contributing

Content fixes and improvements are welcome. For large changes, open an issue first.

---

<div align="center">
  <sub>© 2026 JamJet — Apache 2.0 · <a href="https://jamjet.dev">jamjet.dev</a></sub>
</div>
