import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { loadManuscript, saveManuscript, MANUSCRIPT_PATH } from './persistence';

/**
 * Manuscript persistence: the whole manuscript lives in a single
 * markdown file at the workspace root. No blocks, no assembly.
 */
let workspace: MemoryWorkspace;

beforeEach(() => {
  workspace = new MemoryWorkspace();
});

describe('saveManuscript', () => {
  it('writes the manuscript as a single markdown file', async () => {
    await saveManuscript(workspace, '# Intro\n\npara');
    const raw = await workspace.readFile(MANUSCRIPT_PATH);
    expect(raw).toBe('# Intro\n\npara\n');
  });

  it('trims trailing whitespace and keeps a single trailing newline', async () => {
    await saveManuscript(workspace, '# Intro\n\npara  \n\n');
    expect(await workspace.readFile(MANUSCRIPT_PATH)).toBe('# Intro\n\npara\n');
  });
});

describe('loadManuscript', () => {
  it('returns an empty string when no manuscript exists', async () => {
    expect(await loadManuscript(workspace)).toBe('');
  });

  it('round-trips the saved markdown', async () => {
    await saveManuscript(workspace, '# Intro\n\npara');
    expect(await loadManuscript(workspace)).toBe('# Intro\n\npara\n');
  });

  it('reads a hand-authored manuscript file unchanged', async () => {
    await workspace.writeFile(MANUSCRIPT_PATH, '# Intro\n\nhand written');
    expect(await loadManuscript(workspace)).toBe('# Intro\n\nhand written');
  });
});