import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parseDocument, type Document } from 'yaml';
import type { SaveStatus } from '../AppHeader';
import { debouncedSaver, type DebouncedSaver } from '../editor/autosave';

/** Metadata file names under a manuscript root. */
const FILES = {
  frontmatter: '_frontmatter.yml',
  author: '_author.yml',
  abstract: '_abstract.yml',
} as const;

/** Key identifying one of the three metadata files. */
type FileKey = keyof typeof FILES;

/** Author entry of _author.yml; unknown keys pass through untouched. */
export interface MetadataAuthor {
  /** Structured, literal or plain-string name as written in YAML. */
  name?: unknown;
  /** Every other key of the author entry. */
  [key: string]: unknown;
}

/** Top-level affiliation registry entry of _author.yml. */
export interface MetadataAffiliation {
  id?: string; name?: string; // registry id and organization name
  [key: string]: unknown; // unknown keys pass through untouched
}

/** Read-only snapshot of the three metadata files of one manuscript. */
export interface ManuscriptMetadata {
  /** Title from _frontmatter.yml; '' when missing or unparsable. */
  title: string;
  /** Authors from _author.yml in file order; [] when missing or unparsable. */
  authors: MetadataAuthor[];
  /** Abstract text from _abstract.yml; undefined when missing or unparsable. */
  abstract?: string;
  /** Parsed frontmatter map (unknown keys included, comments dropped). */
  frontmatter: Record<string, unknown>;
  /** Top-level affiliation registry from _author.yml; [] when missing. */
  affiliations: MetadataAffiliation[];
}
/** Handle returned by {@link useManuscriptMetadata}. */
export interface UseManuscriptMetadataResult extends ManuscriptMetadata {
  /** Whether the initial load has settled. */
  loaded: boolean;
  /** Autosave status for the shared editor save indicator. */
  status: SaveStatus;
  /** Set the title; persisted to _frontmatter.yml after the 800ms debounce. */
  setTitle(title: string): void;
  /** Replace the author list; persisted to _author.yml (debounced). */
  setAuthors(authors: MetadataAuthor[]): void;
  /** Replace the affiliation registry; persisted to _author.yml (debounced). */
  setAffiliations(affiliations: MetadataAffiliation[]): void;
  /** Replace the abstract; persisted to _abstract.yml (debounced). */
  setAbstract(text: string): void;
  /** Persist one _frontmatter.yml field; '' or undefined deletes it. */
  setFrontmatterField(key: string, value: unknown): void;
  /** Re-read all metadata files; call after one was saved from the editor. */
  reload(): Promise<void>;
}

/** Raw file state kept as the edit base; false when unparsable. */
interface RawFile {
  text: string; // original (or last-edited) file text
  ok: boolean;
  data: Record<string, unknown>; // parsed map, empty when missing or unparsable
}

/** Empty metadata state used before load and for unusable files. */
const EMPTY: ManuscriptMetadata = {
  title: '', authors: [], affiliations: [], frontmatter: {},
};

/** Empty raw state for a null workspace or manuscript root. */
function emptyRaw(): Record<FileKey, RawFile> {
  const file: RawFile = { text: '', ok: true, data: {} };
  return { frontmatter: file, author: { ...file }, abstract: { ...file } };
}

/** Coerce a parsed YAML value to a plain record. */
function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Read one metadata file; missing or rejected files yield an empty state. */
async function loadRawFile(workspace: WorkspaceAdapter, path: string): Promise<RawFile> {
  const text = await workspace.readFile(path);
  if (text === null) return { text: '', ok: true, data: {} };
  const doc = parseDocument(text);
  if (doc.errors.length > 0) return { text, ok: false, data: {} };
  return { text, ok: true, data: toRecord(doc.toJS()) };
}

