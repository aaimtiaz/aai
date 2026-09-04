import {
  getToken, setToken, clearToken, verifyToken,
  commitFiles, listContent, readFile, type FileWrite,
} from './github';
import { buildMarkdown, splitMarkdown, slugify, detectLang, guessForm } from './frontmatter';
import {
  getImages, loadFromPost, addFiles, find as findImage, remove as removeImage,
  move as moveImage, setCover, buildSave, reset as resetImages,
  bodySnippet, replaceInBody, bodyHasImage, allPaths,
} from './images';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loginPanel = $('login-panel');
const app = $('app');
const statusEl = $('status');
const loginStatus = $('login-status');

type Collection = 'writing' | 'travel' | 'outreach' | 'teaching';

/** Which file is being edited. null means a new post. */
let editingPath: string | null = null;
/** That post's frontmatter as it was on disk, so an edit preserves fields the
 *  form does not show (series, order, publication, and anything added later). */
let editingData: Record<string, any> = {};
let inventory: { path: string; sha: string }[] = [];
/** Branch head SHA: the cache generation for everything derived from it. */
let headSha = '';

/* ------------------------------------------------------------------ status */

function setStatus(el: HTMLElement, msg: string, kind: 'ok' | 'err' | 'busy' | '' = '') {
  el.textContent = msg;
  el.className = `status ${kind}`.trim();
}

/* -------------------------------------------------------------------- auth */

async function showApp() {
  loginPanel.hidden = true;
  app.hidden = false;
  try {
    const { login, expiry } = await verifyToken();
    const when = expiry ? ` · token expires ${new Date(expiry).toLocaleDateString()}` : '';
    $('whoami').textContent = `${login}${when}`;
  } catch (e) {
    // A stored token that no longer works should send you back to sign-in
    // rather than failing later, mid-publish.
    clearToken();
    showLogin();
    setStatus(loginStatus, (e as Error).message, 'err');
  }
}

function showLogin() {
  loginPanel.hidden = false;
  app.hidden = true;
}

$('login-btn').addEventListener('click', async () => {
  const input = $<HTMLInputElement>('token');
  const token = input.value.trim();
  if (!token) return setStatus(loginStatus, 'Paste a token first.', 'err');

  setStatus(loginStatus, 'Checking token...', 'busy');
  setToken(token, $<HTMLInputElement>('remember').checked);
  try {
    // Verify before storing anything durable: the old panel accepted any
    // string and only discovered a bad token at publish time.
    await verifyToken();
    input.value = '';
    setStatus(loginStatus, '', '');
    await showApp();
    loadList();
  } catch (e) {
    clearToken();
    setStatus(loginStatus, (e as Error).message, 'err');
  }
});

$('logout-btn').addEventListener('click', () => {
  clearToken();
  showLogin();
});

/* ------------------------------------------------------------------- views */

document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view!;
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b === btn)),
    );
    $('view-editor').hidden = view !== 'editor';
    $('view-list').hidden = view !== 'list';
    if (view === 'list') loadList();
  });
});

/* --------------------------------------------------------- write / preview */

document.querySelectorAll<HTMLButtonElement>('[data-pane]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const pane = btn.dataset.pane!;
    document.querySelectorAll<HTMLButtonElement>('[data-pane]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b === btn)),
    );
    const body = $<HTMLTextAreaElement>('body');
    const preview = $('preview');
    if (pane === 'preview') {
      // Loaded on demand. Together these are most of the bundle, and they are
      // only ever used here — importing them eagerly meant every visit to the
      // Posts tab parsed ~180 KB of JS it never called.
      const [{ marked }, { default: DOMPurify }] = await Promise.all([
        import('marked'),
        import('dompurify'),
      ]);
      // Rendered, then sanitised, then injected — the input is the author's
      // own Markdown, but sanitising keeps a pasted <script> inert.
      preview.innerHTML = DOMPurify.sanitize(marked.parse(body.value, { async: false }) as string);
      // Match the real post page: poems keep their line breaks, prose is
      // justified. Without this the preview would misrepresent both.
      const form = $<HTMLSelectElement>('form-field').value;
      const isPoem = collectionSel.value === 'writing' && form === 'poem';
      preview.className = `preview ${isPoem ? 'is-poem' : 'is-prose'}`;
      preview.lang = $<HTMLSelectElement>('lang').value;
      body.hidden = true;
      preview.hidden = false;
    } else {
      body.hidden = false;
      preview.hidden = true;
    }
  });
});

