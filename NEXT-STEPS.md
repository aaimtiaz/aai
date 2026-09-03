# Where things stand

**The site is live at https://aaimtiaz.github.io** and everything that could be
done without your accounts is done.

Your 12 years of Facebook posts are imported and waiting for you as **hidden
drafts**. Nothing from them is on the public site.

---

## What's left for you

### 1. Curate the imported drafts — the main job

Go to **https://aaimtiaz.github.io/admin/** → **Posts** tab.

You'll see **188 drafts**: 183 writing pieces, 5 travel albums. The list is
built for exactly this job:

- Each row shows the title, date, language and an excerpt, so you can judge a
  post without opening it.
- **Publish** / **Edit** / **Delete** on every row.
- **Tick several and use the bulk bar** — Publish, Make draft, or Delete
  applies to all of them in *one* commit and *one* rebuild. Clearing a hundred
  posts you don't want is a single action, not a hundred.
- **Show** filters to drafts / live / imported; **Section** filters to
  writing / travel / etc.

Suggested order:

1. Filter to **Drafts only**, work newest → oldest.
2. Bulk-delete the obvious noise (event announcements, one-line status updates).
3. Publish the pieces that are actually writing.
4. For the 5 travel albums, open each, write a few lines, then publish — the
   gallery and dates are already in place.

A published post appears on the live site about a minute later, once the site
rebuilds.

### 2. Fill in the four teaching / outreach scaffolds

`src/content/teaching/` and `src/content/outreach/` hold four drafts built from
facts already on your old site. Their dates say **"to confirm"**. Fix the dates,
add detail, set `draft: false`, and both pages stop showing an empty state.

### 3. Submit the sitemap

Google Search Console → add `https://aaimtiaz.github.io` → submit
`https://aaimtiaz.github.io/sitemap-index.xml`. Your writing has real URLs for
the first time; this is what gets them indexed.

### 4. Optional: ADS and arXiv links

`src/data/site.ts` has empty `ads` and `arxiv` fields. Empty ones are skipped
rather than rendered as dead links, so there's no rush — but ADS in particular
is worth having on an astronomy site.

---

## What was done for you

**Live and verified in the browser:**

- **Justified body text with hyphenation**, as you asked. Poems are exempt —
  their line breaks are the content, so they stay ragged.
- **Bengali is never hyphenated.** A first pass shipped a bug where Chrome broke
  Bengali words mid-word — বা-হনে, রা-স্তা — at points that aren't syllable
  boundaries. Fixed and confirmed on the live site.
- **Facebook import**: 183 writing drafts + 5 travel albums (Thailand,
  Bandarban, Cox's Bazar, Sylhet-Jaflong, হরষপুর), 12.9 MB of photos.
- **Admin post list rebuilt** for curation: per-row and bulk publish/delete,
  excerpts, filters.
- ORCID, Google Scholar and GitHub links are live on the homepage, CV page and
  footer, and feed the `Person` structured data Google reads.

**Privacy — the part that mattered most:**

The importer reads an **allowlist of seven files**. Your export also contains
uploaded phone contacts, device fingerprints, home location, and story-reaction
data naming other people; none of it is ever opened.

Within those seven files:

- **EXIF stripped during parse** — it carried 453 real upload IP addresses.
- Tagged people, comments, reactions, GPS coordinates and addresses dropped.
- Profile links, `@[id:Name]` mentions, emails and phone numbers redacted from
  post bodies.
- **One post was dropped entirely**: a relief fundraiser carrying two Rocket
  mobile-banking numbers, a bank routing number, and another person's full name
  and institution. Redaction can remove digits but can't un-name someone. Posts
  carrying banking details are now skipped as a rule.

Verified afterwards across all 184 files: zero IP addresses, emails, Facebook
links, phone numbers, long digit runs or coordinates.

**Encoding:** the export double-encodes UTF-8, so all 83 Bengali posts would
otherwise have imported as `à¦¬` mojibake. The repair is guarded both ways — it
only runs when every codepoint is already ≤ U+00FF, and is rejected if it
produces a replacement character.

---

## Running things again

```bash
npm run dev             # local preview; drafts ARE visible here
npm run build           # production build; drafts are NOT included
npm run check           # type check

# Re-run the import (safe — it skips anything that already exists)
npm run import:facebook -- --export "D:/fb-export" --dry-run
```

The unzipped export lives at `D:\fb-export`, deliberately outside this repo, and
is git-ignored. It contains private data — don't move it in here.

---

## Notes for a future session

`REBUILD-PLAN.md` has the full history and the decisions behind it. The parts
worth not re-deriving:

- Astro is pinned to **7.3.1**; 7.3.0 has a broken internal import that breaks
  every build using images.
- Hosting is **GitHub Pages**, not Cloudflare. `_redirects` does nothing there,
  so old `.html` URLs are preserved as real stub files, and the old CV path is
  kept verbatim because that link may be on submitted applications.
- Buttons live in `global.css`, not component styles: Astro's scoped styles key
  off a `data-astro-cid` attribute that JS-created elements never receive.
