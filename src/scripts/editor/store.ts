import { readFile, commitFiles, type FileWrite } from '../admin/github';
import { buildMarkdown, splitMarkdown } from '../admin/frontmatter';

/**
 * The edit session: what the page's source actually says, what has been
 * changed, and how to write it back.
 *
 * Edits are applied to the parsed source rather than reconstructed from the
 * DOM. The rendered page is lossy — a heading is `<h2>` whether it came from
 * frontmatter or Markdown, and a reordered section carries no memory of the
 * array it came from — so the file is loaded once and becomes the thing being
 * edited. The page is only the view onto it.
 */

/** `pages/home.md` and `site.json` are the two shapes an address can name. */
export function resolvePath(file: string): string {
  if (file === 'site.json') return 'src/data/site.json';
  if (file.startsWith('pages/')) return `src/content/${file}`;
  return file;
}

interface Loaded {
  /** Frontmatter for a Markdown page, or the whole object for JSON. */
  data: Record<string, any>;
  /** Markdown body; unused for JSON. */
  body: string;
  json: boolean;
}

const loaded = new Map<string, Loaded>();
let dirty = new Set<string>();

export const changeCount = () => dirty.size;
export const isDirty = () => dirty.size > 0;

export async function load(file: string): Promise<Loaded> {
  const hit = loaded.get(file);
  if (hit) return hit;

  const raw = await readFile(resolvePath(file));
  const json = file.endsWith('.json');
  const entry: Loaded = json
    ? { data: JSON.parse(raw), body: '', json: true }
    : { ...splitMarkdown(raw), json: false };
  loaded.set(file, entry);
  return entry;
}

/** Read `layout.0.body` off a loaded file. */
export function get(file: string, path: string): any {
  const entry = loaded.get(file);
  if (!entry) return undefined;
  return path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), entry.data);
}

/** Write `layout.0.body`, remembering that this file now differs from disk. */
export function set(file: string, path: string, value: any): void {
  const entry = loaded.get(file);
  if (!entry) return;
  const keys = path.split('.');
  const last = keys.pop()!;
  let node: any = entry.data;
  for (const k of keys) {
    if (node[k] == null) node[k] = /^\d+$/.test(k) ? [] : {};
    node = node[k];
  }
  if (node[last] === value) return;
  node[last] = value;
  dirty.add(file);
}

export const layoutOf = (file: string): any[] => get(file, 'layout') ?? [];

export function setLayout(file: string, layout: any[]): void {
  set(file, 'layout', layout);
  // `set` bails when the reference is unchanged, and reordering mutates in
  // place, so a layout change is marked explicitly.
  dirty.add(file);
}

/** Serialise every changed file. */
function writes(): FileWrite[] {
  const out: FileWrite[] = [];
  for (const file of dirty) {
    const entry = loaded.get(file)!;
    out.push({
      path: resolvePath(file),
      content: entry.json
        ? JSON.stringify(entry.data, null, 2) + '\n'
        : buildMarkdown(entry.data, entry.body),
    });
  }
  return out;
}

export async function publish(onStep: (s: string) => void): Promise<string> {
  const files = writes();
  if (!files.length) throw new Error('Nothing has changed.');
  const what = files.length === 1
    ? files[0].path.split('/').pop()
    : `${files.length} pages`;
  const { url } = await commitFiles(files, `Edit: ${what}`, onStep);
  dirty = new Set();
  // Drop the cache so the next edit session reads what was actually written.
  loaded.clear();
  return url;
}

export function discard(): void {
  dirty = new Set();
  loaded.clear();
}