/* ----------------------------------------------------------------- toolbar */

$('toolbar').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  const ta = $<HTMLTextAreaElement>('body');
  const { selectionStart: s, selectionEnd: end, value } = ta;
  const selected = value.slice(s, end);

  let replacement = selected;
  if (btn.dataset.wrap) {
    const w = btn.dataset.wrap;
    replacement = `${w}${selected || 'text'}${w}`;
  } else if (btn.dataset.prefix) {
    replacement = (selected || 'text')
      .split('\n')
      .map((l) => btn.dataset.prefix + l)
      .join('\n');
  } else if (btn.hasAttribute('data-link')) {
    replacement = `[${selected || 'text'}](https://)`;
  }

  ta.setRangeText(replacement, s, end, 'end');
  ta.focus();
  scheduleAutosave();
});

/* -------------------------------------------------------------------- form */

const collectionSel = $<HTMLSelectElement>('collection');

function syncCollectionFields() {
  const c = collectionSel.value;
  document.querySelectorAll<HTMLElement>('[data-only]').forEach((el) => {
    el.hidden = el.dataset.only !== c;
  });
}
collectionSel.addEventListener('change', syncCollectionFields);

// Auto-slug, but stop the moment the field is edited by hand.
let slugTouched = false;
$('slug').addEventListener('input', () => { slugTouched = true; });
$('title').addEventListener('input', () => {
  const title = $<HTMLInputElement>('title').value;
  if (!slugTouched && !editingPath) $<HTMLInputElement>('slug').value = slugify(title);
  // Bengali in the title is a reliable signal; it saves a step on most posts.
  if (title) $<HTMLSelectElement>('lang').value = detectLang(title);
  scheduleAutosave();
});

$('body').addEventListener('input', () => {
  const body = $<HTMLTextAreaElement>('body').value;
  if (collectionSel.value === 'writing' && body.length > 40) {
    $<HTMLSelectElement>('form-field').value = guessForm(body);
  }
  scheduleAutosave();
});

/* ------------------------------------------------------------------ images */

const PLACEMENT_LABEL = { cover: 'Cover', body: 'In the text', gallery: 'Gallery' } as const;
const bodyEl = () => $<HTMLTextAreaElement>('body');

const picker = $<HTMLInputElement>('image');
picker.addEventListener('change', async () => {
  const files = picker.files;
  if (!files?.length) return;
  const info = $('image-info');
  info.textContent = files.length === 1 ? 'Resizing…' : `Resizing ${files.length} images…`;
  info.textContent = await addFiles(files);
  // Clearing lets the same file be picked again after a removal.
  picker.value = '';
  renderImages();
  scheduleAutosave();
});

function imgField(field: string, placeholder: string, value: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'text';
  el.dataset.field = field;
  el.placeholder = placeholder;
  el.value = value;
  return el;
}

function imgButton(act: string, label: string, disabled = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.act = act;
  b.textContent = label;
  b.disabled = disabled;
  return b;
}

