import sharp from 'sharp';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f1319"/><stop offset="100%" stop-color="#16233a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="80" y="250" width="64" height="4" fill="#79aaf5"/>
  <text x="80" y="220" font-family="Segoe UI, Inter, sans-serif" font-size="76" font-weight="700" fill="#e8ecf2">Ahmad Al-Imtiaz</text>
  <text x="80" y="320" font-family="Segoe UI, Inter, sans-serif" font-size="36" fill="#a3aebf">Observational astrophysicist</text>
  <text x="80" y="380" font-family="Segoe UI, Inter, sans-serif" font-size="28" fill="#79aaf5">Galaxy evolution · strong gravitational lensing · JWST</text>
  <text x="80" y="540" font-family="Segoe UI, Inter, sans-serif" font-size="24" fill="#6b7688">Centre for Astronomy, Space Science and Astrophysics · IUB</text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile('public/og-default.png');
console.log('public/og-default.png written');
