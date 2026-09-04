import { toMarkdown, toPlainText } from './serialize';
import * as store from './store';

/**
 * Editing the site from the site.
 *
 * Loaded only when a GitHub token is present, so an ordinary visitor never
 * fetches a byte of it. Two kinds of thing are editable, and they are
 * different problems:
 *
 *   text      any element carrying data-edit="<file>#<path>" becomes
 *             editable in place and is read back as Markdown or plain text.
 *
 *   sections  any element carrying data-section moves, hides or goes, by
 *             rewriting the page's `layout` array — the array is the truth,
 *             and the DOM is kept in step with it optimistically.
 *
 * A new section is the one thing that cannot be shown immediately: rendering
 * it would mean a second copy of Sections.astro written in JavaScript, and two
 * renderers drift. It appears as a placeholder that says so, and is real after
 * the rebuild.
 */

const PALETTE: { type: string; label: string; defaults: Record<string, unknown> }[] = [
  { type: 'prose', label: 'Prose', defaults: { body: 'Write here.', variant: 'body' } },
  { type: 'prose', label: 'Opening line', defaults: { body: 'A short opening line.', variant: 'lede' } },
  { type: 'figure', label: 'Figure with caption', defaults: { caption: '' } },
  { type: 'gallery', label: 'Gallery grid', defaults: { heading: 'Photographs', images: [] } },
  { type: 'intro', label: 'At a glance', defaults: { heading: 'At a glance', body: '' } },
  { type: 'numbers', label: 'Numbers strip', defaults: {} },
  { type: 'collection', label: 'Latest writing', defaults: { heading: 'Writing', source: 'writing', count: 3, href: '/writing/', linkLabel: 'All writing' } },
  { type: 'collection', label: 'Latest travel', defaults: { heading: 'Travel', source: 'travel', count: 3, href: '/travel/', linkLabel: 'All travel' } },
  { type: 'collection', label: 'Selected research', defaults: { heading: 'Selected work', source: 'research', count: 3, href: '/research/', linkLabel: 'All research' } },
  { type: 'links', label: 'Profile links', defaults: { heading: 'Elsewhere' } },
  { type: 'rule', label: 'Divider', defaults: {} },
];

let editing = false;
let bar: HTMLElement;
let countEl: HTMLElement;
let statusEl: HTMLElement;

const sections = () => [...document.querySelectorAll<HTMLElement>('[data-section]')];
const fields = () => [...document.querySelectorAll<HTMLElement>('[data-edit]')];
const pageFiles = () => [...new Set(sections().map((s) => s.dataset.sectionFile!).filter(Boolean))];

/* ------------------------------------------------------------------- chrome */