function renderImages() {
  const list = $('image-list');
  const imgs = getImages();
  $('image-empty').hidden = imgs.length > 0;

  const frag = document.createDocumentFragment();
  imgs.forEach((img, i) => {
    const li = document.createElement('li');
    li.dataset.id = img.id;
    li.dataset.placement = img.placement;

    const thumb = document.createElement('img');
    thumb.className = 'imglist__thumb';
    thumb.src = img.url;
    thumb.alt = '';
    thumb.loading = 'lazy';
    // A referenced file that is missing from the repo should say so rather
    // than leaving a broken-image glyph with no explanation.
    thumb.addEventListener('error', () => { thumb.replaceWith(missingThumb()); }, { once: true });
    li.append(thumb);

    const main = document.createElement('div');
    main.className = 'imglist__main';

    const where = document.createElement('div');
    where.className = 'imglist__where';
    const badge = document.createElement('span');
    badge.className = 'imglist__badge';
    badge.textContent = PLACEMENT_LABEL[img.placement];
    where.append(badge);
    const note = document.createElement('span');
    note.textContent = img.info ?? img.name;
    where.append(note);
    main.append(where);

    main.append(imgField('alt', 'What the picture shows — read aloud to blind readers', img.alt));
    main.append(imgField('caption', 'Caption, shown under the picture', img.caption));
    main.append(imgField('credit', 'Credit — the photographer, if it is not you', img.credit));

    const acts = document.createElement('div');
    acts.className = 'imglist__actions';
    acts.append(imgButton('up', '↑', i === 0));
    acts.append(imgButton('down', '↓', i === imgs.length - 1));
    if (img.placement !== 'cover') acts.append(imgButton('cover', 'Make cover'));
    if (img.placement !== 'body') acts.append(imgButton('insert', 'Put in the text'));
    if (img.placement !== 'gallery') acts.append(imgButton('gallery', 'Move to gallery'));
    acts.append(imgButton('remove', 'Remove'));
    main.append(acts);

    li.append(main);
    frag.append(li);
  });

  list.replaceChildren(frag);
}

function missingThumb(): HTMLElement {
  const el = document.createElement('span');
  el.className = 'imglist__thumb';
  el.textContent = '?';
  el.title = 'This file is not in the repository';
  return el;
}

/** Keep a body image's Markdown in step with its alt and caption fields. */
function syncBodyImage(id: string) {
  const img = findImage(id);
  if (!img || img.placement !== 'body') return;
  const ta = bodyEl();
  if (!bodyHasImage(ta.value, img.name)) return;
  ta.value = replaceInBody(ta.value, img.name, bodySnippet(img));
}

/** Drop the image's Markdown out of the body, for a placement change. */
function pullFromBody(id: string) {
  const img = findImage(id);
  if (!img) return;
  const ta = bodyEl();
  ta.value = replaceInBody(ta.value, img.name, null).trim();
}

/** Place the image at the cursor, so text and pictures can alternate. */
function insertIntoBody(id: string) {
  const img = findImage(id);
  if (!img) return;
  const ta = bodyEl();
  if (bodyHasImage(ta.value, img.name)) {
    ta.value = replaceInBody(ta.value, img.name, bodySnippet(img));
  } else {
    const at = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, at).replace(/\s+$/, '');
    const after = ta.value.slice(at).replace(/^\s+/, '');
    const snippet = bodySnippet(img);
    ta.value = [before, snippet, after].filter(Boolean).join('\n\n');
    const caret = (before ? before.length + 2 : 0) + snippet.length;
    ta.focus();
    ta.setSelectionRange(caret, caret);
  }
  img.placement = 'body';
}

$('image-list').addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  const li = t.closest('li');
  const field = t.dataset.field;
  if (!li || !field) return;
  const img = findImage(li.dataset.id!);
  if (!img) return;
  (img as any)[field] = t.value;
  if (field !== 'credit') syncBodyImage(img.id);
  scheduleAutosave();
});

$('image-list').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  const li = btn?.closest('li');
  if (!btn || !li) return;
  const id = li.dataset.id!;
  const img = findImage(id);
  if (!img) return;

  switch (btn.dataset.act) {
    case 'up':     moveImage(id, -1); break;
    case 'down':   moveImage(id, 1); break;
    case 'cover':  pullFromBody(id); setCover(id); break;
    case 'insert': insertIntoBody(id); break;
    case 'gallery': pullFromBody(id); img.placement = 'gallery'; break;
    case 'remove': {
      const label = img.caption || img.alt || img.name;
      if (!confirm(`Remove ${label}? The file is deleted from the repository when you save.`)) return;
      pullFromBody(id);
      removeImage(id);
      break;
    }
    default: return;
  }
  renderImages();
  scheduleAutosave();
});

