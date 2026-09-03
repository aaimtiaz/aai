#!/usr/bin/env node
/**
 * One-time import from a Facebook "Download Your Information" (DYI) export.
 *
 * Usage:
 *   node scripts/import-facebook.mjs --export "C:/path/to/unzipped-export" [--dry-run] [--limit 20]
 *
 * Scraping facebook.com directly is not viable (login wall, infinite scroll,
 * and it breaks Meta's terms). The DYI export is the supported route for your
 * own data and is complete and machine-readable.
 *
 * Everything it writes is `draft: true`. Nothing goes live from an automated
 * import — drafts render in `astro dev` so the whole thing is reviewable
 * locally, then you publish what is worth publishing.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { stringify } from 'yaml';
import sharp from 'sharp';

/* ------------------------------------------------------------------- args */

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const EXPORT_DIR = argOf('--export');
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number(argOf('--limit') ?? Infinity);

if (!EXPORT_DIR || !existsSync(EXPORT_DIR)) {
  console.error(`
Point this at your unzipped Facebook export:

  node scripts/import-facebook.mjs --export "C:/Users/you/Downloads/facebook-export"

Request it at: Settings -> Accounts Centre -> Your information and permissions
-> Download your information. Choose format JSON, media quality High, all time.

Keep the export OUTSIDE this repository — it contains private data.
`);
  process.exit(1);
}

/* --------------------------------------------------------------- encoding */

/**
 * Facebook double-encodes UTF-8 in its JSON export: Bengali arrives as
 * mojibake like "à¦¬" rather than readable text. Every string has to be
 * repaired on read or every Bengali post imports as garbage.
 */
const fixMojibake = (s) => {
  if (typeof s !== 'string') return s;
  try {
    const repaired = Buffer.from(s, 'latin1').toString('utf8');
    // Only accept the repair if it did not introduce replacement characters.
    return repaired.includes('\uFFFD') ? s : repaired;
  } catch {
    return s;
  }
};

const deepFix = (v) => {
  if (typeof v === 'string') return fixMojibake(v);
  if (Array.isArray(v)) return v.map(deepFix);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepFix(x)]));
  }
  return v;
};

/* ----------------------------------------------------------------- helpers */

const BENGALI = /[\u0980-\u09FF]/;
const detectLang = (t) => (BENGALI.test(t) ? 'bn' : 'en');

function guessForm(body) {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return 'prose';
  return lines.filter((l) => l.length < 60).length / lines.length > 0.7 ? 'poem' : 'prose';
}

function slugify(title, ts) {
  const ascii = title.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  if (ascii.length >= 3) return ascii;
  const stem = BENGALI.test(title) ? 'lekha' : 'post';
  return `${stem}-${new Date(ts * 1000).toISOString().slice(0, 10)}`;
}

/** Recursively collect .json files under a directory. */
function walkJson(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkJson(p, out);
    else if (extname(name) === '.json') out.push(p);
  }
  return out;
}

function findMedia(root, uri) {
  if (!uri) return null;
  const direct = join(root, uri);
  if (existsSync(direct)) return direct;
  // Exports vary in how deeply media is nested; fall back to a basename match.
  const target = basename(uri);
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) stack.push(p);
      else if (name === target) return p;
    }
  }
  return null;
}

/* ------------------------------------------------------------ read export */

console.log(`Reading export: ${EXPORT_DIR}`);
const jsonFiles = walkJson(EXPORT_DIR);
console.log(`  ${jsonFiles.length} JSON files found`);

const posts = [];
for (const file of jsonFiles) {
  const name = basename(file).toLowerCase();
  // your_posts_1.json, your_posts__check_ins__photos_and_videos_1.json, notes, albums
  if (!/post|note|album/.test(name)) continue;

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    continue;
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : parsed.posts ?? parsed.notes ?? (parsed.photos ? [parsed] : []);
  if (!Array.isArray(entries)) continue;

  for (const raw of entries) {
    const e = deepFix(raw);

    // Only the author's own words. `tags`, comments and reaction lists are
    // other people's data and are never carried across.
    const text =
      e.data?.map((d) => d.post).filter(Boolean).join('\n\n') ??
      e.text ??
      e.description ??
      '';

    const media = (e.attachments ?? [])
      .flatMap((a) => a.data ?? [])
      .map((d) => d.media)
      .filter(Boolean);
    const photos = (e.photos ?? []).concat(media);

    const ts = e.timestamp ?? e.creation_timestamp ?? photos[0]?.creation_timestamp;
    if (!text.trim() && photos.length === 0) continue;
    if (!ts) continue;

    posts.push({
      ts,
      title: (e.title ?? '').trim(),
      text: text.trim(),
      photos,
      place: e.data?.find?.((d) => d.place)?.place?.name ?? e.place?.name ?? null,
      source: basename(file),
    });
  }
}

