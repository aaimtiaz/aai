# Website Rebuild Plan — Ahmad Al-Imtiaz

> **This file lives at `D:\AAI\my_website\REBUILD-PLAN.md` and is the source of truth for where the rebuild stands.**
> If a session ends or hits a limit, a new session resumes by reading the Progress tracker below — not by re-planning.

---

## Progress tracker

**Resume protocol.** Read this section first. Find the last ticked box, continue from the next unticked one. Tick the box and update *Last touched* **as part of finishing each step**, not batched at the end — a session can die between the work and the bookkeeping, and a stale tracker is worse than none. If a step was left half-done, say so in *Notes* rather than ticking it.

| | |
|---|---|
| **Last touched** | 2026-09-03 — Phases 0–2, 4, 4b (code), 5 and 6 built; 30 pages, build green, 0 type errors |
| **Current phase** | Phase 3 — connect Cloudflare Pages (**needs the owner's account**) |
| **Branch** | `redesign`, pushed and tracking `origin/redesign` |
| **Blockers** | Three things need the owner: (1) connect Cloudflare Pages, (2) request the Facebook DYI export, (3) supply ORCID / Scholar / ADS / GitHub URLs. Nothing else is waiting. |
| **Notes** | Local remote URL is stale — still `aai`, GitHub 301s it to `aaimtiaz.github.io`. Push works, so non-blocking. Fix when convenient: `git remote set-url origin https://github.com/aaimtiaz/aaimtiaz.github.io.git` (auto-mode classifier blocked this; needs a manual run). |

### Checklist

**Phase 0 — Unblock**
- [x] `winget install --id OpenJS.NodeJS.LTS` — **node v24.19.0, npm 11.17.0**
- [ ] Request the Facebook DYI export (JSON, High media, all time) — long lead time, **user action**. The importer is already written and its encoding repair is verified, so this is the only thing gating Phase 4b.

**Phase 1 — Repo hygiene**
- [x] `git branch -m master main`, set upstream, create + push `redesign` — master and origin/main were identical at `dfef1fd`, no divergence

**Phase 2 — Astro skeleton**
- [x] Scaffold Astro preserving `.git`; install deps — **astro 7.3.1** (see Astro 7 notes below)
- [x] `astro.config.mjs` + `src/content.config.ts` (six collections)
- [x] `Base.astro`, `BaseHead.astro`, tokens, fonts, `404.astro`, `robots.txt.ts`, sitemap
- [x] Migrate home bio + three research entries
- [x] **Gate PASSED:** `dist/404.html` is at the top level, not `dist/404/index.html`

**Phase 3 — Cloudflare Pages** — *needs the owner's Cloudflare account*
- [x] `.node-version` pinned to `24.19.0`
- [ ] Connect the repo at dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
      · repository `aaimtiaz/aaimtiaz.github.io` · production branch **`redesign`**
      · framework preset **Astro** · build `npm run build` · output `dist`
- [ ] Confirm the first deploy is green, then run the preview-deploy checks below

**Phase 4 — Writing + travel**
- [x] Migrated three writings via `scripts/migrate-writings.mjs` — Bengali read straight from the JSON rather than retyped; verified UTF-8, no BOM, line breaks and em-dashes intact
- [x] Re-encoded images to WebP — **5.79 MB → 892 KB (84.9%)**; `winter_morning.png` **4.19 MB → 136 KB**
- [x] `/writing/`, `/writing/[id]/`, `/travel/`, `/travel/[id]/`, `/tags/[tag]/`, three RSS feeds
- [x] Language filters at `/writing/lang/en|bn/` — deliberately *not* `/writing/en/`, which would collide with a post slug

**Phase 4b — Facebook import**
- [x] `scripts/import-facebook.mjs` written — classifies to writing/travel, sends ambiguous posts to a review queue rather than guessing, strips tags/comments/reactions, re-encodes media, idempotent by slug, everything `draft: true`
- [x] **Encoding repair verified**: "উদাস বিকেল" round-trips through the latin1→utf8 fix; ASCII is untouched and already-correct text is not double-repaired
- [ ] Run it once the export arrives: `npm run import:facebook -- --export "C:/path/to/export" --dry-run` first, then without `--dry-run`
- [ ] Review the drafts in `npm run dev`, fix misclassifications, publish the good ones

**Phase 5 — Polish**
- [x] Teaching and outreach index pages with graceful empty states; `/cv/` page; dark-mode toggle with a pre-paint inline script; `Person` + `ScholarlyArticle` + `BlogPosting` JSON-LD; generated OG image; `_redirects`; `_headers`
- [x] Accessibility built in: skip link, global `:focus-visible`, `lang="bn"` on Bengali posts, no `text-align: justify`, `prefers-reduced-motion`, 44px targets, disclosure nav instead of a modal
- [ ] Run axe DevTools and Lighthouse against the Cloudflare preview (needs a browser + the deploy)

**Phase 6 — Admin** — built at `/admin/`, needs a real token to exercise
- [x] Auth validated with `GET /user`; token expiry surfaced; `REPO` corrected to `aaimtiaz.github.io`, `BRANCH` to `main`
- [x] Git Data API single-commit publish (7 calls, one commit); delete and slug-rename use the same path; unforced ref PATCH gives conflict detection for free
- [x] Client-side resize to WebP ≤2400px with `imageOrientation: 'from-image'` so phone photos are not committed sideways
- [x] Markdown editor with toolbar, truthful preview (same `pre-line` rule as the real page), post list with edit/delete, drafts, localStorage autosave, 16px inputs and 44px targets
- [x] Verified excluded from sitemap, `noindex`, and **no analytics loaded on the page**
- [ ] End-to-end test with a real token (see the admin checklist in Verification) — the orphan-failure test in particular

**Phase 7 — Cutover**
- [ ] Merge `redesign` → `main`; switch the Cloudflare production branch to `main`; attach the custom domain and update `site` in `astro.config.mjs`
- [ ] **Delete `.github/workflows/static.yml`** — it uploads the whole repo root, so it would publish `src/` and `package.json` as a website
- [ ] Remove the superseded root files: `index.html`, `research.html`, `writings.html`, `teaching.html`, `outreach.html`, `admin.html`, `assets/` (all migrated; git history keeps them)
- [ ] Disable GitHub Pages in repo settings; submit the sitemap to Search Console

---

## Astro 7 notes — corrections to the original plan

The plan was researched against Astro 5. npm installs **Astro 7**, and three things differ. All are resolved in the committed code; this section exists so a later session does not re-litigate them.

**1. Pinned to `astro@7.3.1`, not `^7`.** Version 7.3.0 ships a `vite-plugin-assets.js` that emits `import … from "astro/_internal/logger"`, a path its own `package.json` does not export. Any build touching `astro:assets` — i.e. every build here — fails with a rolldown resolve error. 7.3.1 removes that import. Do not float back to 7.3.0.

**2. No `remark-breaks`, and none needed.** Astro 7's default Markdown processor is Sätteri, which has no `breaks` feature and takes visitor-style plugins rather than unified ones. `@astrojs/markdown-remark` would restore the unified pipeline but is the package that pulls in the broken import above.

The simpler answer turned out to be better: a CommonMark soft break already emits a literal newline into the HTML, so `white-space: pre-line` scoped to writing paragraphs reproduces the old rendering exactly. Verified in the built output — the Bengali poem's `<p>` contains real newline characters between its lines. Same result as remark-breaks, one less dependency, and it keeps the faster default pipeline. The rule is scoped to `p` rather than the container so whitespace *between* block elements does not become stray blank lines.

**3. Two Astro constraints worth remembering.**
- `getStaticPaths` is extracted into its own build chunk, so it cannot close over consts declared in the component frontmatter. Shared helpers must be imported from a module — which is why `tagSlug` lives in `src/lib/content.ts` and is imported by both the tag route and every page that links to a tag. That also guarantees a link can never point at a slug the build did not produce.
- `CollectionKey` includes `pages`, which has no `date`. Anything that sorts or feeds by date uses the `DatedCollection` alias instead.

---

## Context

The site at `D:\AAI\my_website` is five hand-written static HTML pages plus a token-gated `admin.html`. It works, but it has hit three walls at once:

1. **Publishing is painful.** Adding a writing pushes a row into `assets/data/writings.json`. There is no way to edit or delete a post, no drafts, no preview, and images upload at full size. There is no place at all for travel writing.
2. **The content is invisible.** `writings.html` is an empty shell that client-side `fetch`es its JSON, so no writing text appears in the served HTML. No individual piece has a URL — everything opens in a modal — so nothing can be shared, bookmarked, or indexed.
3. **The basics are missing.** No canonical URLs, no Open Graph tags, no sitemap, no robots.txt, no 404 page, no JSON-LD, and no ORCID / Google Scholar / ADS links — the primary discovery paths for an academic. `winter_morning.png` alone is 4.19 MB (3472×2604) rendered at 300 px. There are zero focus styles site-wide, a hard keyboard-accessibility failure.

**Intended outcome:** one site that does four jobs credibly — establishes academic standing for PhD admissions, publishes writing (English and Bengali) at real shareable URLs, hosts a new travel blog, and documents teaching and outreach — with a publishing flow usable from a phone without touching HTML.

Years of writing, travel photos, and activity records currently live only on Facebook. A one-time import brings that history onto the site as reviewable drafts (see **Importing from Facebook**).

### Decisions already made

| Decision | Choice |
|---|---|
| Scope | Full redesign — new IA and visual direction |
| Look | Modern academic, structured: clean sans-serif, card grids, single blue accent, light default + dark mode |
| Publishing | Keep the token-based admin, rebuilt properly |
| Hosting | Move to Cloudflare Pages |

### Repo naming — resolved during Phase 1

Planning flagged a suspected mismatch between `admin.html`'s hardcoded `REPO = 'aaimtiaz.github.io'` and the git remote `aaimtiaz/aai`. The first push settled it: **GitHub reports the repository was renamed to `aaimtiaz.github.io`**, and redirects the old URL.

So `admin.html`'s `REPO` constant is correct; the **local remote URL is the stale one**. Two consequences:

- The admin's publishing failure, if any, is not a wrong-repo bug. Everything else in the admin rebuild stands.
- This is a **user Pages site**, served at the domain root `https://aaimtiaz.github.io/` — not at a `/aai/` subpath. Astro's `base` stays `/` either way, so no config changes; it just means existing absolute links and any indexed URLs point at the root.

---

## Stack

**Astro 5**, static output, no adapter. Content Collections with Zod schemas, Markdown bodies, `astro:assets` for automatic responsive images.

Three deliberate constraints, each for a specific reason:

- **Plain Markdown, not MDX.** MDX treats `<` and `{` as syntax. Prose pasted from a phone containing a stray `<` would fail the Cloudflare build and take the newest deploy down. `.md` cannot break the build this way.
- **`remark-breaks` is non-negotiable.** Poem line breaks are the entire reason the current JSON uses `white-space: pre-line`. In stock Markdown a single newline collapses. `remark-breaks` makes "type it the way it looks" work and reproduces the current rendering exactly.
- **Node 24 LTS.** Astro requires ≥ 22.12.0 and does not support odd majors.

```
npm i @astrojs/sitemap @astrojs/rss remark-breaks yaml marked dompurify
npm i @fontsource-variable/inter @fontsource-variable/noto-sans-bengali
```

### `astro.config.mjs`

```js
export default defineConfig({
  site: 'https://<final-domain>',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  image: {
    layout: 'constrained',
    responsiveStyles: true,
    breakpoints: [320, 480, 640, 768, 1024, 1280, 1600, 2048],
  },
  markdown: { remarkPlugins: [remarkBreaks] },
  integrations: [sitemap({ filter: (p) => !p.includes('/admin') })],
});
```

`trailingSlash: 'always'` + `build.format: 'directory'` matches how Cloudflare Pages canonicalizes URLs, avoiding a redirect hop on every internal link and keeping canonical/sitemap/RSS URLs byte-identical to what is actually served.

`image.layout: 'constrained'` set globally is what permanently kills the 4 MB-image class of bug — even Markdown body images get `srcset` generated automatically.

---

## Content collections

`src/content.config.ts`. Every collection uses:

```ts
loader: glob({ base: './src/content/<name>', pattern: '*.md' })
```

**Single-star, non-recursive on purpose** — the co-located `src/content/<name>/images/` folder is then never matched as an entry. Cover images live there and are referenced as `cover: ./images/<slug>.webp`, typed with the `image()` schema helper so Astro optimizes them. (This resolution works because the built-in `glob()` loader sets `filePath`; it would silently fall back to untransformed public paths under a custom or remote loader.)

**Design principle that overrides tidiness: almost everything is optional.** A non-developer commits to these schemas from a phone, and a Zod failure fails the build. Only `title` and `date` are required anywhere.

Shared fields, spread into each collection:

```ts
title: z.string(),
date: z.coerce.date(),
dateNote: z.string().optional(),   // "খুব সম্ভবত ২০২২"
lang: z.enum(['en', 'bn']).default('en'),
excerpt: z.string().optional(),
tags: z.array(z.string()).default([]),
draft: z.boolean().default(false),
cover: image().optional(),
coverAlt: z.string().default(''),
coverCaption: z.string().optional(),
source: z.enum(['original', 'facebook']).default('original'),
sourceUrl: z.string().url().optional(),   // provenance for imported posts
```

`date` + `dateNote` solves the free-text date problem: `date` is a real `Date` used only for sorting, RSS `pubDate`, and `<time datetime>`; `dateNote`, when present, is what renders visibly. `"খুব সম্ভবত ২০২২"` becomes `date: 2022-12-31` + that note — sortable and honest simultaneously.

| Collection | Additional fields |
|---|---|
| `writing` | `form: z.enum(['poem','prose'])`, `intro`, `note` |
| `travel` | `location: { name, country }`, `gallery: z.array(z.object({ src: image(), alt: ... }))` |
| `research` | `supervisor`, `status: z.enum(['published','in-prep','ongoing'])`, `order`, optional `publication: { venue, doi, arxiv, adsBibcode, authors, role }` |
| `teaching` | `institution`, `role`, `term` |
| `outreach` | `org`, `role`, `eventDate` |
| `pages` | `title`, `description` — holds the home bio |

**One `research` collection, not `research` + `publications`.** The A&A paper is simultaneously a project and a publication; the optional `publication` sub-object lets `/research/` render a publications table (entries where it exists) *and* a project grid (all entries) with zero duplication.

Draft filtering, used everywhere:
```ts
getCollection('writing', ({ data }) => import.meta.env.PROD ? !data.draft : true)
```

---

## Information architecture

Every piece of content gets its own URL. This is the single biggest fix.

| Route | Notes |
|---|---|
| `/` | Photo, identity line, affiliation, ORCID/Scholar/ADS/GitHub, bio, section cards, recent items |
| `/research/` | Publications table, then project cards |
| `/research/[id]/` | **New** — each project gets a URL |
| `/writing/` | Card grid; language and form filters |
| `/writing/[id]/` | **The key SEO fix.** Replaces the modal |
| `/travel/`, `/travel/[id]/` | **New** |
| `/teaching/`, `/outreach/` | Collection indexes with graceful empty states |
| `/tags/[tag]/` | Cross-collection |
| `/cv/` | HTML page + PDF link (a bare PDF ranks and previews poorly) |
| `/rss.xml`, `/writing/rss.xml`, `/travel/rss.xml` | Feeds |
| `/robots.txt`, `/sitemap-index.xml` | Generated; `/admin` excluded |
| `/404` | See gate below |
| `/admin/` | `noindex`, no analytics |

Filters are **real routes** (`/writing/bn/`, `/tags/poetry/`), not client-side JS, so each filtered view is crawlable. A JS filter on top is fine but must not be the only path.

### 404 gate — verify explicitly, do not skip

Cloudflare Pages: *if there is no top-level `404.html`, it assumes a single-page app and serves `/` for every unmatched path.* That would silently break error handling site-wide.

Astro is documented to emit `404.astro` as `404.html`, but there is a known open issue reporting `404/index.html` under `build.format: 'directory'`. **After the first `npm run build`, confirm `dist/404.html` exists at the top level.** If it landed at `dist/404/index.html`, add a short `astro:build:done` hook to move it up.

### Old-URL redirects — `public/_redirects`

```
/index.html      /            301
/research.html   /research/   301
/writings.html   /writing/    301
/teaching.html   /teaching/   301
/outreach.html   /outreach/   301
/admin.html      /admin/      301
/assets/pdfs/*   /cv/         301
```

---

## Design system

`src/styles/tokens.css`. A token set replaces the ~30 scattered hex literals in `assets/css/style.css`, so dark mode is a second block of variables rather than a rewrite. Contrast ratios below are computed, not eyeballed.

| Token | Light | Ratio | Dark | Ratio |
|---|---|---|---|---|
| `--bg` | `#ffffff` | — | `#0f1319` | — |
| `--surface` | `#f7f8fa` | — | `#161b23` | — |
| `--border` | `#dde2e9` | — | `#2a323d` | — |
| `--text` | `#14181f` | 17.9:1 | `#e8ecf2` | 15.8:1 |
| `--text-muted` | `#4e5765` | 7.2:1 | `#a3aebf` | 8.3:1 |
| `--accent` | `#1550a8` | 7.7:1 | `#79aaf5` | 7.9:1 |

`--text-muted` replaces the current `#777` captions and dates, which sit at 3.86:1 and fail AA. Also set `color-scheme` per theme so native scrollbars and form controls follow.

Type scale 1.200 fluid via `clamp()`, `--step--1` through `--step-5`. Spacing on a 4px base. Mobile-first with a `min(100% - 2rem, 72rem)` wrapper — this removes the need for the 768px-only breakpoint and all eight `!important` overrides in `assets/css/responsive.css`.

### Fonts — self-host via Fontsource, subset imports

```
@fontsource-variable/inter/latin.css
@fontsource-variable/noto-sans-bengali/bengali.css
```

The current system fallback renders Bengali poorly on most machines. The **per-subset imports are the important part**: they ship correct `unicode-range` descriptors, so an English-only page never downloads the Bengali font at all. That makes Bengali support free for the pages that don't use it. Self-hosting also removes a third-party DNS+TLS handshake from the critical path — Google Fonts' cross-site cache was partitioned years ago, so the CDN now has no upside.

### Accessibility fixes, baked in

1. **Skip link** — first child of `<body>`, visible on focus.
2. **`:focus-visible`** global outline. Currently there are *zero* focus rules.
3. **Delete the modal entirely.** `/writing/[id]/` pages replace it — this retires the `role="dialog"` / focus-trap / Escape problem instead of patching it, *and* it is the SEO fix. One change, two wins.
4. **`lang="bn"`** from frontmatter, on `<html>` for Bengali posts and on `<article>` for cards in mixed lists. Without it screen readers read Bengali with English phonemes.
5. **Kill `text-align: justify`** (`style.css:110-112`) — whitespace rivers, actively harmful for dyslexic readers. Use `text-align: start` + `text-wrap: pretty`.
6. Real `<button>` for actions, `<a>` only for navigation — no more `<a href="#">`.
7. `coverAlt` in the schema so alt text is structural, not remembered.
8. `prefers-reduced-motion` guard on every transition, including `scroll-behavior: smooth`.
9. Theme toggle as `<button aria-pressed>`, with an inline `<head>` script setting `data-theme` before first paint to avoid a flash.
10. Mobile nav as `<button aria-expanded>` or `<details>` — not a modal, so no focus trap needed.
11. 44×44px minimum tap targets; one `<h1>` per page.

### SEO

A single `src/components/BaseHead.astro` emits canonical (from `Astro.url` + `site`), description, OG, and `twitter:card` — killing the copy-pasted `<head>` across five files. JSON-LD: `Person` on `/` with `sameAs`, `ScholarlyArticle` for the A&A paper (DOI `10.1051/0004-6361/202453239`), `BlogPosting` on writing and travel posts. One static OG image in v1; per-post generated OG images are a nice-to-have that should not block launch.

Nav, footer, contact, and the `document.lastModified` script collapse into `src/layouts/Base.astro`. That script is currently **lying** — it reports when the HTML was fetched, not when content changed. Replace it with the newest `date`/`updated` across collections, computed at build.

---

## The admin rebuild

### Location: `src/pages/admin/index.astro`, not `public/admin.html`

The instinct to use `public/` is to protect the admin from build breakage — but that protection is illusory: **if the Astro build fails, Cloudflare Pages keeps the last successful deployment live**, so an in-build admin page stays reachable and can still delete the offending post. `public/` buys nothing and costs npm imports, shared design tokens, and TypeScript.

Client logic in `src/scripts/admin/*.ts`, imported from a `<script>` tag so Vite bundles it. `noindex` meta, `X-Robots-Tag: noindex` for `/admin/*` in `public/_headers`, sitemap-filtered, **and no Google Analytics on this page.**

### Frontmatter: use the `yaml` package, never hand-rolled escaping

This is where a naive implementation breaks, and the failure mode is nasty — a title containing `:` produces *valid but wrong* YAML, and the build succeeds with a mangled title. Note that the existing `intro: "Imagine you are on:"` contains exactly this case; it makes a good regression test.

```ts
import { stringify } from 'yaml';
const file = `---\n${stringify(data, { lineWidth: 0 })}---\n\n${body.trim()}\n`;
```

- **`lineWidth: 0` is required** — default line folding wraps long Bengali titles across lines, changing the parsed value.
- **Do not enable `doubleQuotedAsJSON`** — default output leaves Bengali as literal UTF-8; JSON mode would escape it to `\uXXXX` and make every GitHub diff unreadable.
- The Markdown body needs no escaping at all.

### Committing: Git Data API, one commit, no orphans

Replace the two sequential Contents API PUTs. The current design uploads the image first, so a failed JSON write orphans a multi-megabyte blob permanently.

| # | Call |
|---|---|
| 1 | `GET /git/ref/heads/{branch}` → base commit sha |
| 2 | `GET /git/commits/{baseSha}` → base tree sha |
| 3 | `POST /git/blobs` (image, base64) |
| 4 | `POST /git/blobs` (markdown, base64) |
| 5 | `POST /git/trees` with `base_tree` |
| 6 | `POST /git/commits` |
| 7 | `PATCH /git/refs/heads/{branch}` |

Seven requests, **one commit, one Cloudflare build**. Three properties fall out for free:

- **Atomic.** Nothing is visible until step 7. Failure anywhere earlier leaves the repo untouched — no orphans, ever.
- **Delete uses the same code path** — a tree entry with `sha: null` removes a file. Create, edit, delete, and slug-rename all become one function taking `{path, content|null}[]`.
- **Optimistic concurrency for free.** `PATCH` without `force` fails if the ref moved. Catch, re-run from step 1, retry. Silent clobbering becomes impossible.

Send `X-GitHub-Api-Version: 2022-11-28`. Base64 for both blobs — no text/binary encoding ambiguity.

**Listing posts:** one `GET /git/trees/{sha}?recursive=1`, filtered to `src/content/*/*.md`. The whole content inventory in one request. **Editing:** `GET /contents/{path}`, split frontmatter with `parse()` from the same `yaml` package.

### Image resize

```ts
const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
```

`imageOrientation: 'from-image'` is **not optional** — phone photos carry EXIF rotation, and without it every portrait photo commits sideways. Scale to `max(w,h) <= 2400`, draw to `OffscreenCanvas`, `convertToBlob({ type: 'image/webp', quality: 0.82 })`.

WebP for the committed source: Astro re-derives every delivered format anyway, so source format only affects permanent repo growth — and git history is forever. Convert via `FileReader.readAsDataURL`; **do not** use `String.fromCharCode(...bytes)`, which blows the call stack on multi-megabyte arrays. Show the saving inline (`4.19 MB → 287 KB`) so the feature is legible rather than magic.

### Making it genuinely easy to post

- **Markdown, never HTML**, with a compact toolbar (bold, italic, H2, quote, list, link) wrapping the textarea selection.
- **Write / Preview tabs**, not a side-by-side pane — side-by-side is useless on a phone. Preview renders `marked` → `DOMPurify.sanitize` → injected using the *same* prose CSS class as the real post, so preview is truthful. `remark-breaks` means poem previews match reality without learning trailing-double-space.
- Auto-slug from title (ASCII-transliterated + timestamp), manually overridable.
- Date picker defaulting to today, plus the free-text **"date note"** field — the UI surface for `dateNote`.
- Language toggle (English / বাংলা), form toggle (poem / prose), tag input with a `<datalist>` of tags already in use.
- **Save draft** commits `draft: true`; **Publish** commits `draft: false`. Same path, one boolean.
- **localStorage autosave** keyed by slug. On a phone an incoming call kills the tab; this is the difference between the tool being trusted and abandoned.
- Post list with Edit and Delete. A simple confirm suffices — it is a git commit, fully recoverable.
- Visible step log ("Creating tree… Updating ref…") so failures say *where*.
- **Mobile specifics that matter:** `font-size: 16px` on all inputs (below 16px iOS Safari zooms on focus and the layout jumps), 44px tap targets, sticky bottom action bar, `autocapitalize="sentences"`, single column.

### Auth

Keep the PAT-in-localStorage model — the right trade for a one-person site — but tighten it:

- Fine-grained PAT scoped to **`aaimtiaz/aai` only**, **Contents: Read and write**, nothing else. That one permission covers all seven API calls.
- **Fix the hardcoded constants** — `REPO` must be `aai`, `BRANCH` must be `main`.
- Validate on login with `GET /user` and show the login name. It currently accepts any non-empty string and fails later.
- 90-day expiry, surfaced in the UI so it isn't discovered as a mystery 401.
- Optional: **Cloudflare Access** (Zero Trust free tier) in front of `/admin/*` for email-OTP login. It doesn't replace the PAT but stops strangers loading the page.

---

## Cloudflare Pages

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Output directory | `dist` |
| Production branch | `redesign` during development → `main` at cutover |
| Node | `.node-version` pinned to `24.19.0` |

No adapter; `output: 'static'` needs zero Cloudflare-specific config. **Pin Node explicitly** — the Pages v2 build image defaults to 18.17.1, below Astro's 22.12.0 floor, so an unpinned project landing on v2 fails to build. (v3 defaults to 22.16.0; fall back to that if 24.x won't fetch.)

