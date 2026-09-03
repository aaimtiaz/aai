# Finishing the rebuild — step by step

**Hosting decision: staying on GitHub Pages at `aaimtiaz.github.io`.**
That keeps your existing, already-indexed URL. No migration, no cost, no DNS.

Everything that could be done without your accounts is done and pushed to the
`redesign` branch. Your live site is untouched: `main` still holds the old one.

## What's already been done for this choice

- `.github/workflows/static.yml` **rewritten** to build Astro and publish
  `dist/` — the old one uploaded the whole repo folder, which would now put
  your `src/` and `package.json` on the live web.
- `site` in `astro.config.mjs` already reads `https://aaimtiaz.github.io`, so
  canonical URLs, the sitemap and RSS are correct as-is.
- **Old URLs kept alive.** GitHub Pages has no redirect support, so
  `/research.html`, `/writings.html`, `/teaching.html`, `/outreach.html` and
  `/admin.html` are now real files that forward to their new homes with a
  `canonical` tag pointing the right way.
- **Your old CV link still works.** `/assets/pdfs/Curriculum Vitae_Ahmad
  Al-Imtiaz.pdf` is preserved at that exact path — that link may be on
  applications you have already submitted, which makes it the most expensive
  404 on the site.
- `.nojekyll` added so Jekyll can never strip the `_astro/` folder, which holds
  every stylesheet, script and generated image.

One thing that is genuinely lost versus Cloudflare: GitHub Pages cannot set
HTTP headers, so the `X-Frame-Options` / `Referrer-Policy` set is gone. The
admin page is still kept out of search by its `noindex` meta tag and by
`robots.txt`, so nothing important depends on it.

---

## Step 1 — Request the Facebook export (do this first)

Meta takes **hours to several days** to build the archive, so start it now and
let it run while you do everything else.

1. Facebook → **Settings** → **Accounts Centre**
2. **Your information and permissions** → **Download your information**
3. **Request a download** → your profile → **Select types of information**
4. Tick: **Posts**, **Photos and videos**, **Profile information**, **Events**,
   **Comments**, and **Notes** if offered
5. Set: **Date range: All time** · **Format: JSON** (not HTML) · **Media quality: High**
6. Submit — you'll get a notification when it's ready

**Format must be JSON.** The importer cannot read the HTML version.

When it arrives, unzip it **outside this repo** (e.g. `D:\fb-export`). It
contains private data.

---

## Step 2 — Add your scholar profile links

Currently empty, and the one real content gap left. ORCID, Scholar and ADS are
how a committee verifies an academic exists.

Open `src/data/site.ts` and fill in `profiles`:

```ts
profiles: {
  orcid:   'https://orcid.org/0000-0000-0000-0000',
  scholar: 'https://scholar.google.com/citations?user=XXXXXXX',
  ads:     'https://ui.adsabs.harvard.edu/public-libraries/XXXXXXX',
  github:  'https://github.com/aaimtiaz',
  arxiv:   '',
},
```

Leave any you don't have as `''` — empty ones are skipped everywhere rather
than rendering a dead link. They show on the homepage, the CV page, the footer,
and in the `Person` JSON-LD that Google reads.

---

## Step 3 — Check it locally

There is no preview deployment on GitHub Pages, so this local check *is* your
pre-launch test. `npm run preview` serves the exact folder that will be
published, which makes it a faithful one.

```bash
npm run build
npm run preview
```

Open http://localhost:4321 and confirm:

- Every page loads: `/`, `/research/`, `/writing/`, `/travel/`, `/teaching/`,
  `/outreach/`, `/cv/`, `/admin/`
- A Bengali post reads correctly: `/writing/udash-bikel/` — the poem should
  break across lines exactly as written, not run together
- Your profile links from Step 2 appear on the homepage and CV page
- Visit something that doesn't exist, e.g. `/nonsense/` — you should get the
  404 page
- Click the ☾ button in the header — dark mode should switch cleanly
- Press Tab from the top of a page — the first focused thing should be a
  "Skip to content" link, and every focused element should show a visible ring
- Shrink the window to phone width — the nav should collapse to a Menu button

Stop the server with Ctrl+C.

---

## Step 4 — Go live

Once Step 3 looks right:

```bash
git checkout main
git merge redesign
```

Then remove the files the new site replaces:

```bash
git rm index.html research.html writings.html teaching.html outreach.html admin.html
git rm -r assets
git commit -m "Cut over to the Astro site"
git push origin main
```

Note you are **not** deleting `.github/workflows/static.yml` — it has been
rewritten rather than removed, and it is what publishes the site.

Nothing is lost: every deleted file stays in git history.