console.log(`  ${posts.length} candidate posts`);

/* -------------------------------------------------------------- classify */

const CLASSIFY = (p) => {
  if (p.place && p.photos.length >= 2) return 'travel';
  if (p.photos.length >= 3) return 'travel';
  if (p.text.length >= 200) return 'writing';
  if (p.text.length >= 60) return 'writing';
  return null; // ambiguous -> review queue, never guessed into a collection
};

const review = [];
const chosen = [];
for (const p of posts) {
  const c = CLASSIFY(p);
  if (c) chosen.push({ ...p, collection: c });
  else review.push(p);
}

chosen.sort((a, b) => b.ts - a.ts);
const toWrite = chosen.slice(0, LIMIT);

console.log(`  ${chosen.length} classified, ${review.length} sent to the review queue`);

/* ----------------------------------------------------------------- write */

let written = 0, skipped = 0, imgBefore = 0, imgAfter = 0;

for (const p of toWrite) {
  const date = new Date(p.ts * 1000);
  const firstLine = (p.text.split('\n').find((l) => l.trim()) ?? '').trim();
  const title = p.title || firstLine.slice(0, 70) || `Post ${date.toISOString().slice(0, 10)}`;
  const slug = slugify(title, p.ts);

  const dir = `src/content/${p.collection}`;
  const mdPath = `${dir}/${slug}.md`;

  // Idempotent: re-running after tweaking the heuristics must not duplicate.
  if (existsSync(mdPath)) { skipped++; continue; }

  let cover;
  const photo = p.photos[0];
  if (photo?.uri) {
    const src = findMedia(EXPORT_DIR, photo.uri);
    if (src) {
      const outDir = `${dir}/images`;
      const outPath = `${outDir}/${slug}.webp`;
      if (!DRY_RUN) {
        mkdirSync(outDir, { recursive: true });
        const meta = await sharp(src).metadata();
        let pipe = sharp(src).rotate();               // honour EXIF orientation
        if (Math.max(meta.width, meta.height) > 2400) {
          pipe = pipe.resize({
            width: meta.width >= meta.height ? 2400 : null,
            height: meta.height > meta.width ? 2400 : null,
            withoutEnlargement: true,
          });
        }
        await pipe.webp({ quality: 82 }).toFile(outPath);
        imgBefore += statSync(src).size;
        imgAfter += statSync(outPath).size;
      }
      cover = `./images/${slug}.webp`;
    }
  }

  const lang = detectLang(p.text || title);
  const data = {
    title,
    date: date.toISOString().slice(0, 10),
    lang,
    ...(p.collection === 'writing' ? { form: guessForm(p.text) } : {}),
    ...(p.collection === 'travel' && p.place ? { location: { name: p.place } } : {}),
    ...(cover ? { cover, coverAlt: '' } : {}),
    excerpt: firstLine.slice(0, 160),
    tags: [],
    // Never live from an automated import. You curate, then publish.
    draft: true,
    source: 'facebook',
  };

  const file = `---\n${stringify(data, { lineWidth: 0 })}---\n\n${p.text.trim()}\n`;
  if (!DRY_RUN) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(mdPath, file, 'utf8');   // UTF-8, no BOM
  }
  written++;
  console.log(`  ${DRY_RUN ? '[dry] ' : ''}${mdPath}  (${lang}, ${p.collection})`);
}

if (review.length && !DRY_RUN) {
  const queue = review.map((p) => ({
    date: new Date(p.ts * 1000).toISOString().slice(0, 10),
    photos: p.photos.length,
    place: p.place,
    text: p.text.slice(0, 300),
  }));
  writeFileSync('facebook-review-queue.json', JSON.stringify(queue, null, 2), 'utf8');
}

const kb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`
Done.
  written  ${written}
  skipped  ${skipped} (already existed)
  review   ${review.length}${review.length && !DRY_RUN ? ' -> facebook-review-queue.json' : ''}
  images   ${imgBefore ? `${kb(imgBefore)} -> ${kb(imgAfter)}` : 'none'}

Everything landed as draft: true. Run "npm run dev" to read them, fix any
misclassification, then publish the good ones from /admin/.
`);