**`.github/workflows/static.yml` must be deleted at cutover.** It uploads the entire repo root as the artifact. Once the root is Astro source, that workflow would publish `src/`, `package.json`, and `node_modules` as a website. Delete the file and disable Pages in repo settings.

**Custom domain is worth doing** for PhD applications — a `*.pages.dev` URL reads as a scratch project. Cloudflare Registrar is at-cost, and with DNS already there, attaching the domain is one click with automatic TLS.

---

## Content migration

### `writings.json` → three Markdown files

| Entry | Slug | `date` | `dateNote` | `lang` | `form` |
|---|---|---|---|---|---|
| A Winter Morning | `a-winter-morning` | 2023-02-03 | — | `en` | poem |
| বৃষ্টিভেজা সন্ধ্যা | `brishtibheja-shondhya` | 2025-11-06 | — | `bn` | prose |
| উদাস বিকেল | `udash-bikel` | 2022-12-31 | `খুব সম্ভবত ২০২২` | `bn` | poem |

Mapping: `bodyStyle`→`form`, `imageCaption`→`coverCaption`, `image`→re-encoded `cover`; `intro`, `note`, `excerpt` unchanged.

**Body conversion is the delicate part.** Write the literal newlines into the Markdown body verbatim — `remark-breaks` then reproduces the current rendering exactly (`\n`→`<br>`, `\n\n`→new paragraph). No manual escaping, no trailing double-spaces, no `<br>` tags in source.

