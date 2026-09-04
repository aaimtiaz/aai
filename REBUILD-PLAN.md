# Site rebuild — plan and progress

> Live at https://aaimtiaz.github.io. Deploys from `main` on every push.
> This file is the source of truth for where things stand. A new session should
> read the tracker below rather than re-planning.

---

## Progress tracker

| | |
|---|---|
| **Last touched** | 2026-09-04 — round 4 shipped and live |
| **Branch** | `main`. The owner also edits via `/admin/`, which commits directly — always `git fetch` and inspect `origin/main` before re-running any importer |
| **Rounds done** | 1: Astro rebuild · 2: Facebook import · 3: Observatory-editorial redesign · 4: photos, map, photography, SEO |

### Round 4 — complete

- [x] **A** Saint Martin's withdrawn to draft; `credit` field added to gallery images
- [x] **B** Outreach photographs for the 4 events that have them
- [x] **C** Research: current-work summary, Supernova entry restored, sparkler re-encoded
- [x] **D** Writing: `writing2.jpg` recovered, 2 malformed titles fixed, missing excerpt added
- [x] **E** Travel map from a gazetteer, plus trip mode/distance
- [x] **F** Photography collection, 5 sets seeded as drafts, admin support
- [x] **G** SEO: alt text, per-page OG, article `image`, breadcrumbs, ProfilePage, sitemap `lastmod`, feed discovery

### Round 4 outcome — measured

- Images with empty alt: **32 → 28**, and **0 on entry pages**. The 28 remaining are
  card thumbnails, where empty alt is correct — the card's own heading carries the title.
- Every entry now has **its own `og:image`**; previously all 65 pages shared one card.
- Article JSON-LD gains `image`, `@id`, `dateModified`. The site was eligible for
  **no Article rich results at all** before, and three research entries emitted no
  article markup whatsoever because the schema was gated on a `publication` existing.
- Travel map: **21 country outline paths, 3 pins, 0 bytes of client JavaScript.**
  Stats derived from the posts: 490 km ridden, 330 km longest tour, 26 km on foot.
- Outreach: **4 of 7** entries gained photographs (20 images). Three have none in the
  export and were left image-less rather than given something unrelated.
- Recovered from git history: `writing2.jpg` (the বৃষ্টিভেজা সন্ধ্যা illustration, never
  migrated) and `sne_1a.png` plus the Supernova/Hubble project the rebuild had dropped.
  `sparkler.webp` re-encoded 1.4 KB → 5 KB at q95.
- Photography: 5 sets, 32 photographs, all drafts.
- Sitemap `lastmod` on 20 of 63 URLs — the dated entries. Omitted elsewhere rather than
  stamped with the build time, which would claim everything changed on every deploy.
- Privacy grep clean across all 207 content files.

**The one withdrawal.** `travel/thinking-is-more-interesting…` (Saint Martin's) was
published, and nine of its eleven source photographs are credited to তৌফিকুল ইসলাম and
Muksudul Hasan Srabon. It is back to draft with the reason written into the file,
pending their permission. The gallery schema now has a `credit` field — its absence was
why four of those shipped uncredited in the first place.

### Still open, for the owner

- Ask তৌফিকুল ইসলাম and Muksudul Hasan Srabon about the Saint Martin's photographs,
  then publish that entry or drop their images.
- Three outreach entries have no photographs anywhere in the export: ICTP PWF (no post
  at all), the CAM-SUST summer school (only a poster), and EcoAstroBD (a share whose
  media did not export). Supply images if you have them.
- Publish photography sets from `/admin/` once you have read them.
- Submit the sitemap to Google Search Console: `https://aaimtiaz.github.io/sitemap-index.xml`.
- ADS and arXiv URLs are still blank in `src/data/site.ts`; empty ones are skipped
  rather than rendered as dead links.
- The CV says "Best **Oral** Presenter", the GRA report says the AGEL0014 **poster**.
  Written neutrally until you confirm which.

---

## How the site is put together

**Astro 7, static, GitHub Pages.** Content lives in `src/content/` as Markdown with
typed frontmatter; `getPublished()` in `src/lib/content.ts` filters drafts out of
production builds while leaving them visible in `astro dev`.

**Collections:** `writing`, `travel`, `photography`, `research`, `teaching`, `outreach`,
`pages`. Only `title` and `date` are ever required — these get written from a phone, and
a schema failure fails the deploy.

**Publishing** happens at `/admin/`, which commits to `main` through the GitHub Git Data
API as a single commit per action.

**Scripts**
```
npm run dev                     # drafts ARE visible
npm run build                   # drafts are NOT included
npm run check                   # type check
npm run import:facebook -- --export "D:/fb-export" --dry-run
node scripts/seed-photography.mjs --export "D:/fb-export" --dry-run
```
The unzipped export lives at `D:\fb-export`, outside the repo, git-ignored.

---

## Carried forward — do not re-litigate

1. **`astro@7.3.1` pinned.** 7.3.0 emits a broken internal import that breaks any build
   using images.
2. **No `remark-breaks`.** `white-space: pre-line`, scoped to poems only, reproduces the
   rendering. On prose it would suppress justification, because a line ending in a forced
   break is never stretched.
3. **`getStaticPaths` runs in its own chunk** and cannot close over component-scope
   consts. Shared helpers must be imported from a module.
4. **Anything styling JS-created elements lives in `global.css`.** Astro's scoped CSS
   keys off `data-astro-cid`, which elements built with `createElement` never receive.
5. **Hosting is GitHub Pages**, not Cloudflare — `_redirects` does nothing. Old `.html`
   URLs are real stub files, and the old CV path is preserved verbatim because that link
   may be on submitted applications.
6. **Bengali is never hyphenated.** The `[lang='bn']` override must keep out-ranking the
   justified rule; a bare `[lang='bn'] p` loses to `.writing__body.is-prose p`.
7. **Import privacy rules stand**: seven-file allowlist, EXIF dropped at parse (it carries
   453 real upload IP addresses), a redaction pass over every body *and every caption*,
   and posts carrying banking details skipped whole.
8. **The owner edits in `/admin/` between sessions.** Fetch and inspect `origin/main`
   before re-running an importer — a blind re-import silently reverts curation. This has
   already happened once and cost a recovery pass.
