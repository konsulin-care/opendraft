import { describe, it, expect, beforeEach } from 'vitest';
import { preCommitAssembly } from '../src/commit.js';
import { MemoryWorkspace } from '@opendraft/workspace';

describe('preCommitAssembly', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  async function setupValidWorkspace(): Promise<void> {
    await workspace.writeFile('article.qmd', [
      '{{< include blocks/intro.qmd >}}',
      '{{< include blocks/methods.qmd >}}',
    ].join('\n'));
    await workspace.writeFile('blocks/intro.qmd', '# Introduction\n\nThis is the intro.');
    await workspace.writeFile('blocks/methods.qmd', '# Methods\n\nThese are the methods.');
  }

  it('validates and normalizes a consistent assembly', async () => {
    await setupValidWorkspace();
    const result = await preCommitAssembly(workspace);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.article).toContain('{{< include blocks/intro.qmd >}}');
    expect(result.article).toContain('{{< include blocks/methods.qmd >}}');
  });

  it('fails when the assembly file is missing', async () => {
    const result = await preCommitAssembly(workspace);
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('not found'))).toBe(true);
  });

  it('fails when an include references a missing block file', async () => {
    await workspace.writeFile('article.qmd', '{{< include blocks/ghost.qmd >}}');
    const result = await preCommitAssembly(workspace);

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('ghost.qmd'))).toBe(true);
  });

  it('reports orphan drafts as warnings without failing', async () => {
    await setupValidWorkspace();
    await workspace.writeFile('blocks/scratch.qmd', '# Scratch\n\nnotes');
    const result = await preCommitAssembly(workspace);

    expect(result.success).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('scratch.qmd'))).toBe(true);
  });
});