#!/usr/bin/env node
/**
 * One-time import from a Facebook "Download Your Information" (DYI) export.
 *
 *   node scripts/import-facebook.mjs --export "D:/fb-export" [--dry-run] [--limit N]
 *
 * Everything it writes is `draft: true`. Nothing goes live from an automated
 * import — drafts render in `astro dev` so the whole thing is reviewable, then
 * the owner publishes what is worth publishing from /admin/.
 *
 * PRIVACY DESIGN
 * --------------
 * This reads an ALLOWLIST of seven files, not "whatever looks like posts".
 * The archive also contains the owner's uploaded phone contacts, device
 * fingerprints, home location, and story-reaction data naming other people.
 * A blocklist would be one forgotten filename away from leaking those.
 *
 * Within the allowed files it keeps only the owner's own words. Tagged people,
 * comments, reactions, EXIF (which carries 453 real upload IP addresses) and
 * place coordinates are all dropped — never written, not even to a temp file.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { stringify } from 'yaml';
import sharp from 'sharp';

/* ------------------------------------------------------------------- args */

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const EXPORT_DIR = argOf('--export');
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number(argOf('--limit') ?? Infinity);

if (!EXPORT_DIR || !existsSync(EXPORT_DIR)) {
  console.error(`
Point this at your unzipped Facebook export, which must live OUTSIDE this repo:

  node scripts/import-facebook.mjs --export "D:/fb-export" --dry-run
`);
  process.exit(1);
}

/** The only files this script is permitted to open. */
const POSTS_FILE = 'your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json';
const ARCHIVE_FILE = 'your_facebook_activity/posts/archive.json';
const ALBUM_FILES = [4, 5, 6, 8, 9].map((n) => `your_facebook_activity/posts/album/${n}.json`);

/* --------------------------------------------------------------- encoding */

/**
 * Facebook double-encodes UTF-8 in its export: Bengali arrives as the byte
 * sequence of its UTF-8 form, one byte per codepoint. "\u00e0\u00a6\u0995"
 * is really E0 A6 95 = কালকে's first character.
 *
 * Node's 'latin1' is true ISO-8859-1 (unlike Python's cp1252, which throws on
 * U+0081/8D/8F/90/9D — all of which occur here), so the round trip is safe.
 *
 * Two guards, because Buffer.from(s,'latin1') silently truncates anything
 * above U+00FF and would corrupt correctly-encoded text:
 *   1. every codepoint must be <= 0xFF before attempting the repair
 *   2. the result must not contain U+FFFD
 */
function repairEncoding(s) {
  if (typeof s !== 'string' || s.length === 0) return s;
  let hasHighByte = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0xff) return s;          // already real Unicode — leave it alone
    if (c > 0x7f) hasHighByte = true;
  }
  if (!hasHighByte) return s;        // pure ASCII: round trip is a no-op
  try {
    const out = Buffer.from(s, 'latin1').toString('utf8');
    return out.includes('\uFFFD') ? s : out;
  } catch {
    return s;
  }
}

/** EXIF is stripped here rather than at write time, so IP addresses never
 *  reach any later stage of the pipeline. */
const DROP_KEYS = new Set([
  'media_metadata', 'exif_data', 'upload_ip', 'tags', 'coordinate',
  'address', 'url', 'external_context', 'life_event', 'event',
]);

function clean(v) {
  if (typeof v === 'string') return repairEncoding(v);
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (DROP_KEYS.has(k)) continue;
      out[k] = clean(x);
    }
    return out;
  }
  return v;
}

const readJson = (rel) => {
  const p = join(EXPORT_DIR, rel);
  if (!existsSync(p)) { console.warn(`  (missing: ${rel})`); return null; }
  return clean(JSON.parse(readFileSync(p, 'utf8')));
};

/* ---------------------------------------------------------------- helpers */

const BENGALI = /[\u0980-\u09FF]/;
const detectLang = (t) => (BENGALI.test(t) ? 'bn' : 'en');

/** Short lines dominating reads as verse rather than prose. */
function guessForm(body) {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return 'prose';
  return lines.filter((l) => l.length < 55).length / lines.length > 0.75 ? 'poem' : 'prose';
}