Two traps: write files as **UTF-8 without BOM** (a BOM before `---` breaks frontmatter parsing), and preserve the typographic apostrophes (`can’t`) and em-dash (`এলাকা—গাছের`). Nothing in these three bodies is Markdown-active, but scan future content for line-leading `#`, `*`, `_`, `>`, `[`.

**Re-encode all three images to WebP at max 2400px before committing** — roughly 6 MB → under 600 KB. Old blobs stay in git history; at ~6 MB that is not worth a history rewrite.

### Research → three Markdown files

`src/content/research/{bd-lensing-environment,agel0014-gradients,sparkler-stellar-populations}.md`. Bodies are the existing paragraphs with HTML entities decoded: `z&approx;1.4` → `z ≈ 1.4`, `&alpha;` → `α`. The first gets the `publication` sub-object (A&A, 2025-07, DOI `10.1051/0004-6361/202453239`, joint first author); the others get `status: 'in-prep'` and `'ongoing'`.

---

## Importing from Facebook

**Scraping `facebook.com/ahmadal.imtiaz.1` directly is not viable** — it is behind a login wall with infinite scroll, and automated scraping breaks Meta's terms. The supported route for your own data is **Download Your Information (DYI)**, which is official, complete, and machine-readable. The Graph API is not an option either; personal-timeline post access was withdrawn years ago.

