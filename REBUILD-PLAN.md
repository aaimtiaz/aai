# Round 3 — Observatory editorial redesign, CV content, and image repair

> Mirrored to `D:\AAI\my_website\REBUILD-PLAN.md`. Site is live at https://aaimtiaz.github.io.
> Rounds 1–2 (Astro rebuild, Facebook import) are done. Tracker at the bottom.

---

## Context

Twelve items came back after looking at the live site. They fall into three groups.

**The site is visually thin.** An audit found *zero SVGs in the entire source tree*, one gradient (on the admin page), and every icon is a Unicode glyph. The homepage has exactly one image. Light mode paints `#ffffff` across >90% of the page with text at 17.9:1 — roughly double the AAA threshold, which is precisely the combination that reads as glare.

**The homepage wastes half its width.** The bio is capped at `68ch` ≈ 660px inside a 1152px wrapper, so ~616px (44% of a 1400px viewport) sits empty for the bio's full height — made starker by the justified right edge, which turns it into a hard vertical line. Separately `.grid--2` resolves to *three* columns at desktop, so the fourth Explore card sits alone beside 784px of blank.

**Most imported posts lost their photos.** The importer attached a cover only to posts of 800+ characters. In reality **83 text posts have a photo in the export and only 10 got one** — 73 posts render image-less with the photo sitting on disk. 59 of those are short posts where the photo *is* the content.

**Two PDFs supersede much of the site's content.** The CV and the CASSA GRA report show the bio is out of date ("prospective Ph.D. student"), the teaching dates I scaffolded are wrong, and three research projects are missing entirely.

### Decisions taken

| | |
|---|---|
| Visual direction | **Observatory editorial** — serif display, warm ivory light / deep ink dark, hairline rules, small-caps labels, a faint starfield |
| Publishing | **Everything new stays draft.** Teaching, outreach and travel entries get built but not published |
| Publication | **A&A only** (DOI `10.1051/0004-6361/202453239`). The MNRAS link in a Facebook post is not his |
| Images | Cover for every photo-bearing post; **hard cap of 5 images per post** |

**Consequence of "everything stays draft", stated plainly:** `/travel/`, `/teaching/` and `/outreach/` will keep showing empty states until they're released from `/admin/`. So the redesign has to carry the homepage, `/research/`, `/writing/` and `/cv/` on its own, and the empty states need to look deliberate rather than unfinished.

**Important distinction that rescues this:** CV *facts* are not collection entries. Education, awards, telescopes, student counts and the publication go into `site.ts`, the homepage and `/cv/` as page content — not draft-gated. So the homepage gets real substance immediately while the teaching/outreach/travel *posts* stay hidden.

---

## 1. Design system — Observatory editorial

**Type.** Add a serif display face; keep Inter for body and UI. Self-hosted via Fontsource as before.

- Display (h1/h2, post titles, hero): **Fraunces Variable** — optical-size axis, warm, characterful without being fussy. Fall back to `Newsreader` if the variable build misbehaves.
- Body / UI / meta: **Inter Variable** (already installed).
- Bengali: keep **Noto Sans Bengali** for UI; add **Noto Serif Bengali** for Bengali prose and poems so they match the serif display rather than clashing with it.

**Palette.** Light mode becomes warm ivory with a real three-step surface ramp — today `--surface-raised` is literally identical to `--bg`, so nothing can read as raised.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#faf8f4` ivory | `#12141a` |
| `--surface` | `#f3efe8` | `#191d26` |
| `--surface-raised` | `#ffffff` | `#212734` |
| `--border` | `#e4ded3` | `#2b323f` |
| `--text` | `#1c1a17` (~15:1, down from 17.9) | `#e9e6df` |
| `--text-muted` | `#5b5449` (~7:1) | `#a8a396` |
| `--accent` | `#1b4965` ink blue (~9:1) | `#8fb8d6` |
| `--accent-2` | `#7d5622` brass (~6:1) | `#c9a227` |

Brass is the editorial accent: hairline rules, small-caps labels, the `↗` markers. Blue stays for links and interactive state. Verify every pair before shipping.