/**
 * Prose only. Facebook posts use a single newline where a paragraph break is
 * meant, and a single newline in Markdown collapses to a space. Promoting each
 * line to its own paragraph preserves the author's intended breaks AND lets
 * each paragraph justify — a hard break would suppress justification.
 */
const normaliseProse = (body) =>
  body.split('\n').map((l) => l.trim()).filter(Boolean).join('\n\n');

/** Strip zero-width joiners and the like that survive the encoding repair. */
const tidy = (s) => s.replace(/\u200b|\ufeff/g, '').replace(/\r\n?/g, '\n').trim();

/**
 * Redaction pass over post bodies.
 *
 * Stripping `tags` removes people Facebook recorded structurally, but a post
 * body can still name and link them in plain text. A first run produced a slug
 * ending `...people-of-100070279` \u2014 a Facebook profile id, lifted straight out
 * of a pasted profile URL. These patterns are the ones that identify a person
 * or an account rather than a place or a public page.
 */
let redactions = 0;
const REDACT = [
  // Facebook profile / permalink URLs, including numeric profile.php ids.
  /https?:\/\/(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/\S+/gi,
  // Inline mention markup: @[100070279123456:0:Name]
  /@\[\d+:\d*:[^\]]*\]/g,
  // Email addresses.
  /[\w.+-]+@[\w-]+\.[\w.]{2,}/g,
  // Bangladeshi mobile numbers, with or without country code. The range is
  // 8-10 trailing digits, not a fixed 8: mobile-banking accounts (Rocket)
  // append a checksum digit, and a fixed-length pattern let two 12-digit
  // Rocket numbers through on the first run.
  /(?:\+?88)?0?1[3-9]\d{8,10}\b/g,
  // Any bare run of 10+ digits left in a payment context.
  /\b\d{10,}\b/g,
];

