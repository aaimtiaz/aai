import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

/**
 * Delete built images that nothing in the site points at.
 *
 * `image()` in a content schema resolves and emits every referenced file at
 * frontmatter-parse time, before any page decides whether to render. So a
 * draft entry is removed from the site while its photographs are still
 * written to dist/_astro/ and served at a guessable-once-known hashed URL.
 *
 * That is not a size problem, it is a permissions one: an entry withdrawn
 * because its photographs need their owner's consent stays withdrawn only if
 * the images go too. Anything the built HTML, CSS, JS or feeds do not
 * reference cannot be reached by a visitor, so removing it changes nothing
 * about the site and closes the leak.
 *
 * Deliberately narrow: images inside _astro/ only. Scripts and stylesheets
 * are left alone because they can be pulled in dynamically, and public/ is
 * copied verbatim and is meant to be reachable directly.
 */

const IMAGE_EXT = new Set(['.webp', '.avif', '.png', '.jpg', '.jpeg', '.gif', '.svg']);
const TEXT_EXT = new Set(['.html', '.css', '.js', '.mjs', '.xml', '.json', '.txt', '.map']);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

export default function pruneOrphanAssets() {
  return {
    name: 'prune-orphan-assets',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = dir.pathname.replace(/^\/([A-Za-z]:)/, '$1');
        const files = await walk(root);

        // One haystack of everything a browser could read a URL out of.
        const haystack = (
          await Promise.all(
            files
              .filter((f) => TEXT_EXT.has(extname(f).toLowerCase()))
              .map((f) => readFile(f, 'utf8').catch(() => '')),
          )
        ).join('\n');

        const candidates = files.filter(
          (f) => f.includes('_astro') && IMAGE_EXT.has(extname(f).toLowerCase()),
        );

        let removed = 0;
        let bytes = 0;
        for (const f of candidates) {
          const name = basename(f);
          if (haystack.includes(name)) continue;
          bytes += (await stat(f)).size;
          await unlink(f);
          removed++;
        }

        if (removed) {
          logger.info(
            `pruned ${removed} unreferenced image${removed === 1 ? '' : 's'} ` +
              `(${(bytes / 1024 / 1024).toFixed(1)} MB) — drafts do not ship their photographs`,
          );
        }
      },
    },
  };
}
