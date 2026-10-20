import type { ProjectRecord, ProjectRegistry, WorkspaceAdapter } from '@opendraft/workspace';
import { parse, stringify } from 'yaml';
import { toManuscriptId } from './slugify';
import { OPENDRAFT_CONFIG_PATH } from './scaffold';

/** A project handle: the record plus the I/O needed to rename a manuscript. */
export interface RenameProject {
  /** Project record whose manuscript is renamed. */
  record: ProjectRecord;
  /** Workspace holding the project's files. */
  workspace: WorkspaceAdapter;
  /** Registry holding the project record and manuscript display names. */
  registry: ProjectRegistry;
}

/** Outcome of {@link renameManuscript}: success carries the resolved values. */
export type RenameManuscriptResult =
  | { ok: true; dirName: string; displayName: string; moved: boolean }
  | { ok: false; error: string };

/**
 * Whether any stored file lives under `manuscripts/<dir>/`.
 *
 * @param workspace - Workspace to inspect.
 * @param dir - Manuscript directory name.
 * @returns True when the directory holds at least one file.
 */
async function directoryHasFiles(workspace: WorkspaceAdapter, dir: string): Promise<boolean> {
  const prefix = `manuscripts/${dir}/`;
  const paths = await workspace.listAll();
  return paths.some((path) => path.startsWith(prefix));
}

/**
 * Move every file under `manuscripts/<from>/` to `manuscripts/<to>/`.
 *
 * @param workspace - Workspace to mutate.
 * @param from - Current manuscript directory name.
 * @param to - New manuscript directory name.
 */
async function moveFiles(
  workspace: WorkspaceAdapter,
  from: string,
  to: string,
): Promise<void> {
  const prefix = `manuscripts/${from}/`;
  const paths = (await workspace.listAll()).filter((path) => path.startsWith(prefix));
  for (const path of paths) {
    const content = await workspace.readFile(path);
    if (content === null) continue;
    await workspace.writeFile(`manuscripts/${to}/${path.slice(prefix.length)}`, content);
    await workspace.deleteFile(path);
  }
}

/**
 * Rewrite the matching `manuscripts[]` entry in `opendraft.yml` so its id
 * and path point at the new directory. A missing config or unmatched entry
 * leaves the file untouched.
 *
 * @param workspace - Workspace holding `opendraft.yml`.
 * @param from - Current manuscript directory name.
 * @param to - New manuscript directory name.
 */
async function updateConfig(
  workspace: WorkspaceAdapter,
  from: string,
  to: string,
): Promise<void> {
  const raw = await workspace.readFile(OPENDRAFT_CONFIG_PATH);
  if (raw === null) return;
  const config = parse(raw) as { manuscripts?: Array<{ id?: string; path?: string }> };
  const oldPath = `manuscripts/${from}`;
  const entry = config.manuscripts?.find((m) => m.id === from || m.path === oldPath);
  if (!entry) return;
  entry.id = to;
  entry.path = `manuscripts/${to}`;
  await workspace.writeFile(OPENDRAFT_CONFIG_PATH, stringify(config));
}

/**
 * Rename a manuscript within a project.
 *
 * The workspace is path-keyed, so a rename moves every file under
 * `manuscripts/<old>/` to `manuscripts/<new>/`, updates the `manuscripts[]`
 * entry in `opendraft.yml`, and moves the registry display-name key to the
 * new directory, storing `newName` as its display name. When the trimmed
 * name normalizes to the current directory, only the display name changes.
 * The rename is refused — with no changes anywhere — when the target
 * directory already holds files or the name is empty.
 *
 * @param project - Project record plus workspace and registry handles.
 * @param currentDir - Current manuscript directory name under `manuscripts/`.
 * @param newName - New user-facing manuscript name, e.g. "My New Title".
 * @returns Success with the resolved directory name, display name and
 *   whether files moved, or an error result describing the refusal.
 */
export async function renameManuscript(
  project: RenameProject,
  currentDir: string,
  newName: string,
): Promise<RenameManuscriptResult> {
  const displayName = newName.trim();
  if (displayName === '') {
    return { ok: false, error: 'Manuscript name cannot be empty' };
  }

  const newDir = toManuscriptId(displayName);
  const moved = newDir !== currentDir;

  if (moved) {
    if (await directoryHasFiles(project.workspace, newDir)) {
      return {
        ok: false,
        error: `A manuscript directory "manuscripts/${newDir}" already exists`,
      };
    }
    await moveFiles(project.workspace, currentDir, newDir);
    await updateConfig(project.workspace, currentDir, newDir);
    await project.registry.moveManuscriptKey(project.record.id, currentDir, newDir);
  }

  await project.registry.setManuscriptDisplayName(project.record.id, newDir, displayName);
  return { ok: true, dirName: newDir, displayName, moved };
}

/** Wiring needed to rename the open manuscript from the app shell. */
export interface OpenManuscriptWiring extends RenameProject {
  /** Repo-relative path of the file open in the editor, or null. */
  activePath: string | null;
  /** Manuscript directory of the open file, or null when none. */
  currentDir: string | null;
  /** Opens a repo-relative path in the editor and persists it as last path. */
  openFile: (path: string) => void | Promise<void>;
  /** Refreshes the app view (active record, file tree) after the rename. */
  refresh: () => void | Promise<void>;
}

/**
 * Rename the open manuscript for the app shell: applies the rename, reopens
 * the moved file under its new path, and refreshes the view so the header
 * and the file tree show the new directory. A refused rename rejects with
 * the error so the caller can surface it inline; nothing runs on failure.
 *
 * @param wiring - Project handles plus the active-file wiring.
 * @param newName - New user-facing manuscript name, e.g. "My Thesis".
 * @returns Resolves once the rename and the view refresh have finished.
 */
export async function renameOpenManuscript(
  wiring: OpenManuscriptWiring,
  newName: string,
): Promise<void> {
  if (wiring.currentDir === null) {
    throw new Error('No manuscript is open');
  }
  const result = await renameManuscript(wiring, wiring.currentDir, newName);
  if (!result.ok) {
    throw new Error(result.error);
  }
  const { activePath } = wiring;
  const prefix = `manuscripts/${wiring.currentDir}/`;
  if (result.moved && activePath?.startsWith(prefix)) {
    await wiring.openFile(`manuscripts/${result.dirName}/${activePath.slice(prefix.length)}`);
  }
  await wiring.refresh();
}

/**
 * Build the header's manuscript-rename handler for the app shell, or
 * undefined when no manuscript directory is open.
 *
 * @param active - Active project record, or null when none is open.
 * @param currentDir - Manuscript directory of the open file, or null.
 * @param wiring - Workspace, registry and active-file wiring minus the record.
 * @returns A handler renaming the open manuscript, or undefined.
 */
export function createOpenManuscriptRenamer(
  active: ProjectRecord | null,
  currentDir: string | null,
  wiring: Omit<OpenManuscriptWiring, 'record' | 'currentDir'>,
): ((name: string) => Promise<void>) | undefined {
  if (!active || currentDir === null) return undefined;
  const record = active;
  const dir = currentDir;
  return (name) => renameOpenManuscript({ ...wiring, record, currentDir: dir }, name);
}
