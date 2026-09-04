#!/usr/bin/env node
/**
 * Seed the photography collection from the Facebook export.
 *
 *   node scripts/seed-photography.mjs --export "D:/fb-export" [--dry-run]
 *
 * Separate from import-facebook.mjs on purpose. That script sweeps everything
 * and classifies; this one is a hand-picked list of the sets where the
 * photograph is the point rather than an illustration of a status update.
 * Curation is the whole value of a photography page, so it is explicit here
 * rather than inferred by a heuristic.
 *
 * Everything is written as draft: true. Nothing published automatically.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import sharp from 'sharp';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const EXPORT_DIR = argOf('--export');
const DRY_RUN = args.includes('--dry-run');

if (!EXPORT_DIR || !existsSync(EXPORT_DIR)) {
  console.error('\nPoint at the unzipped export:\n  node scripts/seed-photography.mjs --export "D:/fb-export"\n');
  process.exit(1);
}

const POSTS = 'your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json';

/* Same encoding repair as the main importer — the export double-encodes UTF-8. */
function repairEncoding(s) {
  if (typeof s !== 'string' || !s.length) return s;
  let high = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0xff) return s;
    if (c > 0x7f) high = true;
  }
  if (!high) return s;
  try {
    const out = Buffer.from(s, 'latin1').toString('utf8');
    return out.includes('\uFFFD') ? s : out;
  } catch { return s; }
}
const deep = (v) =>
  typeof v === 'string' ? repairEncoding(v)
  : Array.isArray(v) ? v.map(deep)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))
  : v;

const tidy = (s) => String(s ?? '').normalize('NFKC').replace(/\u200b|\ufeff/g, '').replace(/\r\n?/g, '\n').trim();

/** Strip identifiers, same rules as the main importer. */
const REDACT = [
  /https?:\/\/(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/\S+/gi,
  /@\[\d+:\d*:[^\]]*\]/g,
  /[\w.+-]+@[\w-]+\.[\w.]{2,}/g,
  /(?:\+?88)?0?1[3-9]\d{8,10}\b/g,
  /\b\d{10,}\b/g,
];
const redact = (t) => REDACT.reduce((s, re) => s.replace(re, ''), t)
  .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

function creditFrom(desc) {
  if (!desc) return undefined;
  const text = redact(tidy(desc));
  const m = text.match(/(?:P\s*)?©\s*([^\n,|]{2,60})/)
    ?? text.match(/(?:ফটো\s*ক্রেডিট|photo\s*credit|pc)\s*[:：(]\s*([^\n,|)]{2,60})/i);
  if (!m) return undefined;
  const who = m[1].replace(/[\uFE0F\u200D]/g, '').replace(/^[\s:：.\-–—]+|[\s:：.\-–—]+$/g, '').trim();
  if (!who || who.length < 2 || /[\[\]<>]|https?:|\d/.test(who) || who.split(/\s+/).length > 6) return undefined;
  return `Photograph: ${who}`;
}

/**
 * The curated list. Each entry names a post by date window and a phrase that
 * must appear, so it cannot silently latch onto the wrong post if the export
 * is regenerated.
 *
 * Deliberately absent: the Saint Martin's set, because nine of its eleven
 * photographs are other people's work and that is unresolved; and the
 * AI-generated sketch, which is not a photograph.
 */
const SETS = [
  {
    slug: 'why-do-people-take-photographs',
    title: 'Why do people take photographs?',
    series: 'On foot',
    place: 'Sylhet',
    from: '2025-06-18', to: '2025-06-25',
    match: /why do people take photographs/i,
    max: 8,
    intro: 'Bichanakandi, Jaflong and Ratargul Swamp Forest, over three days in May 2025 — about 26 km of it on foot.',
  },
  {
    slug: 'the-darkest-part-of-the-ride',
    title: 'The darkest part of the ride',
    series: 'Night sky',
    place: 'Bangladesh',
    from: '2022-09-24', to: '2022-09-30',
    match: /witness beauty and mystery/i,
    max: 6,
    intro: 'To see a night sky properly you have to ride out to the darkest stretch you can find and lie down in it.',
  },
  {
    slug: 'one-hundred-and-fifteen-kilometres',
    title: 'One hundred and fifteen kilometres',
    series: 'By bicycle',
    place: 'Sylhet',
    from: '2023-01-28', to: '2023-02-03',
    match: /cycle_ride|jaintapur/i,
    max: 6,
    intro: 'Jaintapur, January 2023. "Beautiful things don\'t ask for attention."',
  },
  {
    slug: 'north-in-three-days',
    title: 'North, in three days',
    series: 'By bicycle',
    place: 'Northern Bangladesh',
    from: '2024-12-28', to: '2025-01-03',
    match: /panchagarh|nilphamari/i,
    max: 6,
    intro: 'Panchagarh to Sherpur, about 330 km, in the fog of late December.',
  },
  {
    slug: 'kites-over-the-padma',
    title: 'Kites over the Padma',
    series: 'By the river',
    place: 'Munshiganj',
    from: '2025-03-05', to: '2025-03-12',
    match: /munshiganj|bhagyakul/i,
    max: 6,
    intro: 'A day by the Padma, watching kites fly like aircraft and hunt along the bank.',
  },
];