function style() {
  const css = `
  .ed-bar {
    position: fixed; inset-inline: 0; bottom: 0; z-index: 9999;
    display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
    padding: .6rem .9rem;
    background: var(--surface-raised, #fff); border-block-start: 1px solid var(--border, #ddd);
    box-shadow: 0 -6px 24px rgba(0,0,0,.12);
    font: 500 14px/1.3 var(--font-sans, system-ui);
    color: var(--text, #111);
  }
  .ed-bar__spacer { flex: 1 1 auto; }
  .ed-bar button {
    min-height: 38px; padding: 0 .8rem; border-radius: 6px; cursor: pointer;
    border: 1px solid var(--border-strong, #bbb);
    background: var(--bg, #fff); color: inherit; font: inherit;
  }
  .ed-bar button:hover { border-color: var(--accent, #1b4965); color: var(--accent, #1b4965); }
  .ed-bar button[data-on="true"] { background: var(--accent, #1b4965); color: #fff; border-color: transparent; }
  .ed-bar button:disabled { opacity: .45; cursor: not-allowed; }
  .ed-bar__count { color: var(--text-muted, #666); }
  .ed-bar__status { color: var(--text-muted, #666); flex-basis: 100%; }
  body.ed-on { padding-block-end: 5rem; }

  body.ed-on [data-edit] { outline: 1px dashed transparent; outline-offset: 3px; border-radius: 3px; }
  body.ed-on [data-edit]:hover { outline-color: var(--accent-2, #7d5622); cursor: text; }
  body.ed-on [data-edit][contenteditable="true"] {
    outline: 2px solid var(--accent, #1b4965); outline-offset: 3px;
    background: color-mix(in srgb, var(--accent, #1b4965) 5%, transparent);
  }

  body.ed-on [data-section] { position: relative; }
  body.ed-on [data-section]::after {
    content: ''; position: absolute; inset: -6px; pointer-events: none;
    border: 1px dashed var(--border-strong, #bbb); border-radius: 8px; opacity: .55;
  }
  .ed-tools {
    position: absolute; inset-block-start: -14px; inset-inline-end: 0; z-index: 20;
    display: flex; gap: 2px; padding: 2px;
    background: var(--surface-raised, #fff); border: 1px solid var(--border-strong, #bbb);
    border-radius: 6px;
  }
  .ed-tools button {
    min-width: 30px; height: 28px; padding: 0 .35rem; cursor: pointer;
    border: 0; background: none; color: var(--text-muted, #666);
    font: 500 13px/1 var(--font-sans, system-ui); border-radius: 4px;
  }
  .ed-tools button:hover { background: var(--surface, #eee); color: var(--accent, #1b4965); }
  .ed-tools [data-act="remove"]:hover { color: var(--err, #b3261e); }
  .ed-tools [data-act="drag"] { cursor: grab; touch-action: none; }

  [data-section][data-ed-hidden="true"] { opacity: .4; }
  [data-section].ed-dragging { opacity: .5; }
  .ed-drop { outline: 2px dashed var(--accent, #1b4965); outline-offset: 4px; }

  .ed-add {
    display: block; width: 100%; margin: 1rem 0; padding: .55rem;
    border: 1px dashed var(--border-strong, #bbb); border-radius: 8px;
    background: none; color: var(--text-muted, #666); cursor: pointer;
    font: 500 13px/1 var(--font-sans, system-ui);
  }
  .ed-add:hover { border-color: var(--accent, #1b4965); color: var(--accent, #1b4965); }

  .ed-new {
    padding: 1.25rem; margin-block-end: 2rem; border-radius: 8px;
    border: 1px dashed var(--accent-2, #7d5622); color: var(--text-muted, #666);
    font: 400 14px/1.5 var(--font-sans, system-ui);
  }
  .ed-menu {
    position: fixed; z-index: 10000; max-height: 60vh; overflow: auto;
    padding: .35rem; border-radius: 8px; min-width: 14rem;
    background: var(--surface-raised, #fff); border: 1px solid var(--border-strong, #bbb);
    box-shadow: 0 10px 30px rgba(0,0,0,.18);
  }
  .ed-menu button {
    display: block; width: 100%; text-align: left; padding: .5rem .6rem;
    border: 0; background: none; color: inherit; cursor: pointer; border-radius: 5px;
    font: 400 14px/1.2 var(--font-sans, system-ui);
  }
  .ed-menu button:hover { background: var(--surface, #eee); }
  `;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.append(el);
}

function button(label: string, act: string, title?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.dataset.act = act;
  if (title) b.title = title;
  return b;
}

function buildBar() {
  bar = document.createElement('div');
  bar.className = 'ed-bar';

  const toggle = button('Edit page', 'toggle');
  const spacer = document.createElement('span');
  spacer.className = 'ed-bar__spacer';
  countEl = document.createElement('span');
  countEl.className = 'ed-bar__count';
  const publish = button('Publish', 'publish');
  const discard = button('Discard', 'discard');
  statusEl = document.createElement('span');
  statusEl.className = 'ed-bar__status';

  bar.append(toggle, spacer, countEl, discard, publish, statusEl);
  document.body.append(bar);

  bar.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.act === 'toggle') setEditing(!editing);
    if (b.dataset.act === 'publish') await doPublish();
    if (b.dataset.act === 'discard') doDiscard();
  });

  refresh();
}

function refresh() {
  const n = store.changeCount();
  countEl.textContent = n
    ? `${n} page${n === 1 ? '' : 's'} changed`
    : editing ? 'no changes yet' : '';
  (bar.querySelector('[data-act="toggle"]') as HTMLElement).dataset.on = String(editing);
  (bar.querySelector('[data-act="toggle"]') as HTMLElement).textContent =
    editing ? 'Done editing' : 'Edit page';
  (bar.querySelector('[data-act="publish"]') as HTMLButtonElement).disabled = !n;
  (bar.querySelector('[data-act="discard"]') as HTMLButtonElement).disabled = !n;
}

const status = (msg: string) => { statusEl.textContent = msg; };

/* ------------------------------------------------------------------- text */

