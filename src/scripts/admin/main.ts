import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  getToken, setToken, clearToken, verifyToken,
  commitFiles, listContent, readFile, type FileWrite,
} from './github';
import { buildMarkdown, splitMarkdown, slugify, detectLang, guessForm } from './frontmatter';
import { resizeImage, formatBytes } from './image';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loginPanel = $('login-panel');
const app = $('app');
const statusEl = $('status');
const loginStatus = $('login-status');

type Collection = 'writing' | 'travel' | 'outreach' | 'teaching';

/** Which file is being edited. null means a new post. */
let editingPath: string | null = null;
/** The cover already on an edited post, kept when no new image is chosen. */
let existingCover: string | null = null;
let pendingImage: Awaited<ReturnType<typeof resizeImage>> | null = null;
let inventory: { path: string; sha: string }[] = [];

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
  btn.addEventListener('click', () => {
    const pane = btn.dataset.pane!;
    document.querySelectorAll<HTMLButtonElement>('[data-pane]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b === btn)),
    );
    const body = $<HTMLTextAreaElement>('body');
    const preview = $('preview');
    if (pane === 'preview') {
      // Rendered, then sanitised, then injected — the input is the author's
      // own Markdown, but sanitising keeps a pasted <script> inert.
      preview.innerHTML = DOMPurify.sanitize(marked.parse(body.value, { async: false }) as string);
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

$('image').addEventListener('change', async () => {
  const file = $<HTMLInputElement>('image').files?.[0];
  if (!file) return;
  const info = $('image-info');
  info.textContent = 'Resizing...';
  try {
    pendingImage = await resizeImage(file);
    info.textContent =
      `${formatBytes(pendingImage.beforeBytes)} -> ${formatBytes(pendingImage.afterBytes)} ` +
      `(${pendingImage.width}x${pendingImage.height}, WebP)`;
  } catch (e) {
    pendingImage = null;
    info.textContent = `Could not read that image: ${(e as Error).message}`;
  }
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
    coverCaption: $<HTMLInputElement>('coverCaption').value.trim(),
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
  $<HTMLInputElement>('coverCaption').value = d.coverCaption ?? '';
  $<HTMLInputElement>('excerpt').value = d.excerpt ?? '';
  $<HTMLInputElement>('tags').value = d.tags ?? '';
  $<HTMLTextAreaElement>('body').value = d.body ?? '';
  $<HTMLTextAreaElement>('note').value = d.note ?? '';
  syncCollectionFields();
}

function resetForm() {
  editingPath = null;
  existingCover = null;
  pendingImage = null;
  slugTouched = false;
  writeForm({ date: new Date().toISOString().slice(0, 10) });
  $('editor-title').textContent = 'New post';
  $('delete-btn').hidden = true;
  $('image-info').textContent = 'Resized automatically before upload — pick the full-size photo.';
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
    const files: FileWrite[] = [];
    let cover = existingCover;

    if (pendingImage) {
      cover = `./images/${slug}.${pendingImage.ext}`;
      files.push({
        path: `${dir}/images/${slug}.${pendingImage.ext}`,
        content: pendingImage.base64,
        encoding: 'base64',
      });
    }

    const data: Record<string, unknown> = {
      title: f.title,
      date: f.date || new Date().toISOString().slice(0, 10),
      dateNote: f.dateNote,
      lang: f.lang,
      excerpt: f.excerpt,
      tags: f.tags ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      draft,
      source: 'original',
    };
    if (cover) { data.cover = cover; data.coverAlt = ''; }
    if (f.coverCaption) data.coverCaption = f.coverCaption;
    if (f.collection === 'writing') { data.form = f.form; if (f.note) data.note = f.note; }
    if (f.collection === 'travel' && f.location) data.location = { name: f.location };

    files.push({ path: mdPath, content: buildMarkdown(data, f.body) });

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
    existingCover = cover;
    pendingImage = null;

    setStatus(
      statusEl,
      draft
        ? `Saved as a draft. It will not appear on the live site until you publish it.\n${url}`
        : `Published. The site rebuilds in about a minute, then it is live at /${f.collection}/${slug}/\n${url}`,
      'ok',
    );
    inventory = [];
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
  if (existingCover) {
    files.push({ path: editingPath.replace(/\/[^/]+\.md$/, '') + '/' + existingCover.replace('./', ''), content: null });
  }
  try {
    await commitFiles(files, `Delete: ${$<HTMLInputElement>('title').value}`,
      (s) => setStatus(statusEl, s, 'busy'));
    setStatus(statusEl, 'Deleted.', 'ok');
    inventory = [];
    resetForm();
  } catch (e) {
    setStatus(statusEl, (e as Error).message, 'err');
  }
});

/* -------------------------------------------------------------- post list */

async function loadList() {
  const listStatus = $('list-status');
  const list = $<HTMLUListElement>('post-list');
  listStatus.textContent = 'Loading...';
  list.innerHTML = '';

  try {
    if (!inventory.length) inventory = await listContent();
    const onlyDrafts = $<HTMLInputElement>('only-drafts').checked;

    // One tree request gives the whole inventory; each row's metadata needs
    // its own read, so this is deliberately sequential-ish and small.
    const rows = await Promise.all(
      inventory.map(async (item) => {
        const raw = await readFile(item.path);
        const { data } = splitMarkdown(raw);
        return { path: item.path, data };
      }),
    );

    const tags = new Set<string>();
    rows.forEach((r) => (r.data.tags ?? []).forEach((t: string) => tags.add(t)));
    $('known-tags').innerHTML = [...tags].map((t) => `<option value="${t}"></option>`).join('');

    const shown = rows.filter((r) => !onlyDrafts || r.data.draft || r.data.source === 'facebook');
    listStatus.textContent = `${shown.length} post${shown.length === 1 ? '' : 's'}`;

    for (const r of shown) {
      const li = document.createElement('li');
      const section = r.path.split('/')[2];

      const left = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = r.data.title ?? r.path;
      if (r.data.lang) title.lang = r.data.lang;
      const meta = document.createElement('div');
      meta.className = 'post-list__meta';
      meta.textContent = [
        section,
        r.data.date ? String(r.data.date).slice(0, 10) : '',
        r.data.draft ? 'draft' : '',
        r.data.source === 'facebook' ? 'imported' : '',
      ].filter(Boolean).join(' · ');
      left.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'post-list__actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn--ghost';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openForEdit(r.path));
      actions.append(edit);

      li.append(left, actions);
      list.append(li);
    }
  } catch (e) {
    listStatus.textContent = `Could not load posts: ${(e as Error).message}`;
  }
}

$('refresh-btn').addEventListener('click', () => { inventory = []; loadList(); });
$('only-drafts').addEventListener('change', loadList);

async function openForEdit(path: string) {
  setStatus(statusEl, 'Loading post...', 'busy');
  try {
    const raw = await readFile(path);
    const { data, body } = splitMarkdown(raw);

    editingPath = path;
    existingCover = data.cover ?? null;
    pendingImage = null;
    slugTouched = true;

    writeForm({
      collection: path.split('/')[2] as Collection,
      title: data.title ?? '',
      slug: path.split('/').pop()!.replace(/\.md$/, ''),
      lang: data.lang ?? 'en',
      form: data.form ?? 'prose',
      date: data.date ? String(data.date).slice(0, 10) : '',
      dateNote: data.dateNote ?? '',
      location: data.location?.name ?? '',
      coverCaption: data.coverCaption ?? '',
      excerpt: data.excerpt ?? '',
      tags: (data.tags ?? []).join(', '),
      body,
      note: data.note ?? '',
    });

    $('editor-title').textContent = data.title ?? 'Edit post';
    $('delete-btn').hidden = false;
    $('image-info').textContent = existingCover
      ? `Keeping the current image. Choose a file to replace it.`
      : 'Resized automatically before upload — pick the full-size photo.';

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
  showApp().then(loadList);
} else {
  showLogin();
}
restoreAutosave();