/* --------------------------------------------------------------- autosave */

let autosaveTimer: number | undefined;
const draftKey = () => `admin_draft_${$<HTMLInputElement>('slug').value || 'untitled'}`;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(draftKey(), JSON.stringify(readForm()));
      $('autosave').textContent = `Saved locally at ${new Date().toLocaleTimeString()}`;
    } catch {}
  }, 1200);
}

function restoreAutosave() {
  // On a phone an incoming call kills the tab. This is the difference between
  // the tool being trusted and abandoned.
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('admin_draft_'));
    if (!keys.length) return;
    const raw = localStorage.getItem(keys[keys.length - 1]);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved.title && !saved.body) return;
    if (!confirm(`Restore your unsaved draft "${saved.title || 'untitled'}"?`)) return;
    writeForm(saved);
  } catch {}
}

/* ----------------------------------------------------------- form <-> data */

function readForm() {
  return {
    collection: collectionSel.value as Collection,
    title: $<HTMLInputElement>('title').value.trim(),
    slug: $<HTMLInputElement>('slug').value.trim(),
    lang: $<HTMLSelectElement>('lang').value,
    form: $<HTMLSelectElement>('form-field').value,
    date: $<HTMLInputElement>('date').value,
    dateNote: $<HTMLInputElement>('dateNote').value.trim(),
    location: $<HTMLInputElement>('location').value.trim(),
    excerpt: $<HTMLInputElement>('excerpt').value.trim(),
    tags: $<HTMLInputElement>('tags').value.trim(),
    body: $<HTMLTextAreaElement>('body').value,
    note: $<HTMLTextAreaElement>('note').value.trim(),
  };
}

function writeForm(d: Partial<ReturnType<typeof readForm>>) {
  if (d.collection) collectionSel.value = d.collection;
  $<HTMLInputElement>('title').value = d.title ?? '';
  $<HTMLInputElement>('slug').value = d.slug ?? '';
  $<HTMLSelectElement>('lang').value = d.lang ?? 'en';
  $<HTMLSelectElement>('form-field').value = d.form ?? 'prose';
  $<HTMLInputElement>('date').value = d.date ?? new Date().toISOString().slice(0, 10);
  $<HTMLInputElement>('dateNote').value = d.dateNote ?? '';
  $<HTMLInputElement>('location').value = d.location ?? '';
  $<HTMLInputElement>('excerpt').value = d.excerpt ?? '';
  $<HTMLInputElement>('tags').value = d.tags ?? '';
  $<HTMLTextAreaElement>('body').value = d.body ?? '';
  $<HTMLTextAreaElement>('note').value = d.note ?? '';
  syncCollectionFields();
}

function resetForm() {
  editingPath = null;
  editingData = {};
  slugTouched = false;
  resetImages();
  renderImages();
  writeForm({ date: new Date().toISOString().slice(0, 10) });
  $('editor-title').textContent = 'New post';
  $('delete-btn').hidden = true;
  $('image-info').textContent = 'Pick as many as you like at once.';
  setStatus(statusEl, '', '');
}

$('new-btn').addEventListener('click', () => {
  if (confirm('Start a new post? Anything unsaved here will be cleared.')) resetForm();
});

/* ----------------------------------------------------------------- publish */