**Decoration — the missing layer.**
- A **starfield** as inline SVG in the hero: ~60 circles at varied radius and opacity, deterministic (seeded), no external request, no animation under `prefers-reduced-motion`.
- **Small-caps section labels** over a hairline brass rule (`SELECTED WORK ───────`), replacing bare `<h2>`s on index pages.
- Softer, larger radii on cards; `--shadow-sm` finally used (currently defined and never referenced).
- A real **inline SVG icon set** — ~8 glyphs (external link, ORCID, scholar, GitHub, mail, telescope, pen, map pin) as an `Icon.astro` component, replacing the Unicode glyphs.

Files: `src/styles/tokens.css`, `src/styles/global.css`, new `src/components/Starfield.astro`, `src/components/Icon.astro`, `src/components/SectionLabel.astro`.

---

## 2. Homepage rebuild — items 3, 11, 12

`src/pages/index.astro`.

1. **Hero** — full-bleed band (first thing to escape `.wrap`), starfield behind, portrait left, serif name large. Role line becomes **"Graduate Research Assistant"** and the affiliation "CASSA · Independent University, Bangladesh · Dhaka". **Delete the "Observational astrophysicist" tagline** (item 11) — it renders in exactly one place, `index.astro:43`, and is used nowhere else, so removing `tagline` from `site.ts` is safe.
2. **Two-column body** — bio left at ~62ch, **sticky "At a glance" panel right**. This is what fills the 44% dead space. Panel content, all from the CV: M.Sc. Physics SUST 2024 (CGPA 3.56), B.Sc. 2022, current post, 1 publication, Best Presenter ICP 2026, 2,300+ students reached, three telescopes, core tools.
3. **Selected work** — the three research entries rendered as cards *with their figures*. The lensing, AGEL0014 and Sparkler images already exist and currently appear on no homepage at all. This is the single biggest visual win for item 12.
4. **A numbers strip** — 6 years of outreach · 2,300+ students · 11 schools & workshops · 3 telescopes.
5. **Recent writing** with cover images rather than the current text-only list.
6. **Fix two bugs found in the audit**: `"0 entrys"` (bad pluralisation at `index.astro:73`), and the 4-card grid that renders 3-across leaving an orphan — make it an explicit 2×2 or 4-across.

---

## 3. Content from the CV and GRA report — items 9, 10

**`src/data/site.ts`** — drop `tagline`; add structured `education`, `awards`, `stats`, `telescopes`, `tools`.

**`src/content/pages/home.md`** — rewrite. The current opening, "a prospective Ph.D. student", is outdated: he is a Graduate Research Assistant at CASSA working on CANUCS/Sparkler photometry, the Bullet Cluster, and an observatory pipeline.

**`src/content/research/`** — update two, add three:
- *AGEL0014* — analysis complete, manuscript in preparation for **ApJ**; supervisor Dr Nicha Leethochawalit (NARIT).
- *Sparkler* — now concrete: photometry with `photutils`, PSF modelling with `STARRED`, SED fitting with `dense-basis`; SED runs for **182 sparkles across 43 galaxies in 5 clusters** feeding an upcoming CANUCS paper (co-author, AAS).
- **New — Bullet Cluster**: finding sparkler-galaxy candidates, photometry and SED fitting.
- **New — CASSA Observatory pipeline** (Dr Syed Ashraf Uddin): automated image reduction and photometry, DIMM seeing estimation on a Sky-Watcher 8", camera characterisation.
- **New — Durbin**: Python scraper, data migration, 85 astrophotography objects and ~65 object essays published.

**`src/pages/cv.astro`** — becomes a real CV: education, skills, telescopes, experience, schools & workshops (11), conferences, competitions, outreach. Currently it only lists publications and projects.

**`src/content/teaching/`** — **fix the wrong dates I scaffolded**: Daffodil International University is **Feb–Apr 2025** (I had 2024), teaching PHY101/PHY102/PHY103; Reaz Public School is **Apr 2024–Feb 2025** (I had 2022). Stays draft.

**One discrepancy to flag rather than silently pick:** the CV says "Won Best **Oral** Presenter" while the GRA report says "Best Presenter Award for the AGEL0014 **poster** presentation". I'll write the neutral "Best Presenter Award, International Conference on Physics 2026" and note it for correction.

---

## 4. Images — items 1, 2

`scripts/import-facebook.mjs`, then re-run.