**Request the export in Phase 0.** Meta takes anywhere from hours to a few days to generate the archive, which makes it the longest lead-time item in the whole plan — everything else can proceed while it builds.

> Settings → Accounts Centre → Your information and permissions → Download your information.
> Format **JSON** (not HTML), media quality **High**, date range **All time**.
> Select: Posts, Photos and videos, Profile information, Events, Comments, and any Notes.

### What the export contains and where it maps

| Export path | Content | Target |
|---|---|---|
| `posts/your_posts_*.json` | Timeline posts — timestamp, text, media refs | `writing` / `travel` drafts |
| Notes files (`notes.json` / `posts/note_*.json`) | Long-form writing — likely where the poems and essays live | `writing` |
| `posts/album/*.json` | Photo albums with captions | `travel` galleries |
| `profile_information/profile_information.json` | Bio, education, work history, places lived | `pages/home.md`, cross-check against `/cv/` |
| `events/your_event_responses.json` | Workshops, schools, talks attended | `outreach`, `teaching` |
| `your_photos/`, `photos_and_videos/` | The actual image files | Re-encoded into `src/content/*/images/` |

### The encoding trap — critical, and it will hit every Bengali post

Facebook's JSON export double-encodes UTF-8: Bengali arrives as mojibake like `à¦¬...`, not readable text. Every string must be repaired on read:

