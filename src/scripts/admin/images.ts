import { OWNER, REPO, BRANCH, type FileWrite } from './github';
import { resizeImage, formatBytes } from './image';

/**
 * Every image on a post, in one editable list.
 *
 * The panel this replaces had a single file input and no preview, so an
 * existing post's photographs were invisible while editing it: they could not
 * be seen, reordered, captioned or removed, and a second image could not be
 * added at all. The `gallery` field the templates render was unreachable from
 * the editor entirely.
 *
 * A post can place an image in one of three ways, and this list is the single
 * place all three are managed:
 *
 *   cover    the figure above the text, with its own caption
 *   body     between paragraphs, wherever it was inserted in the Markdown
 *   gallery  the grid after the text, in this list's order
 *
 * Body images are written into the Markdown itself, so the text stays the
 * source of truth for where they sit. Editing alt or caption here rewrites
 * that image's Markdown in place rather than keeping a second copy of the
 * value that could drift out of step with the body.
 */

export type Placement = 'cover' | 'body' | 'gallery';

export interface PostImage {
  id: string;
  /** Filename inside the collection's images/ folder. */
  name: string;
  /** Thumbnail source: a raw.githubusercontent URL, or a data URL when new. */
  url: string;
  alt: string;
  caption: string;
  credit: string;
  placement: Placement;
  /** Present only on images not yet committed. */
  base64?: string;
  info?: string;
}

let images: PostImage[] = [];
/** Repo paths the post referenced when it was opened, to spot removals. */
let originalPaths = new Set<string>();
let seq = 0;

const nextId = () => `img-${++seq}-${Date.now().toString(36)}`;