/** Derive the metadata snapshot from the three raw files. */
function metadataFrom(
  frontmatter: RawFile,
  author: RawFile,
  abstract: RawFile,
): ManuscriptMetadata {
  const title = frontmatter.data['title'];
  const authors = author.data['authors'];
  const abstractText = abstract.data['abstract'];
  const affiliations = author.data['affiliations'];
  return {
    title: typeof title === 'string' ? title : title == null ? '' : String(title),
    authors: Array.isArray(authors) ? authors as MetadataAuthor[] : [],
    abstract: typeof abstractText === 'string' ? abstractText : undefined,
    frontmatter: frontmatter.data,
    affiliations: Array.isArray(affiliations) ? affiliations as MetadataAffiliation[] : [],
  };
}

/** Round-trip a mutation through the yaml Document API; null when unparsable. */
function editRaw(base: RawFile, mutate: (doc: Document.Parsed) => void): RawFile | null {
  if (!base.ok) return null;
  const doc = parseDocument(base.text);
  if (doc.errors.length > 0) return null;
  mutate(doc);
  return { text: doc.toString(), ok: true, data: toRecord(doc.toJS()) };
}

/** Shared wiring of the metadata edit sub-hook. */
interface EditContext {
  rawRef: RefObject<Record<FileKey, RawFile>>;
  saversRef: RefObject<Map<string, DebouncedSaver>>;
  /** Reports autosave progress for the shared save indicator. */
  setStatus: (status: SaveStatus) => void;
  workspace: WorkspaceAdapter | null;
  manuscriptRoot: string | null;
  setMeta: (meta: ManuscriptMetadata) => void;
}

/** Persist an edited file through its debounced saver and refresh state. */
function commitEdit(ctx: EditContext, file: FileKey, next: RawFile): void {
  const { workspace, manuscriptRoot } = ctx;
  if (!workspace || !manuscriptRoot) return;
  ctx.rawRef.current[file] = next;
  ctx.setMeta(metadataFrom(
    ctx.rawRef.current.frontmatter,
    ctx.rawRef.current.author,
    ctx.rawRef.current.abstract,
  ));
  const path = `${manuscriptRoot}/${FILES[file]}`;
  let saver = ctx.saversRef.current.get(path);
  if (!saver) {
    saver = debouncedSaver(workspace, ctx.setStatus);
    ctx.saversRef.current.set(path, saver);
  }
  saver.setPath(path);
  saver.schedule(next.text);
}

/** Comment-preserving setters; unparsable bases refuse edits so broken files survive. */
function useMetadataEdits(ctx: EditContext): Pick<
  UseManuscriptMetadataResult, 'setTitle' | 'setAuthors' | 'setAffiliations' | 'setAbstract' | 'setFrontmatterField'
> {
  const { rawRef } = ctx;
  const setTitle = useCallback((title: string) => {
    const next = editRaw(rawRef.current.frontmatter, (doc) => {
      if (title) doc.set('title', title);
      else doc.delete('title');
    });
    if (next) commitEdit(ctx, 'frontmatter', next);
  }, [ctx]);

  const setAuthors = useCallback((authors: MetadataAuthor[]) => {
    const next = editRaw(rawRef.current.author, (doc) => {
      doc.set('authors', authors);
    });
    if (next) commitEdit(ctx, 'author', next);
  }, [ctx]);

  const setAffiliations = useCallback((affiliations: MetadataAffiliation[]) => {
    const next = editRaw(rawRef.current.author, (doc) => (affiliations.length > 0
      ? doc.set('affiliations', affiliations) : doc.delete('affiliations')));
    if (next) commitEdit(ctx, 'author', next);
  }, [ctx]);

  const setAbstract = useCallback((text: string) => {
    const next = editRaw(rawRef.current.abstract, (doc) => {
      doc.set('abstract', text);
    });
    if (next) commitEdit(ctx, 'abstract', next);
  }, [ctx]);

  const setFrontmatterField = useCallback((key: string, value: unknown) => {
    const next = editRaw(rawRef.current.frontmatter, (doc) => (value == null || value === ''
      ? doc.delete(key) : doc.set(key, value)));
    if (next) commitEdit(ctx, 'frontmatter', next);
  }, [ctx]);

  return { setTitle, setAuthors, setAffiliations, setAbstract, setFrontmatterField };
}

