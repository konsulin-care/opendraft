import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import {
  saveSections,
  loadSections,
  createSection,
  deleteSection,
  reorderSections,
} from './persistence';

let workspace: MemoryWorkspace;

beforeEach(() => {
  workspace = new MemoryWorkspace();
});

describe('saveSections', () => {
  it('creates section files and manifest', async () => {
    const sections = [
      { id: 'abc12345', title: 'Introduction', content: 'Hello world' },
    ];

    await saveSections(workspace, 'blocks/manifest.json', sections);

    const manifest = await workspace.readFile('blocks/manifest.json');
    expect(manifest).toBeDefined();

    const parsed = JSON.parse(manifest!);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.blocks).toHaveLength(1);
  });

  it('removes deleted section files', async () => {
    await workspace.writeFile('blocks/old.qmd', '# Old');
    await saveSections(workspace, 'blocks/manifest.json', [
      { id: 'new', title: 'New', content: 'Content' },
    ]);

    const files = await workspace.listFiles('blocks/');
    expect(files).not.toContain('old.qmd');
  });
});

describe('loadSections', () => {
  it('loads sections from workspace', async () => {
    await workspace.writeFile('blocks/manifest.json', JSON.stringify({
      version: '1.0.0',
      blocks: [{ id: 'abc', file: 'abc.qmd', title: 'Title' }],
    }));
    await workspace.writeFile('blocks/abc.qmd', '# Title\n\nContent');

    const sections = await loadSections(workspace, 'blocks/manifest.json');
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Title');
  });

  it('returns empty array for missing manifest', async () => {
    const sections = await loadSections(workspace, 'blocks/manifest.json');
    expect(sections).toEqual([]);
  });
});

describe('createSection', () => {
  it('creates new section and updates manifest', async () => {
    const id = await createSection(workspace, 'blocks/manifest.json', 'New Section');

    expect(id).toMatch(/^[a-f0-9]{8}$/);

    const manifest = JSON.parse(await workspace.readFile('blocks/manifest.json')!);
    expect(manifest.blocks).toHaveLength(1);
  });
});

describe('deleteSection', () => {
  it('removes section file and manifest entry', async () => {
    await saveSections(workspace, 'blocks/manifest.json', [
      { id: 'abc', title: 'A', content: '' },
      { id: 'def', title: 'B', content: '' },
    ]);

    await deleteSection(workspace, 'blocks/manifest.json', 'abc');

    const manifest = JSON.parse(await workspace.readFile('blocks/manifest.json')!);
    expect(manifest.blocks).toHaveLength(1);
    expect(manifest.blocks[0].id).toBe('def');
  });
});

describe('reorderSections', () => {
  it('reorders sections in manifest', async () => {
    await saveSections(workspace, 'blocks/manifest.json', [
      { id: 'abc', title: 'A', content: '' },
      { id: 'def', title: 'B', content: '' },
    ]);

    await reorderSections(workspace, 'blocks/manifest.json', ['def', 'abc']);

    const manifest = JSON.parse(await workspace.readFile('blocks/manifest.json')!);
    expect(manifest.blocks.map((b: { id: string }) => b.id)).toEqual(['def', 'abc']);
  });
});