- **Cover for every photo-bearing post**, not just 800+ chars. That is the fix for item 1: 73 posts gain the image they should always have had.
- **Hard cap of 5 images per post** (item 2). This also *shrinks* the repo: the five travel albums currently hold 85 images and drop to 25.
- Resize harder for the extra volume: 1800px max edge, WebP q78.
- **Preserve photo credits.** Several album captions carry `©তৌফিকুল ইসলাম`, `©Muksudul Hasan Srabon` — friends shot those galleries. Where a credit appears, carry it into `coverCaption`. Publishing someone's photograph without attribution is not acceptable.
- Skip albums 1 and 2 entirely — verified to be exact URI-for-URI duplicates of post attachments (429 files, 146 MB, zero unique captions).

Budget: ~83 covers plus capped galleries ≈ **15–18 MB total media**, replacing today's 13.8 MB.

---

## 5. Travel and outreach by connecting the dots — items 7, 8

**Travel — ignore `place` tags.** Only 2 of 9 are actually travel; the SUST one is captioned "Memories from the New Zealand trip" as an in-joke about a spot on campus. Instead cluster photo-heavy posts by date and read the text. Confirmed trips:

Chiang Mai (13 posts, `day_0`…`day_12`, Jun–Jul 2024) · Sylhet: Bichanakandi–Jaflong–Ratargul (May 2025) · Panchagarh→Sherpur 330 km cycle tour (Dec 2024) · Jaintapur 115 km ride (Jan 2023) · Bichanakandi (Aug 2018) · Saint Martin's Island (Mar 2021) · Munshiganj (Jan 2025) · tea gardens & border (Aug 2016) · Harashpur (Jul 2017) · dark-sky night ride (Sep 2022) · Jan 2026 trip · Bandarban & Cox's Bazar (Apr 2015).

The Chiang Mai series is a ready-made 13-day travelogue and doubles as the NARIT research stay.

**Do not import** the "একদা দুবাই গিয়েছিলুম" post — it is sarcastic, not a Dubai trip. Nor the protest, farewell and workshop galleries the cluster scan surfaces.

**Outreach — CV is the skeleton, Facebook supplies the photographs.** For each CV event, match Facebook posts inside its date window and attach their images. That pairing is the "connecting the dots":

| Event | Photos found |
|---|---|
| AstroCode Intensive, 8–9 Mar 2024 | 14 |
| Data-Driven Astronomy workshop, DIU, 27–28 Jul 2025 | 10 |
| Star Gazing Night, Reaz Public School, Jan 2025 | 10 |
| CAM-SUST presidency & Study Circle, 2019–2022 | handover set, 9 |
| Project Akashganga, 2021 | astronomy vs superstition series |
| ITPO — 15th globally, 2019 | 1 |
| EcoAstroBD / IAU-OAD, 2026 | launch post |
| ICTP PWF internship; CAM-SUST Summer School 2025 | — |

All of this lands as `draft: true`.

---

## 6. Admin performance — item 6

`src/scripts/admin/main.ts`, `src/scripts/admin/github.ts`. Ranked by measured impact:

1. **Ticking one checkbox rebuilds the entire list.** `renderList()` starts with `innerHTML = ''`, so one click destroys and recreates ~1,880 elements and 752 listeners. This is the lag you feel. Fix: mutate the counter and bulk bar in place.
2. **197 requests on a cold load** (2 + one per post), 8 concurrent ≈ 4–10 s. Fix: batch blob fetches through the **GitHub GraphQL API** — ~100 files per query turns 195 requests into 2.
3. **Cache is all-or-nothing.** Keyed on the commit SHA, so publishing one post invalidates all 195 rows — while the per-file blob SHAs needed for surgical invalidation are already fetched and then discarded. Switch to per-file SHA keys in `localStorage` (survives closing the tab; today it is `sessionStorage`).
4. **183 KB of JS before first paint** — `marked` and `dompurify` are imported eagerly but used only in the Preview handler. Make them dynamic imports.
5. Build rows into a `DocumentFragment`; slice the excerpt *before* the whitespace regex (currently scans up to 15 KB to keep 140 chars).
6. **Bound `commitFiles` concurrency** — it currently fires an unbounded `Promise.all` of blob POSTs, so bulk-publishing 100 drafts means 100 simultaneous writes and a likely 403 from GitHub's secondary rate limiter.
7. Exclude `src/content/pages/` from the listing — `home.md` shows up as a row in a section the filter doesn't offer.
8. **Fix the tag autocomplete**, which has never worked: `Row` has no `tags` field, so the `#known-tags` datalist is always empty.

