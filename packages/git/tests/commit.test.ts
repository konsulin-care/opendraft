import { describe, it, expect, beforeEach } from 'vitest';
import { preCommitAssembly } from '../src/commit.js';
import { MemoryWorkspace } from '@opendraft/workspace';

describe('preCommitAssembly', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  async function setupValidWorkspace(): Promise<void> {
    await workspace.writeFile('blocks/manifest.json', JSON.stringify({
      version: '1.0.0',
      blocks: [
        { id: 'intro', file: 'intro.qmd', title: 'Introduction' },
        { id: 'methods', file: 'methods.qmd', title: 'Methods' },
      ],
    }));
    await workspace.writeFile('blocks/intro.qmd', '# Introduction\n\nThis is the intro.');
    await workspace.writeFile('blocks/methods.qmd', '# Methods\n\nThese are the methods.');
    await workspace.writeFile('metadata/_author.yml', 'name: John Doe');
    await workspace.writeFile('metadata/_abstract.yml', 'title: My Paper');
  }

  it('generates article.qmd from manifest and blocks', async () => {
    await setupValidWorkspace();
    const result = await preCommitAssembly(workspace, 'blocks/manifest.json', 'metadata/_author.yml\nmetadata/_abstract.yml');

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.article).toContain('{{< include blocks/intro.qmd >}}');
    expect(result.article).toContain('{{< include blocks/methods.qmd >}}');
  });

  it('returns errors when manifest is invalid', async () => {
    await workspace.writeFile('blocks/manifest.json', JSON.stringify({ version: '1.0.0', blocks: [] }));
    const result = await preCommitAssembly(workspace, 'blocks/manifest.json', '');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns errors when block file is missing', async () => {
    await workspace.writeFile('blocks/manifest.json', JSON.stringify({
      version: '1.0.0',
      blocks: [{ id: 'intro', file: 'intro.qmd', title: 'Introduction' }],
    }));
    const result = await preCommitAssembly(workspace, 'blocks/manifest.json', '');

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Missing block file'))).toBe(true);
  });
});