function redact(text) {
  let out = text;
  for (const re of REDACT) {
    out = out.replace(re, () => { redactions++; return ''; });
  }
  // Collapse the whitespace the removals leave behind.
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function titleFrom(body) {
  const firstLine = body.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  // Prefer a sentence boundary; Bengali uses । (danda) as its full stop.
  const m = firstLine.match(/^(.{10,70}?)(?:[।.!?]|$)/);
  const t = (m ? m[1] : firstLine).trim();
  return t.length > 70 ? t.slice(0, 67).trimEnd() + '…' : t;
}

const usedSlugs = new Set();

/** `hint` lets albums borrow the romanised name Facebook already used for the
 *  media directory \u2014 "\u09b9\u09b0\u09b7\u09aa\u09c1\u09b0" ships its photos under `harasapura_1880737...`,
 *  which beats falling back to a dateless `lekha-` stem. */
function slugify(title, ts, hint) {
  const toAscii = (s) => s.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2018\u2019"]/g, '')     // cox's bazar -> coxs-bazar, not cox-s-bazar
    .replace(/\d{6,}/g, '')     // never let an account id become a URL
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  let base = toAscii(title);
  if (base.length < 4 && hint) base = toAscii(hint);
  if (base.length < 4) {
    const day = new Date(ts * 1000).toISOString().slice(0, 10);
    base = `${BENGALI.test(title) ? 'lekha' : 'post'}-${day}`;
  }
  // Same-day Bengali posts would otherwise collide.
  let slug = base, n = 2;
  while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
  usedSlugs.add(slug);
  return slug;
}

function findMedia(uri) {
  if (!uri) return null;
  const p = join(EXPORT_DIR, uri);
  return existsSync(p) ? p : null;
}

let imgBefore = 0, imgAfter = 0, imgSkipped = 0;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;

/** Albums mix in videos and the occasional unreadable file. One bad input
 *  must not abort an import that is most of the way through. Returns false
 *  when the file was skipped so the caller can leave it out of the gallery. */
async function writeImage(src, destPath) {
  if (!IMAGE_EXT.test(src)) { imgSkipped++; return false; }
  try {
    const meta = await sharp(src).metadata();
    let pipe = sharp(src).rotate();                     // honour EXIF orientation
    if (Math.max(meta.width, meta.height) > 2000) {
      pipe = pipe.resize({
        width: meta.width >= meta.height ? 2000 : null,
        height: meta.height > meta.width ? 2000 : null,
        withoutEnlargement: true,
      });
    }
    await pipe.webp({ quality: 80 }).toFile(destPath);
    imgBefore += statSync(src).size;
    imgAfter += statSync(destPath).size;
    return true;
  } catch (err) {
    console.warn(`  ! skipped unreadable image ${basename(src)}: ${err.message}`);
    imgSkipped++;
    return false;
  }
}

/* ------------------------------------------------------------ read posts */

console.log(`Reading export: ${EXPORT_DIR}`);
const candidates = [];

// 1. Timeline posts.
const posts = readJson(POSTS_FILE) ?? [];
for (const e of posts) {
  // `data` is an array of single-key dicts; the body is whichever has `post`.
  const body = redact(tidy((e.data ?? []).map((d) => d?.post).filter(Boolean).join('\n\n')));
  if (!body) continue;                                 // photo-only shares add nothing
  const ts = e.timestamp;
  if (!ts) continue;
  const photos = (e.attachments ?? [])
    .flatMap((a) => a?.data ?? [])
    .map((d) => d?.media)
    .filter((m) => m?.uri);
  // Keep the place NAME only — coordinates and address were already dropped.
  const place = (e.data ?? []).map((d) => d?.place?.name).find(Boolean) ?? null;
  candidates.push({ ts, body, photos, place, kind: 'post' });
}
console.log(`  ${candidates.length} timeline posts with text`);

// 2. Never-published drafts. Different shape: label/value pairs.
const archive = readJson(ARCHIVE_FILE);
const archiveList = Array.isArray(archive) ? archive : archive?.archived_posts_v2 ?? [];
let archiveCount = 0;
for (const e of archiveList) {
  const body = redact(tidy(
    (e.label_values ?? []).filter((l) => l?.label === 'Message').map((l) => l.value).filter(Boolean).join('\n\n'),
  ));
  if (!body || !e.timestamp) continue;
  candidates.push({ ts: e.timestamp, body, photos: [], place: null, kind: 'archive' });
  archiveCount++;
}
console.log(`  ${archiveCount} unpublished drafts from archive.json`);

// 3. Travel albums -> one gallery post each.
const albums = [];
for (const rel of ALBUM_FILES) {
  const a = readJson(rel);
  if (!a?.photos?.length) continue;
  const stamps = a.photos.map((p) => p.creation_timestamp).filter(Boolean).sort();
  albums.push({
    name: tidy(a.name ?? basename(rel)),
    ts: stamps[0] ?? Date.now() / 1000,
    endTs: stamps[stamps.length - 1] ?? null,
    photos: a.photos.filter((p) => p.uri),
    description: tidy(a.description ?? ''),
  });
}
console.log(`  ${albums.length} travel albums`);

/* ------------------------------------------------------------- dedupe */

const seen = new Set();
const unique = [];
for (const c of candidates.sort((a, b) => b.ts - a.ts)) {
  const key = c.body.replace(/\s+/g, ' ').slice(0, 200);
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(c);
}
console.log(`  ${unique.length} after dedupe (${candidates.length - unique.length} duplicates dropped)`);

/* -------------------------------------------------------------- write */

let written = 0, skipped = 0, withCover = 0;
const LONG = 800;   // only long-form posts earn a cover image; see note below

for (const c of unique.slice(0, LIMIT)) {
  const form = guessForm(c.body);
  const body = form === 'poem' ? c.body : normaliseProse(c.body);
  const title = titleFrom(c.body);
  if (!title) continue;

  const slug = slugify(title, c.ts);
  const dir = 'src/content/writing';
  const mdPath = `${dir}/${slug}.md`;
  if (existsSync(mdPath)) { skipped++; continue; }

  // Media policy is deliberately restrictive: deleted images stay in git
  // history forever, and most of these drafts will be deleted. Only long-form
  // posts get a cover; anything else can have one added later from /admin/.
  let cover;
  if (c.body.length >= LONG && c.photos[0]) {
    const src = findMedia(c.photos[0].uri);
    if (src) {
      let ok = true;
      if (!DRY_RUN) {
        mkdirSync(`${dir}/images`, { recursive: true });
        ok = await writeImage(src, `${dir}/images/${slug}.webp`);
      }
      // Only reference the cover if it really landed, or the build fails on a
      // frontmatter image() pointing at a file that does not exist.
      if (ok) { cover = `./images/${slug}.webp`; withCover++; }
    }
  }

  const data = {
    title,
    date: new Date(c.ts * 1000).toISOString().slice(0, 10),
    lang: detectLang(c.body),
    form,
    ...(cover ? { cover, coverAlt: '' } : {}),
    excerpt: tidy(c.body).replace(/\s+/g, ' ').slice(0, 150),
    tags: c.kind === 'archive' ? ['unpublished'] : [],
    draft: true,                 // never live from an automated import
    source: 'facebook',
  };

  if (!DRY_RUN) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(mdPath, `---\n${stringify(data, { lineWidth: 0 })}---\n\n${body}\n`, 'utf8');
  }
  written++;
}