async function save(draft: boolean) {
  const f = readForm();
  if (!f.title || !f.body) {
    return setStatus(statusEl, 'A title and some text are required.', 'err');
  }

  const slug = f.slug || slugify(f.title);
  const dir = `src/content/${f.collection}`;
  const mdPath = `${dir}/${slug}.md`;

  const buttons = [$('publish-btn'), $('draft-btn'), $('delete-btn')] as HTMLButtonElement[];
  buttons.forEach((b) => (b.disabled = true));

  try {
    // Uploads, deletions of removed images, and the body with any provisional
    // filenames rewritten to their final names.
    const img = buildSave(slug, f.collection, f.body);
    const files: FileWrite[] = [...img.writes];
    // The body can have been rewritten, so put it back where the author sees it.
    $<HTMLTextAreaElement>('body').value = img.body;
    renderImages();

    // Start from the frontmatter the post already had, so fields this form has
    // no input for survive an edit. Rebuilding from an empty object is how
    // opening an imported set and saving it stripped `series`, `location`
    // and a five-image gallery, and turned `source: facebook` into `original`.
    const data: Record<string, unknown> = { ...editingData };

    data.title = f.title;
    data.date = f.date || new Date().toISOString().slice(0, 10);
    data.dateNote = f.dateNote;
    data.lang = f.lang;
    data.excerpt = f.excerpt;
    data.tags = f.tags ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    data.draft = draft;
    // Provenance belongs to the post, not to whoever last edited it.
    data.source = editingData.source ?? 'original';

    // Written unconditionally: `undefined` drops the key, which is what makes
    // removing the last image actually remove `cover` from the file.
    data.cover = img.cover;
    data.coverAlt = img.cover ? img.coverAlt : undefined;
    data.coverCaption = img.cover && img.coverCaption ? img.coverCaption : undefined;
    data.gallery = img.gallery.length ? img.gallery : undefined;
    if (f.collection === 'writing') { data.form = f.form; if (f.note) data.note = f.note; }
    if (f.collection === 'travel' && f.location) data.location = { name: f.location };

    files.push({ path: mdPath, content: buildMarkdown(data, img.body) });

    // Renaming the slug on an edit must remove the old file, or the site ends
    // up serving both URLs.
    if (editingPath && editingPath !== mdPath) {
      files.push({ path: editingPath, content: null });
    }

    const verb = draft ? 'Draft' : 'Publish';
    const { url } = await commitFiles(
      files,
      `${verb}: ${f.title}`,
      (s) => setStatus(statusEl, s, 'busy'),
    );

    try { localStorage.removeItem(draftKey()); } catch {}
    editingPath = mdPath;
    // The file on disk is now this, so a second save preserves from here.
    editingData = data;

    setStatus(
      statusEl,
      draft
        ? `Saved as a draft. It will not appear on the live site until you publish it.\n${url}`
        : `Published. The site rebuilds in about a minute, then it is live at /${f.collection}/${slug}/\n${url}`,
      'ok',
    );
    inventory = []; headSha = '';
  } catch (e) {
    const msg = (e as Error).message;
    setStatus(
      statusEl,
      /409|fast forward|not a fast/i.test(msg)
        ? `Someone (or another tab) changed the repository while you were writing.\nNothing was saved. Press Publish again to retry against the latest version.`
        : `Nothing was saved — the whole change is applied as one commit, so there are no leftover files.\n\n${msg}`,
      'err',
    );
  } finally {
    buttons.forEach((b) => (b.disabled = false));
    $('delete-btn').hidden = !editingPath;
  }
}

$('post-form').addEventListener('submit', (e) => { e.preventDefault(); save(false); });
$('draft-btn').addEventListener('click', () => save(true));

$('delete-btn').addEventListener('click', async () => {
  if (!editingPath) return;
  if (!confirm('Delete this post? It stays in the git history, so it can be recovered.')) return;
  const files: FileWrite[] = [{ path: editingPath, content: null }];
  // Every image the post referenced, not only the cover: a gallery of twenty
  // used to be left behind in the repository when the entry was deleted.
  const collection = editingPath.split('/')[2];
  for (const path of allPaths(collection)) files.push({ path, content: null });
  try {
    await commitFiles(files, `Delete: ${$<HTMLInputElement>('title').value}`,
      (s) => setStatus(statusEl, s, 'busy'));
    setStatus(statusEl, 'Deleted.', 'ok');
    inventory = []; headSha = '';
    resetForm();
  } catch (e) {
    setStatus(statusEl, (e as Error).message, 'err');
  }
});

