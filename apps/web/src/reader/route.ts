const OWNER_RE = /^[A-Za-z0-9-]{1,39}$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** A parsed reader URL: the repository and an optional git ref. */
export interface ReaderRoute {
  owner: string;
  repo: string;
  ref?: string;
}

/** Decode one path segment, returning null when the encoding is malformed. */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Validate an owner segment (GitHub login rules).
 *
 * @param value - The decoded owner segment.
 * @returns True when the value is a syntactically valid owner.
 */
function isValidOwner(value: string): boolean {
  return OWNER_RE.test(value);
}

/**
 * Validate a repository segment and strip a trailing `.git` suffix.
 *
 * @param value - The decoded repository segment.
 * @returns The normalized repo name, or null when invalid.
 */
function normalizeRepo(value: string): string | null {
  const repo = value.endsWith('.git') ? value.slice(0, -4) : value;
  return REPO_RE.test(repo) ? repo : null;
}

/**
 * Split a pathname into decoded, non-empty segments.
 *
 * Drops a single trailing slash and rejects empty or malformed segments.
 *
 * @param pathname - The URL pathname (starting with `/`).
 * @returns The decoded segments, or null when the path is malformed.
 */
function splitPath(pathname: string): string[] | null {
  if (!pathname.startsWith('/')) {
    return null;
  }

  const raw = pathname.slice(1);
  if (raw.length === 0) {
    return null;
  }

  const segments = raw.split('/');
  if (segments[segments.length - 1] === '') {
    segments.pop();
  }

  const decoded: string[] = [];
  for (const segment of segments) {
    const value = decodeSegment(segment);
    if (value === null || value === '') {
      return null;
    }
    decoded.push(value);
  }
  return decoded;
}

/**
 * Check whether a first segment is a valid, non-reserved owner.
 *
 * @param owner - The decoded first path segment.
 * @returns True when the segment can be an owner.
 */
function isReaderOwner(owner: string): boolean {
  return !owner.startsWith('@') && !owner.includes('.') && isValidOwner(owner);
}

/**
 * Parse an SPA pathname into a reader route.
 *
 * Accepts `/{owner}/{repo}`, `/{owner}/{repo}/` and
 * `/{owner}/{repo}/tree/{ref...}` where the ref may contain slashes. Every
 * segment is individually URI-decoded. Returns null for `/`, single-segment
 * paths, reserved or file-like first segments (starting with `@` or
 * containing a dot) and any other shape.
 *
 * @param pathname - The URL pathname to parse.
 * @returns The parsed route, or null when the path is not a reader route.
 */
export function parseReaderRoute(pathname: string): ReaderRoute | null {
  const decoded = splitPath(pathname);
  if (decoded === null || decoded.length < 2) {
    return null;
  }

  const [owner, repoValue] = decoded;
  const repo = normalizeRepo(repoValue);
  if (repo === null || !isReaderOwner(owner)) {
    return null;
  }

  if (decoded.length === 2) {
    return { owner, repo };
  }

  if (decoded.length > 3 && decoded[2] === 'tree') {
    return { owner, repo, ref: decoded.slice(3).join('/') };
  }

  return null;
}
