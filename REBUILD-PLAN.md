# Round 2 — Facebook import, justified text, and admin curation

> Plan file mirrored to `D:\AAI\my_website\REBUILD-PLAN.md`.
> Round 1 (the Astro rebuild) is **done and live** at https://aaimtiaz.github.io.
> Progress tracker for this round is at the bottom.

---

## Context

The site went live earlier today: Astro, 30 pages, every writing piece at its own URL, images down from 5.79 MB to 892 KB, Bengali rendering correctly under `lang="bn"`.

Three things came out of reviewing it:

1. **Paragraphs look ragged.** Round 1 deliberately removed `text-align: justify` on accessibility grounds. The owner has looked at the result and wants justification back — "different line has different length" — with poems exempt. That is their call on their own site, and it is reversible.
2. **The Facebook export has arrived** — 266 MB, 428 posts, 12 years. It holds the writing and travel history the site was rebuilt to hold.
3. **Deleting a post is buried.** You have to open a post in the editor before Delete appears. With ~190 drafts about to land, that is the wrong shape.

**Decisions made for this round:** nothing from the import goes live. Every imported post — including the five travel albums — lands as a hidden draft, and the owner publishes what they want from `/admin/`. That makes the admin post list the primary tool of this round, not an afterthought.

---

## What the export actually contains

Surveyed read-only, without extracting. The findings that drive the design:

| Finding | Consequence |
|---|---|
| Text is **double-encoded UTF-8** (`\u00e0\u00a6\u0095` = কালকে). 185/185 posts repair cleanly; cross-checked against a media folder literally named `harasapura_1880737222181506` | The `latin1`→`utf8` repair is mandatory. Without it every Bengali post imports as garbage. |
| `title` is boilerplate — *"Ahmad Al-Imtiaz updated his status."* | **Bug in the current importer:** it uses `title` as the headline. Titles must be derived from the body instead. |
| `data` is an array of single-key dicts, many empty | Must scan for the `post` key, not index. (Current code already does.) |
| `edits_you_made_to_posts.json` holds **676 revisions** of the same posts | **Bug:** the current `/post\|note\|album/` filename regex swallows it, producing mass duplicates. Must switch to an explicit allowlist. |
| Every photo carries `exif_data` with **`upload_ip`** — 453 real IP addresses | Never read or copy EXIF. Use `uri` only. |
| Archive also holds phone contacts, device fingerprints, home location, and story-reaction data naming other people | Allowlist, not blocklist. Seven files, nothing else. |
| No `notes/` — Facebook Notes was discontinued | The essay corpus is the 18 posts over 2,000 chars (mostly 2020) plus 5 never-published drafts in `archive.json`. |

**Read only these seven paths:**

```
your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json
your_facebook_activity/posts/archive.json
your_facebook_activity/posts/album/{4,5,6,8,9}.json     # Thailand, bandarban,
                                                        # cox's bazar, sylhet-jaflong, হরষপুর
```

---

## Task 1 — Justified paragraphs

`src/styles/global.css`, plus the writing and travel entry pages.

Justification alone is what causes whitespace rivers; **justification with hyphenation is what books do.** So:

```css
.prose p, .writing__body.is-prose p, .travel__body p {
  text-align: justify;
  hyphens: auto;            /* the half that makes justify readable */
}
[lang="bn"] { hyphens: none; }   /* no Bengali hyphenation dictionary exists */
```

**Poems stay exactly as they are** — `text-align: start`, `white-space: pre-line`. Their line breaks are the content.

**One interaction that has to be handled or justification silently does nothing.** Prose currently carries `white-space: pre-line`. A line ending in a forced break is never stretched, so if a paragraph's lines all end in hard breaks, justified text renders identically to ragged text. Fix: drop `pre-line` from prose (keep it for poems), and at import convert single newlines to real paragraph breaks so the author's intended breaks survive as `<p>` boundaries.

Not justified: headings, card excerpts, `.lede`, metadata, captions, the admin.

Existing content is unaffected — the one Bengali prose post already uses blank-line paragraph breaks.

---

## Task 2 — Turn the admin post list into a curation tool

`src/pages/admin/index.astro` and `src/scripts/admin/main.ts`.

With ~190 drafts to triage, opening each post to delete it is unusable. The list itself becomes the tool:

- **Per-row Publish and Delete** — no need to open a post to remove it.
- **Checkbox multi-select with Publish selected / Delete selected.** `commitFiles()` already takes an array of writes and applies them as one commit, so bulk actions are one commit and one rebuild rather than a hundred.
- **Excerpt preview in each row**, so a post can be judged without opening it.
- **Filters**: all / drafts only / imported only / by section.
- **Sort by date**, newest first.

**Loading 190 posts needs care.** The current `loadList()` fires one `readFile` per post — 190 unbounded requests. Add a concurrency limit (~8) and cache the parsed result in `sessionStorage` keyed by the tree SHA, so it is one slow load per session and instant thereafter. A build-time public index was considered and rejected: it would expose every draft title on the live site.

Deletion removes the `.md` and its cover image in the same commit, and stays recoverable from git history.

---

## Task 3 — Rewrite the importer

`scripts/import-facebook.mjs` — substantial rewrite, not a patch.

**Extract to `D:\fb-export`, outside the repo.** `.gitignore` already blocks `facebook-export/` and `*facebook*.zip`; add `fb-export/` too.