function wireField(el: HTMLElement) {
  const [file, path] = (el.dataset.edit ?? '').split('#');
  if (!file || !path) return;
  // Leaving and re-entering edit mode would otherwise stack a second set of
  // listeners on every field, and each would write the same value again.
  if (el.dataset.edWired === '1') { el.contentEditable = 'true'; return; }
  el.dataset.edWired = '1';
  const markdown = el.dataset.editKind === 'markdown';

  el.contentEditable = 'true';
  el.spellcheck = true;

  // Captured as it is typed, not on blur. Blur is the tidier moment, but it
  // means an edit that never loses focus — the tab is closed, the phone is
  // locked — was never recorded at all, and the unsaved-changes warning would
  // not know to fire. A short debounce keeps it from running per keystroke.
  let timer: number | undefined;
  const capture = () => {
    const value = markdown ? toMarkdown(el) : toPlainText(el);
    if (value === el.dataset.edStart) return;
    store.set(file, path, value);
    el.dataset.edStart = value;
    refresh();
    status('Edited. Nothing is live until you publish.');
  };

  el.dataset.edStart = markdown ? toMarkdown(el) : toPlainText(el);
  el.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(capture, 300);
  });
  el.addEventListener('blur', () => { clearTimeout(timer); capture(); });

  // Enter inside a single-line field would insert a <div>, not a new field.
  if (!markdown) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
  }

  // Paste as plain text; the serialiser drops unknown markup anyway, and
  // stripping it here means the editor never *looks* like it kept formatting.
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  });
}

function unwireField(el: HTMLElement) {
  el.contentEditable = 'false';
  el.removeAttribute('spellcheck');
}

/* --------------------------------------------------------------- sections */

/** After any reorder the array indices move, and every address that embeds
 *  one has to move with them or the next edit writes to the wrong section. */
function reindex(file: string) {
  const own = sections().filter((s) => s.dataset.sectionFile === file);
  own.forEach((el, i) => {
    const was = el.dataset.sectionIndex;
    el.dataset.sectionIndex = String(i);
    if (was === String(i)) return;
    el.querySelectorAll<HTMLElement>('[data-edit]').forEach((f) => {
      f.dataset.edit = (f.dataset.edit ?? '').replace(
        new RegExp(`#layout\\.${was}\\.`), `#layout.${i}.`,
      );
    });
  });
}

function moveSection(el: HTMLElement, delta: number) {
  const file = el.dataset.sectionFile!;
  const i = Number(el.dataset.sectionIndex);
  const layout = store.layoutOf(file);
  const j = i + delta;
  if (j < 0 || j >= layout.length) return;

  [layout[i], layout[j]] = [layout[j], layout[i]];
  store.setLayout(file, layout);

  const sibling = delta < 0 ? el.previousElementSibling : el.nextElementSibling;
  if (sibling) {
    delta < 0 ? sibling.before(el) : sibling.after(el);
  }
  reindex(file);
  refresh();
  status('Moved. Nothing is live until you publish.');
}

function hideSection(el: HTMLElement) {
  const file = el.dataset.sectionFile!;
  const i = Number(el.dataset.sectionIndex);
  const layout = store.layoutOf(file);
  const next = !layout[i].hidden;
  layout[i].hidden = next;
  store.setLayout(file, layout);
  el.dataset.edHidden = String(next);
  refresh();
  status(next ? 'Hidden. It stays in the file, so you can bring it back.' : 'Shown again.');
}

function removeSection(el: HTMLElement) {
  const file = el.dataset.sectionFile!;
  const i = Number(el.dataset.sectionIndex);
  const layout = store.layoutOf(file);
  const label = layout[i]?.heading || layout[i]?.type || 'this section';
  if (!confirm(`Delete ${label}? Hiding it instead keeps it in the file.`)) return;
  layout.splice(i, 1);
  store.setLayout(file, layout);
  el.remove();
  reindex(file);
  refresh();
  status('Deleted. Nothing is live until you publish.');
}

function addSection(file: string, at: number, choice: typeof PALETTE[number], after: HTMLElement | null) {
  const layout = store.layoutOf(file);
  layout.splice(at, 0, { type: choice.type, hidden: false, ...choice.defaults });
  store.setLayout(file, layout);

  const placeholder = document.createElement('div');
  placeholder.className = 'ed-new';
  placeholder.textContent =
    `New “${choice.label}” section added here. It appears for real once you publish and the site rebuilds.`;
  after ? after.after(placeholder) : document.querySelector('.wrap')?.append(placeholder);

  refresh();
  status('Section added. Publish to see it rendered.');
}

function openPalette(anchor: HTMLElement, file: string, at: number, after: HTMLElement | null) {
  document.querySelector('.ed-menu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'ed-menu';
  for (const choice of PALETTE) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = choice.label;
    b.addEventListener('click', () => { menu.remove(); addSection(file, at, choice, after); });
    menu.append(b);
  }
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = `${Math.min(r.left, window.innerWidth - menu.offsetWidth - 12)}px`;
  menu.style.top = `${Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 12)}px`;

  setTimeout(() => {
    document.addEventListener('pointerdown', function off(e) {
      if (!menu.contains(e.target as Node)) { menu.remove(); document.removeEventListener('pointerdown', off); }
    });
  }, 0);
}

