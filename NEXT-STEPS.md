# Finishing the rebuild — step by step

Everything that could be done without your accounts is done and pushed to the
`redesign` branch. Your live site is untouched: `main` still holds the old one.

These are the remaining steps, in the order that avoids rework.

---

## Decision first: what URL will the site live at?

This one has to be settled before anything else, because the canonical URLs,
sitemap and RSS feed all bake it in.

**Moving to Cloudflare Pages means giving up `aaimtiaz.github.io`.** That is
your current, already-indexed address, and it is a respectable URL for an
academic. Cloudflare would give you `something.pages.dev` instead, which is
worse on every axis that matters for an admissions committee.

Three honest options:

| Option | URL | Cost | Notes |
|---|---|---|---|
| **A — Custom domain on Cloudflare** *(best)* | e.g. `ahmadalimtiaz.com` | ~$10/yr | Cleanest, most professional, fastest globally. Cloudflare Registrar sells at cost and DNS is then automatic. |
| **B — Stay on GitHub Pages** | `aaimtiaz.github.io` | Free | Keeps your existing URL and its search history. Needs a ~20-line workflow change, which I can do in one step. No migration at all. |
| **C — Cloudflare `pages.dev`** | `xyz.pages.dev` | Free | Free and fast, but the URL reads like a scratch project. Only pick this if you plan to add a domain soon. |

**My recommendation:** A if you're willing to spend ~$10/year — you're applying
to PhD programmes and the domain is the cheapest credibility you'll ever buy.
Otherwise B, which keeps the URL you already have. C is the one to avoid.

> Tell me which you want and I'll wire it up. The steps below cover A/C
> (Cloudflare) as the main path, with B in the appendix.

---

## Step 1 — Request the Facebook export (do this first)

Meta takes **hours to several days** to build the archive, so start it now and
let it run while you do everything else.

1. Facebook → **Settings** → **Accounts Centre**
2. **Your information and permissions** → **Download your information**
3. **Request a download** → your profile → **Select types of information**
4. Tick: **Posts**, **Photos and videos**, **Profile information**, **Events**,
   **Comments**, and **Notes** if it's offered
5. Set: **Date range: All time** · **Format: JSON** (not HTML) · **Media quality: High**
6. Submit. You'll get a notification when it's ready to download.

**Format must be JSON** — the importer cannot read the HTML version.

When it arrives, unzip it **somewhere outside this repo** (e.g. `D:\fb-export`).
It contains private data; `.gitignore` already blocks the common paths, but
keeping it outside the folder entirely is safer.

---

## Step 2 — Add your scholar profile links

These are currently empty, and it's the one real content gap left. ORCID,
Scholar and ADS are how people verify an academic actually exists.

Open `src/data/site.ts` and fill in the `profiles` block:

```ts
profiles: {
  orcid:   'https://orcid.org/0000-0000-0000-0000',
  scholar: 'https://scholar.google.com/citations?user=XXXXXXX',
  ads:     'https://ui.adsabs.harvard.edu/public-libraries/XXXXXXX',
  github:  'https://github.com/aaimtiaz',
  arxiv:   'https://arxiv.org/a/alimtiaz_a_1',
},
```

Leave any you don't have as `''` — empty ones are skipped everywhere rather
than rendering a dead link. They appear on the homepage, the CV page, the
footer, and in the `Person` JSON-LD that Google reads.

Then check it looks right:

```bash
npm run dev
```

and open http://localhost:4321

---

## Step 3 — Connect Cloudflare Pages

*(Skip to the appendix if you chose option B.)*

1. Sign in at **dash.cloudflare.com**
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Authorise GitHub and pick the **`aaimtiaz/aaimtiaz.github.io`** repository
4. Set up the build exactly like this:

   | Field | Value |
   |---|---|
   | Production branch | **`redesign`** |
   | Framework preset | **Astro** |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(leave blank)* |

   Use `redesign`, not `main`, for now — that's what lets you check the new
   site while the old one keeps serving.

5. **Save and Deploy**, then wait for the build to go green.

If the build fails on the Node version, it's the `.node-version` file (pinned
to `24.19.0`). Change it to `22.16.0`, commit, and it will rebuild.

**Check the deploy** at the `*.pages.dev` URL it gives you:

- Every page loads: `/`, `/research/`, `/writing/`, `/travel/`, `/teaching/`, `/outreach/`, `/cv/`
- A Bengali post renders properly: `/writing/udash-bikel/` — the poem should
  break across lines exactly as written
- **Visit a URL that doesn't exist**, e.g. `/nonsense/`. You must get the 404
  page. **If you get the homepage instead, stop and tell me** — that means
  Cloudflare is treating the site as a single-page app, and it needs fixing
  before launch.
- Toggle dark mode with the ☾ button in the header
- Press Tab from the top of a page — the first thing focused should be a
  "Skip to content" link, and every focused item should show a visible ring

---

## Step 4 — Set the final URL

Once you know the real address, edit line 8 of `astro.config.mjs`:

```js
site: 'https://your-final-domain.com',
```

This feeds canonical tags, the sitemap and RSS. Getting it wrong means Google
is told your pages live somewhere they don't.

**For a custom domain (option A):** in your Cloudflare Pages project →
**Custom domains** → **Set up a domain**. If you bought it through Cloudflare,
DNS and HTTPS are automatic. Then update `site` to match.

---

## Step 5 — Cut over

Do this once Step 3's checks pass.