```js
const fix = (s) => Buffer.from(s, 'latin1').toString('utf8');
```

Without this, every Bengali poem imports as garbage. **Verify against a known string before running the full import** — "উদাস বিকেল" already exists in `writings.json` and makes a good fixture.

Three more gotchas:
- Timestamps are Unix epoch **seconds**, so `new Date(ts * 1000)`.
- Media in the export is Facebook-recompressed, not your originals. For travel photos that matter, prefer the original file if you still have it.
- **Posts contain other people's names, tags, and comments.** The importer must keep only your own authored text and strip tagged people, others' comments, and reaction lists — publishing those would republish third parties' personal data without their consent.

### The importer

`scripts/import-facebook.mjs` — run once, offline, never shipped to the site:

1. Read the unzipped export from a path **outside the repo** (it contains private data; it must never be committed — add it to `.gitignore` defensively).
2. Repair encoding, convert timestamps.
3. Classify with explicit heuristics: 3+ photos and a place tag → `travel`; long text with no link → `writing`; an event response → `outreach`. **Anything ambiguous goes to a review-queue file rather than being guessed into a collection.**
4. Detect language by Unicode range (Bengali block `ঀ`–`৿`) → `lang`; set `form: 'poem'` when short lines dominate.
5. Copy and re-encode referenced media to WebP ≤ 2400px into the right `images/` folder.
6. Emit Markdown with `draft: true` and provenance frontmatter (`source: facebook`, `sourceUrl`, original date).
7. Skip slugs that already exist, so the script is idempotent and re-runnable as you refine the heuristics.