function decorate(el: HTMLElement) {
  if (el.querySelector(':scope > .ed-tools')) return;
  const file = el.dataset.sectionFile;
  if (!file) return;

  const tools = document.createElement('div');
  tools.className = 'ed-tools';
  tools.append(
    button('⠿', 'drag', 'Drag to reorder'),
    button('↑', 'up', 'Move up'),
    button('↓', 'down', 'Move down'),
    button('◑', 'hide', 'Hide without deleting'),
    button('＋', 'add', 'Add a section after this one'),
    button('✕', 'remove', 'Delete'),
  );
  el.prepend(tools);

  tools.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    e.preventDefault();
    const act = b.dataset.act;
    if (act === 'up') moveSection(el, -1);
    if (act === 'down') moveSection(el, 1);
    if (act === 'hide') hideSection(el);
    if (act === 'remove') removeSection(el);
    if (act === 'add') openPalette(b, file, Number(el.dataset.sectionIndex) + 1, el);
  });

  wireDrag(el, tools.querySelector('[data-act="drag"]')!);
}

/** Pointer Events, not HTML5 drag-and-drop: the latter does not fire on
 *  touch, and this gets used from a phone. */
function wireDrag(el: HTMLElement, handle: HTMLElement) {
  handle.addEventListener('pointerdown', (down: PointerEvent) => {
    down.preventDefault();
    handle.setPointerCapture(down.pointerId);
    el.classList.add('ed-dragging');
    const file = el.dataset.sectionFile!;
    let target: HTMLElement | null = null;

    const move = (e: PointerEvent) => {
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const sec = under?.closest<HTMLElement>('[data-section]');
      target?.classList.remove('ed-drop');
      target = sec && sec !== el && sec.dataset.sectionFile === file ? sec : null;
      target?.classList.add('ed-drop');
    };

    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      el.classList.remove('ed-dragging');
      target?.classList.remove('ed-drop');
      if (target) {
        const from = Number(el.dataset.sectionIndex);
        const to = Number(target.dataset.sectionIndex);
        const layout = store.layoutOf(file);
        layout.splice(to, 0, layout.splice(from, 1)[0]);
        store.setLayout(file, layout);
        to > from ? target.after(el) : target.before(el);
        reindex(file);
        refresh();
        status('Moved. Nothing is live until you publish.');
      }
      target = null;
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

/* ---------------------------------------------------------------- session */

async function setEditing(on: boolean) {
  if (on) {
    status('Loading the page source…');
    try {
      await Promise.all(pageFiles().map((f) => store.load(f)));
    } catch (e) {
      status(`Could not read the page source: ${(e as Error).message}`);
      return;
    }
  }

  editing = on;
  document.body.classList.toggle('ed-on', on);

  fields().forEach(on ? wireField : unwireField);

  if (on) {
    sections().forEach(decorate);
    // One "add" at the very top, so a page can gain a first section.
    const files = pageFiles();
    if (files.length === 1 && !document.querySelector('.ed-add')) {
      const first = sections()[0];
      if (first) {
        const add = document.createElement('button');
        add.className = 'ed-add';
        add.type = 'button';
        add.textContent = '+ Add a section here';
        add.addEventListener('click', () => openPalette(add, files[0], 0, null));
        first.before(add);
      }
    }
    status('Click any text to edit it. Drag ⠿ to reorder.');
  } else {
    document.querySelectorAll('.ed-tools, .ed-add, .ed-menu').forEach((n) => n.remove());
    status(store.isDirty() ? 'You have unpublished changes.' : '');
  }
  refresh();
}

async function doPublish() {
  try {
    const url = await store.publish(status);
    status(`Published. The site rebuilds in about two minutes. ${url}`);
    refresh();
  } catch (e) {
    const msg = (e as Error).message;
    status(/409|fast forward/i.test(msg)
      ? 'The repository changed while you were editing. Nothing was saved — reload and try again.'
      : `Nothing was saved: ${msg}`);
  }
}

function doDiscard() {
  if (!confirm('Throw away every unpublished change on this page?')) return;
  store.discard();
  refresh();
  status('Discarded. Reloading…');
  location.reload();
}

/* ------------------------------------------------------------------- boot */

if (sections().length || fields().length) {
  style();
  buildBar();
  window.addEventListener('beforeunload', (e) => {
    if (store.isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });
}
