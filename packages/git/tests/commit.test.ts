import { describe, it, expect, beforeEach } from 'vitest';
import { preCommitAssembly } from '../src/commit.js';
import { MemoryWorkspace } from '@opendraft/workspace';

const DIR = 'manuscripts/paper';

async function seed(workspace: MemoryWorkspace): Promise<void> {
  await workspace.writeFile(`${DIR}/article.qmd`, [
    '{{< include blocks/_intro.qmd >}}',
    '{{< include blocks/_methods.qmd >}}',
  ].join('\n'));
  await workspace.writeFile(`${DIR}/blocks/_intro.qmd`, '# Introduction {#sec-intro}\n\nThis is the intro.');
  await workspace.writeFile(`${DIR}/blocks/_methods.qmd`, '# Methods {#sec-methods}\n\nThese are the methods.');
}

describe('preCommitAssembly', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  const setupValidWorkspace = (): Promise<void> => seed(workspace);

  it('validates and normalizes a consistent assembly', async () => {
    await setupValidWorkspace();
    const result = await preCommitAssembly(workspace, DIR);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.article).toContain('blocks/_methods.qmd >}}');
  });

  it('fails when the assembly file is missing', async () => {
    const result = await preCommitAssembly(workspace, DIR);
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('not found'))).toBe(true);
  });

  it('fails when an include references a missing block file', async () => {
    await workspace.writeFile(`${DIR}/article.qmd`, '{{< include blocks/_ghost.qmd >}}');
    const result = await preCommitAssembly(workspace, DIR);

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('ghost.qmd'))).toBe(true);
  });

  it('fails on legacy un-prefixed block names', async () => {
    await setupValidWorkspace();
    await workspace.writeFile(`${DIR}/blocks/intro.qmd`, '# Old\n\nlegacy');
    const result = await preCommitAssembly(workspace, DIR);

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('blocks/intro.qmd'))).toBe(true);
  });

  it('reports orphan drafts as warnings without failing', async () => {
    await setupValidWorkspace();
    await workspace.writeFile(`${DIR}/blocks/_scratch.qmd`, '# Scratch {#sec-scratch}\n\nnotes');
    const result = await preCommitAssembly(workspace, DIR);

    expect(result.success).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('scratch.qmd'))).toBe(true);
  });
});