**Everything lands as a draft. Nothing goes live from an automated import.** Drafts render in `astro dev`, so the whole import is reviewable locally before the admin even exists. Curate, fix misclassifications, then publish the ones worth publishing. The admin post list gets an "Imported drafts" filter driven by the `source` field.

**Optional supplement:** for a handful of specific posts where the export is ambiguous or the media quality matters, Claude in Chrome can open them in your already-logged-in browser session and pull the text and image directly. That is a spot-fix tool for posts you point at, not a bulk mechanism — the DYI export remains the primary path.

---

### Home, CV, analytics

Bio paragraphs → `src/content/pages/home.md`. Name, tagline, email, and scholar links → `src/data/site.ts` as a typed single source of truth.

CV → `public/cv/ahmad-al-imtiaz-cv.pdf`. The literal space in `Curriculum Vitae_Ahmad Al-Imtiaz.pdf` forces `%20` in every link and breaks strict URL handling.

The `gtag` snippet → `src/components/Analytics.astro`, excluded from `/admin/`.

---

## Sequencing

Each phase ends deployable. All work on a `redesign` branch; `main` keeps serving the old site until Phase 7.

**Phase 0 — Unblock, and start the clock on Facebook.** Two things, both gating:
- `winget install --id OpenJS.NodeJS.LTS`, then verify `node -v` in a *fresh* shell. **Node is not currently installed — no code work can start.**
- **Request the Facebook DYI export now.** It takes hours to days to generate and blocks Phase 4b, so it must be kicked off before anything else rather than when the importer is ready.

