// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Update to the custom domain at cutover (Phase 7).
  site: 'https://aaimtiaz.github.io',
  output: 'static',

  // Cloudflare Pages canonicalises toward trailing slashes and serves
  // /about/index.html as /about/. Matching that here keeps canonical URLs,
  // sitemap entries and RSS links identical to what is actually served,
  // and avoids a redirect hop on every internal link.
  trailingSlash: 'always',
  build: { format: 'directory' },

  // Set globally so even Markdown body images get srcset/width/height.
  // This is what stops a 4MB upload from ever reaching a visitor again.
  image: {
    layout: 'constrained',
    responsiveStyles: true,
    breakpoints: [320, 480, 640, 768, 1024, 1280, 1600, 2048],
  },

  // NOTE: no custom Markdown processor. Astro 7's default (Satteri) emits a
  // literal newline for a CommonMark soft break, so scoping
  // `white-space: pre-line` to writing bodies reproduces the old rendering
  // exactly — same result as remark-breaks, one less dependency, and it keeps
  // the faster default pipeline. (@astrojs/markdown-remark@7.3.0 is also
  // currently broken: it imports astro/_internal/logger, which astro@7.3.0
  // does not export.)

  integrations: [
    sitemap({ filter: (page) => !page.includes('/admin') }),
  ],
});