**Encoding.** Node's `'latin1'` is true ISO-8859-1, so `Buffer.from(s,'latin1').toString('utf8')` is correct here — but guard it: only attempt the repair when every codepoint is ≤ 0xFF, and reject the result if it contains U+FFFD. Otherwise a string outside that range would be silently truncated. Apply to every string field after `JSON.parse`, never to raw file bytes.

**Per post:**
- Body from `data[].post`. Ignore `title` entirely.
- **Title derived from the body**: first sentence or first line, trimmed to ~70 chars.
- Slug: ASCII where possible, else `lekha-YYYY-MM-DD`, with a sequence suffix so same-day posts cannot collide.
- Prose bodies: single newline → paragraph break; collapse runs of 3+ blank lines.
- `form: poem` when short lines dominate, else `prose`.
- `lang` by Bengali Unicode range.
- **Strip**: `tags` (other people), `exif_data` (IP addresses), place `coordinate`/`address`/`url` — keep only `place.name`.
- `draft: true`, `source: 'facebook'` on every entry, without exception.

**Media policy — deliberately restrictive.** Deleted images stay in git history forever, and most of these drafts will be deleted. So:
- Posts **≥ 800 chars**: import the first photo as a cover.
- **Travel albums**: import the full gallery — that is their entire point.
- Everything else: **text only.** An image can be added later from the admin.

Expected: roughly 5–8 MB added rather than 40 MB.

**Albums** → one travel draft each: album name as title, date range from photo timestamps, gallery of all photos, location from the album name.

**Dedupe** by normalised body text so re-runs and near-identical posts do not pile up. Idempotent by slug, so the heuristics can be tuned and re-run.

---

## Task 4 — Finish what's left in NEXT-STEPS.md

Doable without the owner:

- **Verify the admin end-to-end in Chrome** — the token is already stored in their browser. Load `/admin/`, confirm it authenticates and lists posts, then one publish → edit → delete cycle to prove the pipeline, cleaning up after.
- **Visual pass in Chrome**: every page in light and dark, mobile width, justified text, Bengali rendering, console clean.
- **Attempt Lighthouse** via `npx lighthouse` headless against the live site. If it will not run, say so plainly rather than guessing at scores.
- **Re-try the git remote fix** (`aai` → `aaimtiaz.github.io`); it was blocked by the auto-mode classifier last time.
- Update `NEXT-STEPS.md` and the tracker to match reality.

Still genuinely needs the owner: Search Console submission (their Google account), ADS/arXiv URLs, and the "to confirm" dates on the four teaching/outreach scaffolds.

---

## Verification

**Encoding first — everything downstream is silently wrong if this fails.** Run the importer on one known Bengali post and confirm real Bengali, not `à¦¬`. The existing `উদাস বিকেল` is a good fixture.

Then:
1. `--dry-run` first, and read the classification summary before writing anything.
2. **Privacy grep over all generated Markdown**: IP addresses, `@` email patterns, phone numbers, `upload_ip`, latitude/longitude. Expect zero hits.
3. Confirm **every** imported file has `draft: true` and `source: facebook`.
4. `npm run build` — confirm the page count is unchanged at 30, proving no draft leaked into production.
5. Confirm the sitemap still contains no imported URL.
6. Justification: view a prose post and a poem side by side — prose justified with hyphenation, poem ragged with its line breaks intact.
7. Admin in Chrome: bulk-select three drafts, delete them, confirm **one** commit removed all three.
8. Re-run the importer and confirm it is idempotent — no duplicates, no re-copied media.
9. Check repo growth is in the expected 5–8 MB range, not 40 MB.

---

## Progress tracker

| | |
|---|---|
| **Last touched** | 2026-09-03 — round 1 live; round 2 planned |
| **Branch** | `main`, deployed by `.github/workflows/static.yml` on push |
| **Round 2 decisions** | Import publishes nothing — all drafts, including travel albums. Justify prose, exempt poems. |

- [ ] **T1** Justified prose + hyphenation; poems exempt; drop `pre-line` from prose
- [ ] **T2** Admin: per-row publish/delete, bulk actions in one commit, excerpts, filters, concurrency-limited loading
- [ ] **T3** Importer rewrite: allowlist, encoding guard, title fix, EXIF/tags stripped, restrictive media policy
- [ ] **T4** Extract export to `D:\fb-export`, dry-run, privacy grep, import for real
- [ ] **T5** Chrome verification pass, admin end-to-end, Lighthouse attempt
- [ ] **T6** Update NEXT-STEPS.md and tracker; retry the git remote fix

---

## Round 1 reference — still true, do not re-litigate

1. **Pinned to `astro@7.3.1`.** 7.3.0 ships a `vite-plugin-assets.js` importing `astro/_internal/logger`, which its own `package.json` does not export — every build using images fails. Do not float back.
2. **No `remark-breaks`.** Astro 7 defaults to the Sätteri processor, which has no `breaks` feature. A CommonMark soft break already emits a literal newline, so `white-space: pre-line` reproduces the old rendering — now scoped to poems only (see Task 1).
3. **`getStaticPaths` runs in its own chunk** and cannot close over component-scope consts; shared helpers must be imported from a module. This is why `tagSlug` lives in `src/lib/content.ts`.
4. **`CollectionKey` includes `pages`**, which has no `date`; anything sorting by date uses the `DatedCollection` alias.
5. **Hosting is GitHub Pages**, not Cloudflare. `_redirects`/`_headers` do nothing there; old URLs are preserved as real stub files, and the old CV path is kept verbatim because that link may be on submitted applications.
6. **Content model**: six collections, `date` + optional `dateNote` for fuzzy dates, `draft` filtered out in production via `getPublished()` in `src/lib/content.ts`.