**Phase 1 — Repo hygiene.** `master` and `origin/main` are at the identical commit with a clean tree, so there is no divergence to reconcile:
```
git branch -m master main
git branch --set-upstream-to=origin/main main
git checkout -b redesign && git push -u origin redesign
```

**Phase 2 — Astro skeleton.** Scaffold **preserving `.git`** (scaffold to a temp dir and move files in). Config, all six collections, `Base.astro`, `BaseHead.astro`, tokens, fonts, `404.astro`, `robots.txt.ts`, sitemap. Migrate home bio and research. **Gate: confirm `dist/404.html` is top-level.**

**Phase 3 — Connect Cloudflare Pages** with production branch `redesign`. *Do this early, not at the end* — build-environment surprises (Node version, sharp, memory) are far cheaper to find now than during cutover.

**Phase 4 — Writing + travel.** Migrate the three writings, build the index/detail/tag routes and RSS, re-encode images.

**Phase 4b — Facebook import.** Build and run `scripts/import-facebook.mjs` against the export requested in Phase 0. Review the generated drafts in `astro dev`, fix misclassifications, discard the noise. Feeds real content into teaching and outreach, which are empty stubs today.

**Phase 5 — Teaching, outreach, CV, polish.** Dark-mode toggle, JSON-LD, OG image, `_redirects`, `_headers`, accessibility pass.