```bash
git checkout main
git merge redesign
```

Then delete the old deployment path and the superseded files:

```bash
git rm .github/workflows/static.yml
git rm index.html research.html writings.html teaching.html outreach.html admin.html
git rm -r assets
git commit -m "Cut over to the Astro site"
git push origin main
```

**Deleting `.github/workflows/static.yml` is not optional.** It uploads the
entire repo folder as the website. Once `main` holds Astro source, leaving it
in place would publish your `src/` folder and `package.json` as a live site.

Nothing is lost — every deleted file stays in git history.

Then:

1. In Cloudflare Pages → **Settings** → **Builds** → change the production
   branch from `redesign` to **`main`**
2. On GitHub → repo **Settings** → **Pages** → set Source to **None**
   *(skip this if you chose option B)*

---

## Step 6 — Create your publishing token and test it

The panel is at **`/admin/`** on your live site.

**Create the token:**

1. Go to https://github.com/settings/personal-access-tokens/new
2. **Token name:** `website-admin`
3. **Expiration:** 90 days
4. **Repository access:** *Only select repositories* → **`aaimtiaz.github.io`**
5. **Permissions** → Repository permissions → **Contents: Read and write**
   — that one permission, nothing else
6. Generate, and copy it immediately (GitHub shows it once)

**Sign in:** open `/admin/`, paste the token, tick "Stay signed in", Sign in.
It should show your GitHub username and the token's expiry date. If it says the
token was rejected, the permission or repository selection is wrong.

**Then run these checks** — each one exercises something that was broken before:

1. **A tricky title.** Publish a post titled `Test: "quoted" and colon` with a
   few lines of Bengali. Check on GitHub that the file is readable and the
   Bengali shows as real text, not `\u0985` escapes.
2. **A big phone photo.** Attach a full-size portrait photo from your phone.
   The panel should report something like `4.19 MB → 287 KB`, and the photo
   must appear **the right way up**, not rotated.
3. **One commit.** Check the repo's commit list — publishing should produce
   exactly *one* commit containing both the post and its image.
4. **Edit and delete.** Edit the test post from the Posts tab, save, confirm no
   duplicate appeared. Then delete it.
5. **Drafts.** Save something as a draft and confirm it does *not* appear on the
   live site.
6. **On your phone.** Do a whole post from your phone, on mobile data. That's
   the case the panel was actually designed for.

Delete the test posts when you're done.

---

## Step 7 — Run the quality check

On the live site, in Chrome: **F12** → **Lighthouse** → tick Performance,
Accessibility, Best Practices, SEO → **Mobile** → Analyze.

Expect Performance and Accessibility ≥ 95 and SEO 100. If anything comes back
below that, send me the report and I'll fix it.

Optional: install the **axe DevTools** extension and run it on `/`, a writing
post, and `/admin/` for a deeper accessibility pass.

---

## Step 8 — Import your Facebook writing

Once the export from Step 1 has arrived and you've unzipped it:

```bash
# Always dry-run first — nothing is written
npm run import:facebook -- --export "D:/fb-export" --dry-run

# Happy with what it lists? Run it for real
npm run import:facebook -- --export "D:/fb-export"
```

**Everything is imported as a draft.** Nothing goes live automatically.

Then review them:

```bash
npm run dev
```

Drafts are visible in dev but never in the live build. Go through them, fix
anything filed in the wrong section, delete the noise, and publish the good
ones. Anything the importer wasn't confident about is listed in
`facebook-review-queue.json` rather than guessed at.

The importer skips files that already exist, so you can adjust and re-run it
safely.

When you're happy:

```bash
git add src/content
git commit -m "Import writing and travel posts from Facebook"
git push
```

---

## Also worth doing, once live

- **Google Search Console** — add the site and submit `/sitemap-index.xml`
- **Teaching and Outreach** — four draft scaffolds exist with the facts already
  on your old site, but the dates say "to confirm". Fill them in and set
  `draft: false` to publish. Until then both pages show an empty state.
- **Analytics** — Google Analytics (`G-P6X673H4S7`) is carried over. Cloudflare
  Web Analytics is cookieless and needs no consent banner; say the word and
  I'll swap it.
- **Fix the stale git remote** (cosmetic — pushes work via GitHub's redirect):
  ```bash
  git remote set-url origin https://github.com/aaimtiaz/aaimtiaz.github.io.git
  ```

---

## Appendix — Option B: staying on GitHub Pages

If you'd rather keep `aaimtiaz.github.io`, skip Steps 3 and 4 and replace
`.github/workflows/static.yml` with this. The important difference from the old
one is `path: dist` instead of `path: '.'`, plus an actual build:

```yaml
name: Deploy site to Pages
on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`site` in `astro.config.mjs` already says `https://aaimtiaz.github.io`, so
nothing changes there. Step 5's cutover still applies, except you keep the
workflow file (replaced, not deleted) and leave GitHub Pages enabled.

One caveat: `_redirects` and `_headers` are Cloudflare features and do nothing
on GitHub Pages, so the old `.html` URLs would 404 rather than redirect. Given
the site is small and mostly linked from your own CV, that's a minor loss — but
it is a real one, and it's the main technical argument for Cloudflare.

---

## If a session runs out mid-way

`REBUILD-PLAN.md` in this folder has a progress tracker at the top. Point a new
session at it and say "continue from the tracker" — it records what's done,
what's pending, and the decisions already made.
