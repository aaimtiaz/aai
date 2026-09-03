/**
 * One-time migration: assets/data/writings.json -> src/content/writing/*.md
 *
 * Bengali is never retyped by hand — it is read from the JSON and written
 * straight back out as UTF-8, so there is no opportunity to corrupt it.
 * Body newlines are written verbatim; remark-breaks reproduces the old
 * `white-space: pre-line` rendering exactly.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';

// The old `date` field is free text and unparseable. Each entry gets a real
// Date for sorting plus, where the original was a guess, the honest note.
const META = {
  'A Winter Morning': {
    slug: 'a-winter-morning', date: '2023-02-03', lang: 'en',
    tags: ['poetry', 'winter'],
  },
  'বৃষ্টিভেজা সন্ধ্যা': {
    slug: 'brishtibheja-shondhya', date: '2025-11-06', lang: 'bn',
    tags: ['gadya', 'rain'],
  },
  'উদাস বিকেল': {
    slug: 'udash-bikel', date: '2022-12-31', lang: 'bn',
    dateNote: 'খুব সম্ভবত ২০২২', tags: ['poetry'],
  },
};

const entries = JSON.parse(readFileSync('assets/data/writings.json', 'utf8'));

for (const w of entries) {
  const m = META[w.title];
  if (!m) { console.error('No mapping for:', w.title); process.exitCode = 1; continue; }

  const data = {
    title: w.title,
    date: m.date,
    ...(m.dateNote ? { dateNote: m.dateNote } : {}),
    lang: m.lang,
    form: w.bodyStyle === 'poem' ? 'poem' : 'prose',
    cover: `./images/${m.slug}.webp`,
    coverAlt: '',                       // decorative: the title is adjacent
    ...(w.imageCaption ? { coverCaption: w.imageCaption } : {}),
    ...(w.intro ? { intro: w.intro } : {}),
    ...(w.note ? { note: w.note } : {}),
    ...(w.excerpt ? { excerpt: w.excerpt } : {}),
    tags: m.tags,
    draft: false,
    source: 'original',
  };

  // lineWidth: 0 disables line folding, which would otherwise wrap long
  // Bengali strings mid-value and change what gets parsed back.
  const fm = stringify(data, { lineWidth: 0 });
  const file = `---\n${fm}---\n\n${w.body.trim()}\n`;

  const path = `src/content/writing/${m.slug}.md`;
  writeFileSync(path, file, 'utf8');   // UTF-8, no BOM
  console.log(`${path.padEnd(46)} ${w.body.length} chars, ${m.lang}, ${data.form}`);
}