**Phase 6 — Admin.** Auth, Git Data API commit function, image resize, editor with preview, post list, drafts, autosave, "Imported drafts" filter.

**Phase 7 — Cutover.** Merge to `main`, switch Cloudflare production branch, attach domain, **delete `.github/workflows/static.yml`**, disable GitHub Pages, submit sitemap to Search Console.

**Three hard ordering constraints:** Phase 1 before Phase 3 (Cloudflare needs a stable branch name); Phase 4 before Phase 6 (the admin encodes the schema, so building it first means building it twice); and the Phase 0 export request before Phase 4b (Meta's generation lag is the long pole).

---

## Verification

**Locally, per phase.** `npm run dev` for routes and draft visibility, then `npm run build && npm run preview` — the real check, since dev does not exercise static generation. Confirm `dist/404.html` at top level; `dist/sitemap-index.xml` present and containing no `/admin`; `_redirects` and `_headers` copied through.

- **Image proof:** view-source a post and confirm the `<img>` has a multi-entry `srcset` plus `width`/`height`. That is the concrete evidence the 4 MB problem is dead.
- **Bengali font proof:** on an English-only page, DevTools Network must show the Noto Sans Bengali file **not** requested; on a Bengali post it must be. That verifies `unicode-range` subsetting.
- **Accessibility:** keyboard-only pass — Tab from page load, the skip link must be the first stop and every focused element visibly ringed. Then axe DevTools, then Lighthouse a11y ≥ 95.

**On the Cloudflare preview deploy.** Request `/writing/foo` and verify a 301 to `/writing/foo/`. Request a nonexistent path and confirm the custom 404 renders — **if the homepage renders instead, the SPA fallback kicked in and the `404.html` gate failed.** `curl -I` each redirect. Run `/rss.xml` through the W3C validator, confirming Bengali titles survive. Lighthouse mobile: Performance ≥ 95, A11y ≥ 95, SEO 100. Verify canonical + OG + JSON-LD in view-source, and run the JSON-LD through Google's Rich Results Test.

**Admin, end-to-end on the preview deploy** (not localhost — CORS and token behavior differ):

1. Bad token → clear error from the `GET /user` check, not silent success.
2. Publish a Bengali post whose **title contains a colon and a double quote**, with a multi-line poem body. Verify the GitHub diff shows readable Bengali (not `\uXXXX`) and that line breaks render on the deployed page.
3. Upload a 4 MB portrait phone photo → committed file under ~400 KB **and correctly rotated**.
4. Confirm exactly **one** commit per publish, containing both files.
5. **Force a failure** — revoke the token between blob creation and the ref update — and confirm no orphan image exists. This is the specific bug being fixed; test it deliberately.
6. Edit a post: slug stable, no duplicate. Delete a post: `.md` and image both vanish in one commit.
7. Save a draft: renders in `astro dev`, absent from the production build and sitemap.
8. Open the admin in two tabs and publish from both — the second must report a conflict and retry, not clobber.
9. Run the whole flow **on the actual phone, on cellular, in portrait.**

**Facebook import:**

1. **Encoding first, before anything else** — run the importer against one known Bengali post and confirm the output reads as Bengali, not `à¦¬`. If this is wrong, everything downstream is silently garbage.
2. Spot-check five imported drafts against the live Facebook posts for text fidelity and correct dates.
3. Grep the generated Markdown for other people's names and for comment text — confirm the third-party stripping worked.
4. Confirm the export directory is not inside the repo and not staged in git.
5. Re-run the importer and confirm it is idempotent — no duplicate slugs, no re-copied images.
6. Confirm every imported entry has `draft: true` and is absent from a production build.

---

## Inputs needed

- **The Facebook DYI export zip** (request in Phase 0 — long lead time).
- Final domain name.
- **ORCID iD, Google Scholar URL, ADS author URL, GitHub username** — currently absent entirely, which is a real credibility gap for admissions committees.
- Full author list and exact citation for the A&A 2025 paper.
- Keep GA `G-P6X673H4S7`, or switch to cookieless Cloudflare Web Analytics (no consent banner needed).

## Critical files

| Path | Role |
|---|---|
| `astro.config.mjs` | new — site, trailingSlash pairing, `image.layout`, `remark-breaks`, sitemap filter |
| `src/content.config.ts` | new — six collections; the `glob()` + `image()` contract everything depends on |
| `src/pages/admin/index.astro` | new — replaces `admin.html`; Git Data API single-commit publish |
| `scripts/import-facebook.mjs` | new — one-time DYI import; the `latin1`→`utf8` repair is the make-or-break detail |
| `src/layouts/Base.astro`, `src/components/BaseHead.astro` | new — absorbs the nav/footer/head duplicated across 5 files |
| `assets/data/writings.json` | source of truth for the writing migration |
| `research.html` | source of truth for the three research entries and publication metadata |
| `.github/workflows/static.yml` | **delete at cutover** — would otherwise publish Astro source as a website |