/* -------------------------------------------------------------- post list */

interface Row {
  path: string;
  section: string;
  title: string;
  date: string;
  lang: string;
  draft: boolean;
  imported: boolean;
  excerpt: string;
  cover?: string;
  /** Relative paths of every image the entry references. */
  images?: string[];
  /** Was missing from this interface, so fetchRows never copied it and the
   *  #known-tags datalist has been empty since it was written. */
  tags: string[];
}

let rows: Row[] = [];
const selected = new Set<string>();

/** Run `work` over `items` at most `n` at a time.
 *  With ~190 posts, firing every read at once floods the connection pool and
 *  makes the whole list feel broken; eight keeps it quick and well-behaved. */
async function mapLimit<T, R>(items: T[], n: number, work: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await work(items[i]);
      }
    }),
  );
  return out;
}

// localStorage, not sessionStorage: the cache used to die with the tab, so
// closing and reopening the admin paid for every row again. It is keyed on
// the commit SHA, so it still self-invalidates on any commit.
const CACHE_KEY = 'admin_rows_cache';

async function fetchRows(treeKey: string, onProgress: (done: number, total: number) => void) {
  // Cached against the tree SHA: one slow load per session, instant after,
  // and automatically invalid the moment anything is committed.
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (hit?.key === treeKey) return hit.rows as Row[];
  } catch {}

  let done = 0;
  const result = await mapLimit(inventory, 8, async (item) => {
    const raw = await readFile(item.path);
    const { data, body } = splitMarkdown(raw);
    onProgress(++done, inventory.length);
    return {
      path: item.path,
      section: item.path.split('/')[2],
      title: data.title ?? item.path,
      date: data.date ? String(data.date).slice(0, 10) : '',
      lang: data.lang ?? 'en',
      draft: data.draft === true,
      imported: data.source === 'facebook',
      // Truncate before scanning. The other order ran a whitespace regex over
      // the whole body — up to ~15 KB — and then kept 140 characters of it.
      excerpt: (data.excerpt ?? body ?? '').slice(0, 400).replace(/\s+/g, ' ').trim().slice(0, 140),
      cover: data.cover,
      // Every image the entry references, so deleting it can take its
      // photographs with it rather than orphaning a whole gallery.
      images: [
        data.cover,
        ...((data.gallery ?? []) as any[]).map((g) => g?.src),
        ...[...String(body).matchAll(/!\[[^\]]*\]\((\.\/images\/[^)\s"]+)/g)].map((m) => m[1]),
      ].filter((x): x is string => typeof x === 'string' && x.startsWith('./images/')),
      tags: Array.isArray(data.tags) ? data.tags : [],
    } as Row;
  });

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ key: treeKey, rows: result }));
  } catch {}
  return result;
}