---

## Verification

1. **Contrast**: compute every new token pair; body text and muted text ≥ 4.5:1, large/display ≥ 3:1, in both themes.
2. **Bengali still unhyphenated** after the font change — the `[lang='bn']` override must keep out-ranking the justified rule.
3. **Homepage width**: at 1400px, confirm no block leaves more than ~15% dead to its right, and the Explore grid has no orphan card.
4. **Images**: confirm 83 posts now carry a cover, no post exceeds 5 images, and total media is under ~20 MB. Confirm photo credits survived into `coverCaption`.
5. **Draft discipline**: `npm run build` must still report **30 pages** and the sitemap **28 URLs** — nothing new may leak into production.
6. **Privacy re-grep** over all generated Markdown after the re-import: zero IPs, emails, phone numbers, Facebook links, coordinates.
7. **Admin**: tick a checkbox and confirm no full re-render (DevTools paint flashing); cold load under ~2 s; bulk-publish 3 drafts and confirm one commit.
8. **Visual pass in Chrome**: homepage, research, writing, a Bengali post, `/cv/`, `/admin/` — light and dark, desktop and 400px, console clean.

---

## Progress tracker

| | |
|---|---|
| **Last touched** | 2026-09-04 — round 3 shipped and live |
| **Branch** | `main`, deploys on push |
| **Round 3 decisions** | Observatory editorial; everything new stays draft; A&A only; 5 images max per post |

- [x] **A** Design system: Fraunces + Noto Serif Bengali, ivory/ink palette, starfield, icon set, small-caps labels
- [x] **B** Homepage: full-bleed hero, sticky "At a glance", research figures, numbers strip; drop tagline; fix "0 entrys" and the orphan card
- [x] **C** Content from CV + GRA report: bio, `site.ts`, 3 new research entries, 2 updated, real `/cv/`, corrected teaching dates
- [x] **D** Importer: cover for every photo post, cap 5, preserve credits, re-run
- [x] **E** Travel + outreach entries from date-clusters and CV pairing — all draft
- [x] **F** Admin: in-place selection, GraphQL batching, per-file cache in localStorage, lazy marked/dompurify, bounded commit concurrency, tag datalist fix

---

## Round 3 outcome — measured

- Homepage dead space right of content: **44% → 12.4%** (just the centred gutter).
- Posts with a cover image: **10 → 78** of the 83 that have a photo in the export.
- Total content media: **23 MB**, max 5 images per post.
- Admin bundle before first paint: **184 KB → 115 KB**; selection no longer re-renders the list.
- Light mode: ivory `#faf8f4`, text 16.4:1 (was pure white at 17.9:1). All token pairs pass AA in both themes.
- Trips identified by date window + phrase: **10 trips, 22 posts** routed to travel.
- Build 50 pages, sitemap 42 URLs, zero drafts leaked, privacy grep clean.

**Concurrent-edit note.** The owner was curating in /admin/ during this round and
main moved underneath: 8 publishes, 1 unpublish, 6 deletes. Those decisions were
reapplied on top of the re-import after verifying no body text differed. If the
importer is ever re-run, check `git log origin/main` for admin commits first —
a blind re-import reverts curation silently.

---

## Carried forward — do not re-litigate

1. **`astro@7.3.1` pinned**; 7.3.0 has a broken internal import that breaks any build using images.
2. **No `remark-breaks`**; `white-space: pre-line` scoped to poems reproduces the rendering.
3. **`getStaticPaths` runs in its own chunk** — shared helpers must be imported from a module, not component scope.
4. **Buttons live in `global.css`**, not component styles: Astro's scoped CSS keys off `data-astro-cid`, which JS-created elements never receive.
5. **Hosting is GitHub Pages** — `_redirects` does nothing; old `.html` URLs are real stub files and the old CV path is kept verbatim.
6. **Import privacy rules stand**: seven-file allowlist, EXIF dropped at parse, redaction pass, banking-detail posts skipped whole.