**Watch the deploy:** GitHub → your repo → **Actions**. The "Deploy site to
Pages" run takes a couple of minutes. If it goes red, send me the log.

**Then check the live site** at https://aaimtiaz.github.io — same list as
Step 3, plus:

- An old link still works: https://aaimtiaz.github.io/writings.html should
  forward to `/writing/`
- Your old CV link still works:
  `https://aaimtiaz.github.io/assets/pdfs/Curriculum%20Vitae_Ahmad%20Al-Imtiaz.pdf`

### If the Actions run fails on permissions

GitHub → repo **Settings** → **Pages** → set **Source** to **GitHub Actions**
(not "Deploy from a branch"), then re-run the workflow from the Actions tab.

---

## Step 5 — Create your publishing token and test it

The panel is at **https://aaimtiaz.github.io/admin/**. Do this *after* Step 4 —
the panel commits to `main`, so it needs the new site to be there.

**Create the token:**

1. https://github.com/settings/personal-access-tokens/new
2. **Token name:** `website-admin`
3. **Expiration:** 90 days
4. **Repository access:** *Only select repositories* → **`aaimtiaz.github.io`**
5. **Permissions** → Repository permissions → **Contents: Read and write**
   — that one permission, nothing else
6. Generate and copy it immediately (GitHub shows it once)

**Sign in:** open `/admin/`, paste the token, tick "Stay signed in", Sign in.
It should show your GitHub username and the token's expiry. If it says the
token was rejected, the repository selection or permission is wrong.

**Then run these six checks.** Each exercises something that was broken before:

1. **A tricky title.** Publish a post titled `Test: "quoted" and colon` with a
   few lines of Bengali. Then look at the file on GitHub — the Bengali must be
   readable text, not `\u0985` escapes, and the title must be intact.
2. **A big phone photo.** Attach a full-size portrait photo. The panel should
   report something like `4.19 MB → 287 KB`, and the photo must appear **the
   right way up**.
3. **One commit.** Check the repo's commit list — publishing should produce
   exactly *one* commit containing both the post and its image.
4. **Edit and delete.** Edit the test post from the Posts tab, save, confirm no
   duplicate appeared. Then delete it.
5. **Drafts.** Save something as a draft, wait for the deploy, confirm it does
   **not** appear on the live site.
6. **On your phone.** Write a whole post from your phone on mobile data. That's
   the case the panel was built for.

Delete the test posts when you're done.

Each publish triggers a rebuild, so posts go live about two minutes after you
press Publish, not instantly.

---

## Step 6 — Run the quality check

On the live site in Chrome: **F12** → **Lighthouse** → tick Performance,
Accessibility, Best Practices, SEO → **Mobile** → Analyze.

Expect Performance and Accessibility ≥ 95, SEO 100. Best Practices may lose a
few points for the missing security headers, which GitHub Pages cannot set.
Send me the report if anything else comes back low.

---

## Step 7 — Import your Facebook writing

Once the Step 1 export has arrived and you've unzipped it:

```bash
# Dry run first — writes nothing
npm run import:facebook -- --export "D:/fb-export" --dry-run

# Happy with the list? Run it for real
npm run import:facebook -- --export "D:/fb-export"
```

**Everything imports as a draft.** Nothing goes live automatically.

Review them:

```bash
npm run dev
```

Drafts show in dev but never in the live build. Go through them, fix anything
filed in the wrong section, delete the noise, keep the good ones. Posts the
importer wasn't confident about are listed in `facebook-review-queue.json`
rather than guessed at.

It skips files that already exist, so you can adjust and re-run safely.

When happy:

```bash
git add src/content
git commit -m "Import writing and travel posts from Facebook"
git push
```

---

## Also worth doing, once live

- **Google Search Console** — add the property and submit
  `https://aaimtiaz.github.io/sitemap-index.xml`
- **Teaching and Outreach** — four draft scaffolds exist with facts from your
  old site, but the dates say "to confirm". Fill them in and set
  `draft: false`. Until then both pages show an empty state.
- **Analytics** — Google Analytics (`G-P6X673H4S7`) is carried over. Say the
  word if you'd rather have something cookieless with no consent banner.
- **Fix the stale git remote** (cosmetic — pushes work via GitHub's redirect):
  ```bash
  git remote set-url origin https://github.com/aaimtiaz/aaimtiaz.github.io.git
  ```
- **A custom domain later** is still easy if you change your mind: buy one,
  add a `CNAME` file, and update `site` in `astro.config.mjs`. Nothing else
  in the build would need to change.

---

## If a session runs out mid-way

`REBUILD-PLAN.md` has a progress tracker at the top. Point a new session at it
and say "continue from the tracker" — it records what's done, what's pending,
and the decisions already made.