/** Inputs of the metadata loader sub-hook. */
interface LoaderContext {
  rawRef: RefObject<Record<FileKey, RawFile>>;
  workspace: WorkspaceAdapter | null;
  manuscriptRoot: string | null;
  setMeta: (meta: ManuscriptMetadata) => void;
  setLoaded: (loaded: boolean) => void;
}

/**
 * Load the three metadata files of a manuscript root and expose a reload.
 * Missing or unparsable files yield an empty state instead of throwing;
 * the effect re-runs whenever the workspace or root changes.
 *
 * @param ctx - Loader wiring; see {@link LoaderContext}.
 * @returns The reload callback, also re-reading all metadata files.
 */
function useMetadataLoader(ctx: LoaderContext): { reload: () => Promise<void> } {
  const { workspace, manuscriptRoot, rawRef, setMeta, setLoaded } = ctx;
  const reload = useCallback(async () => {
    if (!workspace || !manuscriptRoot) {
      rawRef.current = emptyRaw();
      setMeta(EMPTY);
      setLoaded(true);
      return;
    }
    const [frontmatter, author, abstract] = await Promise.all([
      loadRawFile(workspace, `${manuscriptRoot}/${FILES.frontmatter}`),
      loadRawFile(workspace, `${manuscriptRoot}/${FILES.author}`),
      loadRawFile(workspace, `${manuscriptRoot}/${FILES.abstract}`),
    ]);
    rawRef.current = { frontmatter, author, abstract };
    setMeta(metadataFrom(frontmatter, author, abstract));
    setLoaded(true);
  }, [workspace, manuscriptRoot, rawRef, setMeta, setLoaded]);

  useEffect(() => {
    setLoaded(false);
    void reload().catch((err: unknown) => {
      console.error('manuscript metadata load failed:', err);
      setLoaded(true);
    });
  }, [reload, setLoaded]);

  return { reload };
}

/**
 * Track the YAML metadata of a manuscript root.
 *
 * Loads _frontmatter.yml, _author.yml and _abstract.yml through the
 * workspace adapter — missing or unparsable files yield an empty state
 * without throwing. Edits go through the yaml Document API (comments and
 * unknown keys preserved) and are written back with the editor's 800ms
 * debounced autosave, reporting status for the shared save indicator.
 *
 * @param workspace - Workspace of the active project, or null before boot.
 * @param manuscriptRoot - Repo-relative manuscript directory, or null.
 * @returns See {@link UseManuscriptMetadataResult}.
 */
export function useManuscriptMetadata(
  workspace: WorkspaceAdapter | null,
  manuscriptRoot: string | null,
): UseManuscriptMetadataResult {
  const [meta, setMeta] = useState<ManuscriptMetadata>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const rawRef = useRef<Record<FileKey, RawFile>>(emptyRaw());
  const saversRef = useRef(new Map<string, DebouncedSaver>());

  const { reload: reloadFiles } = useMetadataLoader({
    workspace, manuscriptRoot, rawRef, setMeta, setLoaded,
  });
  const { setTitle, setAuthors, setAffiliations, setAbstract, setFrontmatterField } =
    useMetadataEdits({ rawRef, saversRef, workspace, manuscriptRoot, setMeta, setStatus });

  // Flush pending writes ahead of a path/workspace switch and on unmount.
  useEffect(() => () => {
    for (const saver of saversRef.current.values()) saver.flush();
    saversRef.current.clear();
  }, [workspace, manuscriptRoot]);

  const reload = useCallback(
    () => reloadFiles().catch((err: unknown) => {
      console.error('manuscript metadata reload failed:', err);
    }),
    [reloadFiles],
  );

  return {
    ...meta,
    loaded,
    status,
    setTitle,
    setAuthors,
    setAffiliations,
    setAbstract,
    setFrontmatterField,
    reload,
  };
}
