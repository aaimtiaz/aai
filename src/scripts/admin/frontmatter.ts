import { stringify, parse } from 'yaml';

/**
 * Frontmatter is built with the `yaml` package, never string concatenation.
 *
 * Hand-rolled escaping is where naive versions of this break, and the failure
 * is quiet rather than loud: a title containing ":" produces YAML that is
 * syntactically valid but semantically wrong, so the build succeeds with a
 * mangled title. The existing entry `intro: "Imagine you are on:"` is exactly
 * that case.
 */
export function buildMarkdown(data: Record<string, unknown>, body: string): string {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    clean[k] = v;
  }

  // lineWidth: 0 disables line folding. Without it, long Bengali titles and
  // excerpts get wrapped mid-value, which changes what parses back out.
  // doubleQuotedAsJSON is deliberately left off: the default keeps Bengali as
  // literal UTF-8 instead of escaping it to \uXXXX and making diffs unreadable.
  const fm = stringify(clean, { lineWidth: 0 });
  return `---\n${fm}---\n\n${body.trim()}\n`;
}

export function splitMarkdown(file: string): { data: Record<string, any>; body: string } {
  const m = file.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: file };
  return { data: parse(m[1]) ?? {}, body: m[2].replace(/^\r?\n/, '') };
}

const BENGALI = /[\u0980-\u09FF]/;

/** Bengali slugs would produce percent-encoded URLs, so titles that are not
 *  Latin fall back to a transliteration-free stem plus a timestamp. */
export function slugify(title: string): string {
  const ascii = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  if (ascii.length >= 3) return ascii;
  const stem = BENGALI.test(title) ? 'lekha' : 'post';
  return `${stem}-${Date.now().toString(36)}`;
}

export function detectLang(text: string): 'en' | 'bn' {
  return BENGALI.test(text) ? 'bn' : 'en';
}

/** Short lines dominating suggests verse rather than prose. */
export function guessForm(body: string): 'poem' | 'prose' {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return 'prose';
  const short = lines.filter((l) => l.length < 60).length;
  return short / lines.length > 0.7 ? 'poem' : 'prose';
}