export const rawUrl = (path: string) =>
  `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;

export const getImages = () => images;
export const hasImages = () => images.length > 0;

/* ------------------------------------------------------------- body markup */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `![alt](./images/name.webp)` optionally followed by an `*italic*` caption line. */
function blockRe(name: string): RegExp {
  return new RegExp(
    '!\\[[^\\]]*\\]\\(\\./images/' + escapeRe(name) + '(?:\\s+"[^"]*")?\\)' +
      '(?:[ \\t]*\\r?\\n\\*[^\\n]*\\*)?',
    'g',
  );
}

/** The Markdown for one image. The caption is a separate emphasised line:
 *  Astro keeps it in the same paragraph as the image, which is what the
 *  stylesheet needs to render it as a caption. */
export function bodySnippet(img: PostImage): string {
  const alt = img.alt.replace(/[[\]]/g, '');
  const line = `![${alt}](./images/${img.name})`;
  return img.caption ? `${line}\n*${img.caption.replace(/\*/g, '')}*` : line;
}

export function bodyHasImage(body: string, name: string): boolean {
  return blockRe(name).test(body);
}

/** Rewrite one image's Markdown in place, or remove it when `to` is null.
 *  The replacement goes through a function so a caption containing `$&` or
 *  `$1` is inserted literally instead of being read as a match reference. */
export function replaceInBody(body: string, name: string, to: string | null): string {
  const out = body.replace(blockRe(name), () => to ?? '');
  return to === null ? out.replace(/\n{3,}/g, '\n\n') : out;
}

/* ----------------------------------------------------------------- loading */

/** Read the images off a post being opened: cover, gallery, and body. */
export function loadFromPost(
  data: Record<string, any>,
  body: string,
  collection: string,
): void {
  images = [];
  originalPaths = new Set();
  const dir = `src/content/${collection}/images`;
  const add = (name: string, placement: Placement, extra: Partial<PostImage> = {}) => {
    if (!name) return;
    originalPaths.add(`${dir}/${name}`);
    images.push({
      id: nextId(),
      name,
      url: rawUrl(`${dir}/${name}`),
      alt: '', caption: '', credit: '',
      placement,
      ...extra,
    });
  };

  const fileOf = (src: unknown) =>
    typeof src === 'string' ? src.split('/').pop() ?? '' : '';

  if (data.cover) {
    add(fileOf(data.cover), 'cover', {
      alt: data.coverAlt ?? '',
      caption: data.coverCaption ?? '',
    });
  }

  for (const g of (data.gallery ?? []) as any[]) {
    add(fileOf(g?.src), 'gallery', { alt: g?.alt ?? '', credit: g?.credit ?? '' });
  }

  // Body images last, so the ones already carrying frontmatter win the slot.
  const seen = new Set(images.map((i) => i.name));
  const re = /!\[([^\]]*)\]\(\.\/images\/([^)\s"]+)(?:\s+"([^"]*)")?\)([ \t]*\r?\n\*([^\n]*)\*)?/g;
  for (const m of body.matchAll(re)) {
    const name = m[2];
    if (seen.has(name)) continue;
    seen.add(name);
    add(name, 'body', { alt: m[1] ?? '', caption: m[5] ?? m[3] ?? '' });
  }
}

export function reset(): void {
  images = [];
  originalPaths = new Set();
}

/* --------------------------------------------------------------- uploading */

/** Resize and queue picked files. Returns a message for the hint line. */
export async function addFiles(files: FileList | File[]): Promise<string> {
  const picked = Array.from(files);
  if (!picked.length) return '';
  const notes: string[] = [];

  for (const file of picked) {
    try {
      const r = await resizeImage(file);
      const info = `${formatBytes(r.beforeBytes)} → ${formatBytes(r.afterBytes)} (${r.width}×${r.height})`;
      images.push({
        id: nextId(),
        // Provisional: the real filename is assigned at save time, once the
        // slug is settled, and any body reference is rewritten to match.
        name: `pending-${nextId()}.webp`,
        url: `data:image/webp;base64,${r.base64}`,
        alt: '', caption: '', credit: '',
        placement: images.some((i) => i.placement === 'cover') ? 'gallery' : 'cover',
        base64: r.base64,
        info,
      });
      notes.push(info);
    } catch (e) {
      notes.push(`${file.name}: ${(e as Error).message}`);
    }
  }

  return notes.length === 1
    ? notes[0]
    : `${picked.length} images added — ${notes.join('; ')}`;
}

/* ------------------------------------------------------------- list edits */

export const find = (id: string) => images.find((i) => i.id === id);

export function remove(id: string): PostImage | undefined {
  const i = images.findIndex((x) => x.id === id);
  if (i < 0) return undefined;
  return images.splice(i, 1)[0];
}

export function move(id: string, delta: number): void {
  const i = images.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= images.length) return;
  [images[i], images[j]] = [images[j], images[i]];
}

export function setCover(id: string): void {
  for (const img of images) {
    if (img.placement === 'cover') img.placement = 'gallery';
  }
  const img = find(id);
  if (img) img.placement = 'cover';
}

/* ---------------------------------------------------------------- saving */

export interface ImageSaveResult {
  writes: FileWrite[];
  cover?: string;
  coverAlt: string;
  coverCaption: string;
  gallery: { src: string; alt: string; credit?: string }[];
  /** Body text after any provisional filenames were rewritten. */
  body: string;
}

/**
 * Assign final filenames, produce the blob writes, and return the frontmatter
 * values the entry needs.
 *
 * New images are named only now, because the slug can still change while the
 * post is being written. Anything already committed keeps its filename, so an
 * edit does not churn every image into a delete-and-re-add.
 */
export function buildSave(slug: string, collection: string, body: string): ImageSaveResult {
  const dir = `src/content/${collection}/images`;
  const writes: FileWrite[] = [];
  let out = body;

  const taken = new Set(images.filter((i) => !i.base64).map((i) => i.name));
  let n = 0;
  const nextName = () => {
    let name: string;
    do { name = `${slug}-${++n}.webp`; } while (taken.has(name));
    taken.add(name);
    return name;
  };

  for (const img of images) {
    if (!img.base64) continue;
    const final = nextName();
    if (img.placement === 'body' || bodyHasImage(out, img.name)) {
      out = out.split(`./images/${img.name}`).join(`./images/${final}`);
    }
    img.name = final;
    writes.push({ path: `${dir}/${final}`, content: img.base64, encoding: 'base64' });
    delete img.base64;
    img.url = rawUrl(`${dir}/${final}`);
  }

  // Files the post no longer uses. Unreferenced images would not reach the
  // built site anyway — the build prunes them — but leaving them in the repo
  // means "remove" does not actually remove anything.
  const kept = new Set(images.map((i) => `${dir}/${i.name}`));
  for (const path of originalPaths) {
    if (!kept.has(path)) writes.push({ path, content: null });
  }
  originalPaths = new Set(kept);

  const cover = images.find((i) => i.placement === 'cover');
  const gallery = images
    .filter((i) => i.placement === 'gallery')
    .map((i) => ({
      src: `./images/${i.name}`,
      alt: i.alt,
      ...(i.credit ? { credit: i.credit } : {}),
    }));

  return {
    writes,
    cover: cover ? `./images/${cover.name}` : undefined,
    coverAlt: cover?.alt ?? '',
    coverCaption: cover?.caption ?? '',
    gallery,
    body: out,
  };
}

/** Every repo path this post currently references, for delete-post cleanup. */
export function allPaths(collection: string): string[] {
  const dir = `src/content/${collection}/images`;
  return [...new Set([...originalPaths, ...images.map((i) => `${dir}/${i.name}`)])];
}
