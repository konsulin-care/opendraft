import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { parse } from 'yaml';
import {
  MemoryWorkspace,
  ProjectRegistry,
  REGISTRY_DB,
  type ProjectRecord,
} from '@opendraft/workspace';
import { renameManuscript, type RenameProject } from './rename-manuscript';
import { OPENDRAFT_CONFIG_PATH } from './scaffold';

/** Delete the registry database between tests. */
function deleteRegistryDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(REGISTRY_DB);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Moves the directory, updates opendraft.yml and the registry key. */
async function movesDirectory(project: RenameProject): Promise<void> {
  const { record, workspace, registry } = project;
  const result = await renameManuscript(project, 'old', 'My New Title');

  expect(result).toEqual({
    ok: true, dirName: 'my-new-title', displayName: 'My New Title', moved: true,
  });

  expect(await workspace.readFile('manuscripts/my-new-title/blocks/a.qmd')).toBe('block content');
  expect(await workspace.readFile('manuscripts/my-new-title/article.qmd')).toBe('# article');
  expect(await workspace.readFile('manuscripts/old/blocks/a.qmd')).toBeNull();
  expect(await workspace.readFile('manuscripts/old/article.qmd')).toBeNull();

  const config = parse((await workspace.readFile(OPENDRAFT_CONFIG_PATH)) ?? '');
  expect(config.manuscripts).toEqual([{ id: 'my-new-title', path: 'manuscripts/my-new-title' }]);

  expect(await registry.getManuscriptDisplayName(record.id, 'my-new-title')).toBe('My New Title');
  expect(await registry.getManuscriptDisplayName(record.id, 'old')).toBeUndefined();
}

/** Returns an error and changes nothing when the target directory exists. */
async function refusesOverwrite(project: RenameProject): Promise<void> {
  const { workspace } = project;
  await workspace.writeFile('manuscripts/my-new-title/blocks/x.qmd', 'existing');
  const filesBefore = await workspace.listAll();
  const yamlBefore = await workspace.readFile(OPENDRAFT_CONFIG_PATH);

  const result = await renameManuscript(project, 'old', 'My New Title');

  expect(result.ok).toBe(false);
  expect(await workspace.listAll()).toEqual(filesBefore);
  expect(await workspace.readFile(OPENDRAFT_CONFIG_PATH)).toBe(yamlBefore);
  expect(await registryName(project, 'old')).toBe('Old Title');
  expect(await registryName(project, 'my-new-title')).toBeUndefined();
}

/** Updates only the display name when the name normalizes to the current dir. */
async function displayNameOnly(project: RenameProject): Promise<void> {
  const { workspace } = project;
  const filesBefore = await workspace.listAll();
  const yamlBefore = await workspace.readFile(OPENDRAFT_CONFIG_PATH);

  const result = await renameManuscript(project, 'old', 'Old!');

  expect(result).toEqual({ ok: true, dirName: 'old', displayName: 'Old!', moved: false });
  expect(await workspace.listAll()).toEqual(filesBefore);
  expect(await workspace.readFile(OPENDRAFT_CONFIG_PATH)).toBe(yamlBefore);
  expect(await registryName(project, 'old')).toBe('Old!');
}

/** Rejects an empty or whitespace-only name without changes. */
async function rejectsEmptyName(project: RenameProject): Promise<void> {
  const { workspace } = project;
  const filesBefore = await workspace.listAll();

  const result = await renameManuscript(project, 'old', '   ');

  expect(result.ok).toBe(false);
  expect(await workspace.listAll()).toEqual(filesBefore);
  expect(await registryName(project, 'old')).toBe('Old Title');
}

/** Read a manuscript display name from the project's registry record. */
function registryName(
  project: RenameProject,
  dirName: string,
): Promise<string | undefined> {
  return project.registry.getManuscriptDisplayName(project.record.id, dirName);
}

describe('renameManuscript', () => {
  let registry: ProjectRegistry;
  let record: ProjectRecord;
  let workspace: MemoryWorkspace;
  let project: RenameProject;

  beforeEach(async () => {
    await deleteRegistryDb();
    registry = new ProjectRegistry();
    record = await registry.create('Test Project');
    workspace = new MemoryWorkspace();
    await workspace.writeFile(
      OPENDRAFT_CONFIG_PATH,
      'manuscripts:\n- id: old\n  path: manuscripts/old\n',
    );
    await workspace.writeFile('manuscripts/old/blocks/a.qmd', 'block content');
    await workspace.writeFile('manuscripts/old/article.qmd', '# article');
    await registry.setManuscriptDisplayName(record.id, 'old', 'Old Title');
    project = { record, workspace, registry };
  });

  afterEach(async () => {
    await registry.close();
  });

  it('moves the directory, updates opendraft.yml and the registry key', () => movesDirectory(project));
  it('returns an error and changes nothing when the target directory exists', () => refusesOverwrite(project));
  it('updates only the display name when the name normalizes to the current dir', () => displayNameOnly(project));
  it('rejects an empty or whitespace-only name without changes', () => rejectsEmptyName(project));
});