function visibleRows(): Row[] {
  const filter = $<HTMLSelectElement>('list-filter').value;
  const section = $<HTMLSelectElement>('list-section').value;
  return rows
    .filter((r) => {
      if (filter === 'drafts' && !r.draft) return false;
      if (filter === 'published' && r.draft) return false;
      if (filter === 'imported' && !r.imported) return false;
      if (section !== 'all' && r.section !== section) return false;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Update only the things that change when the selection changes.
 *
 * This used to call renderList(), which begins by emptying the list — so
 * ticking one checkbox tore down and rebuilt ~1,880 elements and ~750 event
 * listeners to update a counter. That was the lag.
 */
function syncSelectionUI() {
  const shown = visibleRows();
  $('list-status').textContent =
    `${shown.length} of ${rows.length} post${rows.length === 1 ? '' : 's'}` +
    (selected.size ? ` · ${selected.size} selected` : '');
  $('bulk-bar').hidden = selected.size === 0;
  $('bulk-count').textContent = String(selected.size);
}

function renderList() {
  const list = $<HTMLUListElement>('post-list');
  const shown = visibleRows();
  list.innerHTML = '';
  syncSelectionUI();

  // Assemble off-document and attach once, rather than touching the live DOM
  // 188 times and forcing a layout on each.
  const frag = document.createDocumentFragment();

  for (const r of shown) {
    const li = document.createElement('li');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = selected.has(r.path);
    check.setAttribute('aria-label', `Select ${r.title}`);
    check.addEventListener('change', () => {
      check.checked ? selected.add(r.path) : selected.delete(r.path);
      syncSelectionUI();   // NOT renderList — see the note on syncSelectionUI
    });

    const left = document.createElement('div');
    left.className = 'post-list__main';
    const title = document.createElement('strong');
    title.textContent = r.title;
    title.lang = r.lang;
    const meta = document.createElement('div');
    meta.className = 'post-list__meta';
    meta.textContent = [
      r.section, r.date,
      r.draft ? 'draft' : 'live',
      r.imported ? 'imported' : '',
      r.cover ? 'has image' : '',
    ].filter(Boolean).join(' · ');
    const excerpt = document.createElement('div');
    excerpt.className = 'post-list__excerpt';
    excerpt.lang = r.lang;
    excerpt.textContent = r.excerpt;
    left.append(title, meta, excerpt);

    const actions = document.createElement('div');
    actions.className = 'post-list__actions';

    const pub = document.createElement('button');
    pub.type = 'button';
    pub.className = 'btn btn--ghost btn--sm';
    pub.textContent = r.draft ? 'Publish' : 'Unpublish';
    pub.addEventListener('click', () => setDraft([r], !r.draft));

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn--ghost btn--sm';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openForEdit(r.path));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn--danger btn--sm';
    del.textContent = 'Delete';
    del.addEventListener('click', () => removeRows([r]));

    actions.append(pub, edit, del);
    li.append(check, left, actions);
    frag.append(li);
  }
  list.append(frag);
}

async function loadList(force = false) {
  const listStatus = $('list-status');
  listStatus.textContent = 'Loading…';
  try {
    if (force || !inventory.length) {
      const listing = await listContent();
      inventory = listing.files;
      headSha = listing.head;
      if (force) { try { localStorage.removeItem(CACHE_KEY); } catch {} }
    }
    // Keyed on the commit SHA. An earlier version hashed only the first 64
    // characters of the joined blob SHAs plus the file count, so a change to
    // any file past the first two — with the count unchanged, as a rename is —
    // produced an identical key and served stale rows.
    rows = await fetchRows(headSha, (done, total) => {
      listStatus.textContent = `Loading ${done} of ${total}…`;
    });

    const tags = new Set<string>();
    rows.forEach((r) => r.tags.forEach((t) => tags.add(t)));
    $('known-tags').innerHTML = [...tags].map((t) => `<option value="${t}"></option>`).join('');

    selected.clear();
    renderList();
  } catch (e) {
    listStatus.textContent = `Could not load posts: ${(e as Error).message}`;
  }
}

/** Flip `draft:` on one or many posts in a single commit. */
async function setDraft(targets: Row[], draft: boolean) {
  if (!targets.length) return;
  const verb = draft ? 'Unpublish' : 'Publish';
  if (targets.length > 1 && !confirm(`${verb} ${targets.length} posts?`)) return;

  setStatus(statusEl, `${verb}ing ${targets.length}…`, 'busy');
  try {
    const files: FileWrite[] = await mapLimit(targets, 8, async (r) => {
      const raw = await readFile(r.path);
      const { data, body } = splitMarkdown(raw);
      data.draft = draft;
      return { path: r.path, content: buildMarkdown(data, body) };
    });

    await commitFiles(files, `${verb}: ${targets.length} post${targets.length === 1 ? '' : 's'}`,
      (s) => setStatus(statusEl, s, 'busy'));

    targets.forEach((t) => { t.draft = draft; });
    selected.clear();
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    inventory = []; headSha = '';
    renderList();
    setStatus(statusEl, `${verb}ed ${targets.length}. The site rebuilds in about a minute.`, 'ok');
  } catch (e) {
    setStatus(statusEl, (e as Error).message, 'err');
  }
}

/** Delete one or many posts, with all their images, in a single commit. */
async function removeRows(targets: Row[]) {
  if (!targets.length) return;
  const what = targets.length === 1 ? `“${targets[0].title}”` : `${targets.length} posts`;
  if (!confirm(`Delete ${what}? They stay in the git history and can be recovered.`)) return;

  setStatus(statusEl, `Deleting ${targets.length}…`, 'busy');
  try {
    const files: FileWrite[] = [];
    for (const r of targets) {
      files.push({ path: r.path, content: null });
      // Paths are "./images/x.webp", relative to the entry file.
      const dir = r.path.replace(/\/[^/]+\.md$/, '');
      for (const rel of new Set(r.images ?? (r.cover ? [r.cover] : []))) {
        files.push({ path: `${dir}/${rel.replace(/^\.\//, '')}`, content: null });
      }
    }

    await commitFiles(files, `Delete ${targets.length} post${targets.length === 1 ? '' : 's'}`,
      (s) => setStatus(statusEl, s, 'busy'));

    const gone = new Set(targets.map((t) => t.path));
    rows = rows.filter((r) => !gone.has(r.path));
    selected.clear();
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    inventory = []; headSha = '';
    if (editingPath && gone.has(editingPath)) resetForm();
    renderList();
    setStatus(statusEl, `Deleted ${targets.length}.`, 'ok');
  } catch (e) {
    setStatus(statusEl, (e as Error).message, 'err');
  }
}

const selectedRows = () => rows.filter((r) => selected.has(r.path));

$('refresh-btn').addEventListener('click', () => loadList(true));
$('list-filter').addEventListener('change', () => { selected.clear(); renderList(); });
$('list-section').addEventListener('change', () => { selected.clear(); renderList(); });
$('select-all').addEventListener('click', () => {
  const shown = visibleRows();
  const allSelected = shown.every((r) => selected.has(r.path));
  shown.forEach((r) => (allSelected ? selected.delete(r.path) : selected.add(r.path)));
  renderList();
});
$('bulk-publish').addEventListener('click', () => setDraft(selectedRows(), false));
$('bulk-unpublish').addEventListener('click', () => setDraft(selectedRows(), true));
$('bulk-delete').addEventListener('click', () => removeRows(selectedRows()));

async function openForEdit(path: string) {
  setStatus(statusEl, 'Loading post...', 'busy');
  try {
    const raw = await readFile(path);
    const { data, body } = splitMarkdown(raw);

    editingPath = path;
    editingData = data;
    slugTouched = true;
    loadFromPost(data, body, path.split('/')[2]);

    writeForm({
      collection: path.split('/')[2] as Collection,
      title: data.title ?? '',
      slug: path.split('/').pop()!.replace(/\.md$/, ''),
      lang: data.lang ?? 'en',
      form: data.form ?? 'prose',
      date: data.date ? String(data.date).slice(0, 10) : '',
      dateNote: data.dateNote ?? '',
      location: data.location?.name ?? '',
      excerpt: data.excerpt ?? '',
      tags: (data.tags ?? []).join(', '),
      body,
      note: data.note ?? '',
    });

    renderImages();
    $('editor-title').textContent = data.title ?? 'Edit post';
    $('delete-btn').hidden = false;
    const n = getImages().length;
    $('image-info').textContent = n
      ? `${n} image${n === 1 ? '' : 's'} on this post. Add more, reorder them, or remove any.`
      : 'Pick as many as you like at once.';

    (document.querySelector('[data-view="editor"]') as HTMLButtonElement).click();
    setStatus(statusEl, '', '');
  } catch (e) {
    setStatus(statusEl, (e as Error).message, 'err');
  }
}

/* -------------------------------------------------------------------- init */

syncCollectionFields();
resetForm();
if (getToken()) {
  showApp().then(() => loadList());
} else {
  showLogin();
}
restoreAutosave();
