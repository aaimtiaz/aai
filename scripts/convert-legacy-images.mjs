import sharp from 'sharp';
import { statSync } from 'node:fs';

const jobs = [
  ['assets/images/bdlensing.png',      'src/content/research/images/bd-lensing-environment.webp'],
  ['assets/images/agel0014.png',       'src/content/research/images/agel0014-gradients.webp'],
  ['assets/images/sparkler.png',       'src/content/research/images/sparkler-stellar-populations.webp'],
  ['assets/images/profile.jpg',        'src/content/pages/images/profile.webp'],
  ['assets/images/winter_morning.png', 'src/content/writing/images/a-winter-morning.webp'],
  ['assets/images/writing2.jpg',       'src/content/writing/images/brishtibheja-shondhya.webp'],
  ['assets/images/writing3.jpg',       'src/content/writing/images/udash-bikel.webp'],
];

const MAX = 2400;
let before = 0, after = 0;
for (const [src, dest] of jobs) {
  const meta = await sharp(src).metadata();
  const b = statSync(src).size;
  // Never upscale: sparkler.png is only 159x225 and was being stretched to 400px.
  const resize = Math.max(meta.width, meta.height) > MAX
    ? { width: meta.width >= meta.height ? MAX : null, height: meta.height > meta.width ? MAX : null, withoutEnlargement: true }
    : null;
  let p = sharp(src).rotate();
  if (resize) p = p.resize(resize);
  await p.webp({ quality: 82 }).toFile(dest);
  const a = statSync(dest).size;
  before += b; after += a;
  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(`${src.split('/').pop().padEnd(22)} ${meta.width}x${meta.height}  ${kb(b).padStart(9)} -> ${kb(a).padStart(8)}`);
}
console.log('-'.repeat(60));
console.log(`TOTAL  ${(before/1024/1024).toFixed(2)} MB -> ${(after/1024).toFixed(0)} KB  (${(100*(1-after/before)).toFixed(1)}% smaller)`);