/* ------------------------------------------------------------------ run */

const posts = deep(JSON.parse(readFileSync(join(EXPORT_DIR, POSTS), 'utf8')));
const inWindow = (ts, s) => {
  const d = new Date(ts * 1000).toISOString().slice(0, 10);
  return d >= s.from && d <= s.to;
};

let written = 0, images = 0, before = 0, after = 0;

for (const set of SETS) {
  const dir = 'src/content/photography';
  const mdPath = `${dir}/${set.slug}.md`;
  if (existsSync(mdPath)) { console.log(`  skip (exists): ${set.slug}`); continue; }

  const post = posts.find((e) => {
    const body = (e.data ?? []).map((d) => d?.post).filter(Boolean).join('\n');
    return e.timestamp && inWindow(e.timestamp, set) && set.match.test(body);
  });
  if (!post) { console.warn(`  ! no post matched: ${set.slug}`); continue; }

  const photos = (post.attachments ?? [])
    .flatMap((a) => a?.data ?? [])
    .map((d) => d?.media)
    .filter((m) => m?.uri && /\.(jpe?g|png|webp)$/i.test(m.uri))
    .slice(0, set.max);

  const gallery = [];
  for (const [i, photo] of photos.entries()) {
    const src = join(EXPORT_DIR, photo.uri);
    if (!existsSync(src)) continue;
    const name = `${set.slug}-${String(i + 1).padStart(2, '0')}.webp`;
    if (!DRY_RUN) {
      mkdirSync(`${dir}/images`, { recursive: true });
      const meta = await sharp(src).metadata();
      let pipe = sharp(src).rotate();
      if (Math.max(meta.width, meta.height) > 1800) {
        pipe = pipe.resize({
          width: meta.width >= meta.height ? 1800 : null,
          height: meta.height > meta.width ? 1800 : null,
          withoutEnlargement: true,
        });
      }
      await pipe.webp({ quality: 82 }).toFile(`${dir}/images/${name}`);
      before += statSync(src).size;
      after += statSync(`${dir}/images/${name}`).size;
    }
    const caption = redact(tidy(photo.description ?? ''));
    gallery.push({
      name,
      // A caption that just repeats the post body is noise; only keep short ones.
      caption: caption && caption.length < 90 ? caption : undefined,
      credit: creditFrom(photo.description),
    });
    images++;
  }
  if (!gallery.length) { console.warn(`  ! no usable images: ${set.slug}`); continue; }

  const [cover, ...rest] = gallery;
  const data = {
    title: set.title,
    date: new Date(post.timestamp * 1000).toISOString().slice(0, 10),
    series: set.series,
    location: { name: set.place },
    cover: `./images/${cover.name}`,
    coverAlt: `${set.title} — ${set.place}`,
    ...(cover.caption ? { coverCaption: cover.caption } : {}),
    ...(cover.credit ? { coverCaption: cover.credit } : {}),
    gallery: rest.map((g) => ({
      src: `./images/${g.name}`,
      alt: `${set.place}`,
      ...(g.caption ? { caption: g.caption } : {}),
      ...(g.credit ? { credit: g.credit } : {}),
    })),
    excerpt: set.intro,
    tags: ['photography'],
    draft: true,
    source: 'facebook',
  };

  if (!DRY_RUN) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(mdPath, `---\n${stringify(data, { lineWidth: 0 })}---\n\n${set.intro}\n`, 'utf8');
  }
  written++;
  console.log(`  ${set.slug.padEnd(36)} ${gallery.length} photographs`);
}

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`
${DRY_RUN ? 'DRY RUN — nothing written.' : 'Done.'}
  sets      ${written}
  images    ${images}${before ? `   ${mb(before)} -> ${mb(after)}` : ''}

All drafts. Publish from /admin/.
`);
