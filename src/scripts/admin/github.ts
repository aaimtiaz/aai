/**
 * GitHub client for the publishing panel.
 *
 * Everything writes through the Git Data API as ONE commit rather than two
 * sequential Contents API PUTs. That is what makes create / edit / delete /
 * rename all the same code path, and it is why a failure can no longer leave
 * an orphaned multi-megabyte image in the repo: nothing is visible until the
 * final ref update.
 */

export const OWNER = 'aaimtiaz';
// The repo was renamed from `aai`; this is the current name. GitHub redirects
// the old one, but the API is addressed by the canonical name.
export const REPO = 'aaimtiaz.github.io';
export const BRANCH = 'main';

const API = 'https://api.github.com';
const TOKEN_KEY = 'admin_gh_token';

export type FileWrite =
  /** content === null deletes the path. */
  { path: string; content: string | null; encoding?: 'utf8' | 'base64' };

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string, remember: boolean) {
  try {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function headers(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

async function gh(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) msg = `${res.status} ${body.message}`;
    } catch {}
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Verify the token really works and say who it belongs to.
 *  The old panel accepted any non-empty string and only failed at publish. */
export async function verifyToken(): Promise<{ login: string; expiry?: string }> {
  const res = await fetch(`${API}/user`, { headers: headers() });
  if (!res.ok) {
    if (res.status === 401) throw new Error('That token was rejected by GitHub (401). Check it was copied in full and has not expired.');
    throw new Error(`GitHub rejected the token: ${res.status} ${res.statusText}`);
  }
  const user = await res.json();
  // Surfaced so an expiry is never discovered as a mystery 401 mid-post.
  const expiry = res.headers.get('github-authentication-token-expiration') ?? undefined;
  return { login: user.login, expiry };
}

/** UTF-8 safe base64. String.fromCharCode(...bytes) blows the call stack on
 *  multi-megabyte inputs, so bytes are folded in chunks instead. */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Apply a set of writes as a single commit.
 *
 * Optimistic concurrency comes free: the ref PATCH is not forced, so if the
 * branch moved (another tab, or an edit from a laptop) it fails instead of
 * silently clobbering, and the caller retries from a fresh base.
 */
export async function commitFiles(
  files: FileWrite[],
  message: string,
  onStep?: (s: string) => void,
): Promise<{ sha: string; url: string }> {
  const step = onStep ?? (() => {});

  step('Reading branch…');
  const ref = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const baseSha: string = ref.object.sha;

  const baseCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`);
  const baseTree: string = baseCommit.tree.sha;

  step(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`);
  const tree = await Promise.all(
    files.map(async (f) => {
      if (f.content === null) {
        // A null sha removes the path in the new tree.
        return { path: f.path, mode: '100644', type: 'blob', sha: null };
      }
      const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: f.encoding === 'base64' ? f.content : utf8ToBase64(f.content),
          encoding: 'base64',
        }),
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );

  step('Building tree…');
  const newTree = await gh(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTree, tree }),
  });

  step('Creating commit…');
  const commit = await gh(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] }),
  });

  step('Publishing…');
  await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha }),   // no `force`: conflicts must fail loudly
  });

  return { sha: commit.sha, url: commit.html_url };
}

/**
 * Whole content inventory in one request.
 *
 * `head` is the branch's commit SHA and is the right cache key for anything
 * derived from this listing: it changes on every commit, and only on a commit.
 */
export async function listContent(): Promise<{
  head: string;
  files: { path: string; sha: string }[];
}> {
  const ref = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const head: string = ref.object.sha;
  const tree = await gh(`/repos/${OWNER}/${REPO}/git/trees/${head}?recursive=1`);
  const files = (tree.tree as any[])
    .filter((n) => n.type === 'blob' && /^src\/content\/[^/]+\/[^/]+\.md$/.test(n.path))
    .map((n) => ({ path: n.path, sha: n.sha }));
  return { head, files };
}

export async function readFile(path: string): Promise<string> {
  const data = await gh(
    `/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`,
  );
  return base64ToUtf8(data.content);
}
