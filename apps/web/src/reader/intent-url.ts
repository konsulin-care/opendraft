import type { ReaderRoute } from './route';

/** Minimal browser surface needed to rewrite the current URL. */
export interface IntentWindow {
  location: { href: string };
  history: {
    state: unknown;
    replaceState: (data: unknown, unused: string, url?: string | URL | null) => void;
  };
}

/**
 * Encode a git ref for use in a reader path while keeping slashes readable.
 *
 * @param ref - The decoded ref from a reader route.
 * @returns The ref split into URI-encoded path segments.
 */
function encodeRef(ref: string): string {
  return ref
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Build a reader URL that opens the given repository in edit mode.
 *
 * Keeps the optional `/tree/<ref>` suffix and the manuscript query parameter,
 * then appends `intent=edit`.
 *
 * @param route - Owner, repository and optional ref to open.
 * @param manuscriptId - Manuscript to select in the editor, when applicable.
 * @returns The absolute-path URL including the intent parameter.
 */
export function intentPath(route: ReaderRoute, manuscriptId?: string): string {
  const base = `/${route.owner}/${route.repo}${route.ref ? `/tree/${encodeRef(route.ref)}` : ''}`;
  const params = new URLSearchParams();
  if (manuscriptId !== undefined && manuscriptId !== '') {
    params.set('manuscript', manuscriptId);
  }
  params.set('intent', 'edit');
  return `${base}?${params.toString()}`;
}

/**
 * Remove the `intent` parameter from the current URL in place.
 *
 * Other query parameters and the hash are preserved. Uses
 * `history.replaceState` so no navigation entry is added.
 *
 * @param win - Window-like object whose URL should be rewritten.
 * @returns Nothing.
 */
export function clearIntent(win: IntentWindow = window): void {
  const url = new URL(win.location.href);
  url.searchParams.delete('intent');
  const next = `${url.pathname}${url.search}${url.hash}`;
  win.history.replaceState(win.history.state, '', next);
}
