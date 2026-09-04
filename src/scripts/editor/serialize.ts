/**
 * Turn an edited region of the page back into Markdown.
 *
 * Deliberately small. A general HTML-to-Markdown converter has to guess at
 * every tag a browser or a paste might produce, and its guesses are silent:
 * the text still looks right in the editor and the source quietly fills with
 * `<span style="...">`. So this handles exactly the marks the site uses and
 * flattens everything else to its text.
 *
 * The consequence is worth stating plainly — pasting from a word processor
 * keeps the words and loses the formatting. That is the intended trade.
 */

const BLOCK = new Set(['P', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'LI', 'DIV']);

/** Characters that would otherwise be read back as Markdown syntax. */
function escapeText(s: string): string {
  return s.replace(/([\\`*_[\]])/g, '\\$1');
}

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeText((node.textContent ?? '').replace(/\s+/g, ' '));
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inline).join('');

  switch (el.tagName) {
    case 'BR':
      return '\n';
    case 'STRONG':
    case 'B':
      return inner.trim() ? `**${inner.trim()}**` : '';
    case 'EM':
    case 'I':
      return inner.trim() ? `*${inner.trim()}*` : '';
    case 'CODE':
      return inner.trim() ? `\`${el.textContent ?? ''}\`` : '';
    case 'A': {
      const href = el.getAttribute('href') ?? '';
      return href ? `[${inner.trim()}](${href})` : inner;
    }
    case 'IMG': {
      // Images are their own section type; one pasted inline is dropped
      // rather than written as a path that will not resolve at build time.
      return '';
    }
    default:
      return inner;
  }
}

function blockOf(el: HTMLElement, depth = 0): string {
  const text = Array.from(el.childNodes).map(inline).join('').trim();

  switch (el.tagName) {
    case 'H2': return text && `## ${text}`;
    case 'H3': return text && `### ${text}`;
    case 'H4': return text && `#### ${text}`;
    case 'BLOCKQUOTE': return text && text.split('\n').map((l) => `> ${l}`).join('\n');
    case 'LI': return text && `${'  '.repeat(depth)}- ${text}`;
    default: return text;
  }
}

/** Read a contenteditable region back as Markdown. */
export function toMarkdown(root: HTMLElement): string {
  const out: string[] = [];

  const walk = (parent: HTMLElement, depth: number) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent ?? '').trim();
        if (t) out.push(escapeText(t));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;

      if (el.tagName === 'UL' || el.tagName === 'OL') {
        walk(el, depth);
        continue;
      }
      if (BLOCK.has(el.tagName)) {
        // A div wrapping blocks is a container, not a paragraph. Browsers
        // create these constantly while typing.
        if (el.tagName === 'DIV' && el.querySelector('p, h2, h3, ul, ol')) {
          walk(el, depth);
          continue;
        }
        const b = blockOf(el, depth);
        if (b) out.push(b);
        continue;
      }
      const b = inline(el).trim();
      if (b) out.push(b);
    }
  };

  walk(root, 0);

  // Consecutive list items belong to one list, so they are joined by single
  // newlines while everything else is separated by a blank line.
  const joined: string[] = [];
  for (const block of out) {
    const prev = joined[joined.length - 1];
    if (prev && /^\s*- /.test(block) && /^\s*- /.test(prev)) {
      joined[joined.length - 1] = `${prev}\n${block}`;
    } else {
      joined.push(block);
    }
  }
  return joined.join('\n\n').trim();
}

/** Read a single-line editable field back as plain text. */
export function toPlainText(root: HTMLElement): string {
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim();
}
