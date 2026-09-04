// @ts-check
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { defineConfig } from 'astro/config';

/**
 * Map of "/section/slug/" -> ISO date, read straight from the content files.
 *
 * The sitemap integration only sees URLs, and `astro:content` is a virtual
 * module that does not exist at config-load time, so the frontmatter is parsed
 * here directly. Drafts are skipped because they never reach the sitemap.
 */
const ENTRY_DATES = new Map();
for (const section of ['writing', 'travel', 'research', 'teaching', 'outreach', 'photography']) {
  const dir = `./src/content/${section}`;
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    try {
      const raw = readFileSync(`${dir}/${file}`, 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!m) continue;
      const fm = parseYaml(m[1]) ?? {};
      if (fm.draft === true) continue;
      const when = fm.updated ?? fm.date;
      if (!when) continue;
      ENTRY_DATES.set(`/${section}/${file.replace(/\.md$/, '')}/`, new Date(when).toISOString());
    } catch {}
  }
}
import sitemap from '@astrojs/sitemap';
import pruneOrphanAssets from './src/integrations/prune-orphan-assets.mjs';

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
    sitemap({
      filter: (page) => !page.includes('/admin'),
      // lastmod comes from each entry's own frontmatter, read from disk at
      // config load. Stamping the build time here instead would tell crawlers
      // that every page changed on every deploy, which is worse than omitting
      // it — so a URL with no known date simply gets no lastmod.
      serialize: (item) => {
        const key = new URL(item.url).pathname;
        const when = ENTRY_DATES.get(key);
        return when ? { ...item, lastmod: when } : item;
      },
    }),

    // Must come after everything that emits images.
    pruneOrphanAssets(),
  ],
});