/* --------------------------------------------------------- write albums */

let albumsWritten = 0, galleryImages = 0;
for (const a of albums) {
  // media/harasapura_1880737222181506/... -> "harasapura"
  const mediaHint = (a.photos[0]?.uri ?? '').split('/').at(-2)?.replace(/_\d+$/, '');
  const slug = slugify(a.name, a.ts, mediaHint);
  const dir = 'src/content/travel';
  const mdPath = `${dir}/${slug}.md`;
  if (existsSync(mdPath)) { skipped++; continue; }

  const gallery = [];
  for (const [i, photo] of a.photos.entries()) {
    const src = findMedia(photo.uri);
    if (!src) continue;
    const name = `${slug}-${String(i + 1).padStart(2, '0')}.webp`;
    let ok = true;
    if (!DRY_RUN) {
      mkdirSync(`${dir}/images`, { recursive: true });
      ok = await writeImage(src, `${dir}/images/${name}`);
    }
    if (!ok) continue;
    gallery.push({ src: `./images/${name}`, alt: '' });
    galleryImages++;
  }
  if (!gallery.length) continue;

  const start = new Date(a.ts * 1000);
  const end = a.endTs ? new Date(a.endTs * 1000) : null;
  const span = end && end.toDateString() !== start.toDateString()
    ? `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : null;

  const data = {
    title: a.name,
    date: start.toISOString().slice(0, 10),
    ...(span ? { dateNote: span } : {}),
    lang: detectLang(a.name),
    location: { name: a.name },
    cover: gallery[0].src,
    coverAlt: '',
    gallery: gallery.slice(1),
    excerpt: `${gallery.length} photographs.`,
    tags: ['travel'],
    draft: true,
    source: 'facebook',
  };

  const body = a.description ||
    `_${gallery.length} photographs from this trip. The writing still needs to be added._`;

  if (!DRY_RUN) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(mdPath, `---\n${stringify(data, { lineWidth: 0 })}---\n\n${body}\n`, 'utf8');
  }
  albumsWritten++;
  console.log(`  album: ${a.name} -> ${mdPath} (${gallery.length} photos)`);
}

/* ------------------------------------------------------------- summary */

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`
${DRY_RUN ? 'DRY RUN — nothing was written.' : 'Done.'}
  writing drafts   ${written}   (${withCover} with a cover image)
  travel drafts    ${albumsWritten}   (${galleryImages} gallery images)
  skipped          ${skipped}   (already existed)
  media            ${imgBefore ? `${mb(imgBefore)} -> ${mb(imgAfter)}` : 'none'}${imgSkipped ? `, ${imgSkipped} skipped` : ''}
  redactions       ${redactions} (profile links, mentions, emails, phone numbers)

Everything is draft: true and invisible on the live site.
Run "npm run dev" to read them, then publish the good ones from /admin/.
`);
