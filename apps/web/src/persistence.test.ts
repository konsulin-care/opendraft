import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { loadFile, saveFile } from './persistence';

/**
 * Path-aware persistence: every file lives at its own workspace path.
 * Saving trims trailing whitespace and writes one trailing newline.
 */
let workspace: MemoryWorkspace;

beforeEach(() => {
  workspace = new MemoryWorkspace();
});

describe('saveFile', () => {
  it('writes the text to the explicit path', async () => {
    await saveFile(workspace, 'a/x.qmd', '# Intro\n\npara');
    const raw = await workspace.readFile('a/x.qmd');
    expect(raw).toBe('# Intro\n\npara\n');
  });

  it('trims trailing whitespace and keeps a single trailing newline', async () => {
    await saveFile(workspace, 'a/x.qmd', '# Intro\n\npara  \n\n');
    expect(await workspace.readFile('a/x.qmd')).toBe('# Intro\n\npara\n');
  });

  it('keeps files at distinct paths independent', async () => {
    await saveFile(workspace, 'a/x.qmd', '# X');
    await saveFile(workspace, 'a/y.qmd', '# Y');
    expect(await workspace.readFile('a/x.qmd')).toBe('# X\n');
    expect(await workspace.readFile('a/y.qmd')).toBe('# Y\n');
  });
});

describe('loadFile', () => {
  it('returns an empty string when the file does not exist', async () => {
    expect(await loadFile(workspace, 'a/x.qmd')).toBe('');
  });

  it('round-trips the saved markdown', async () => {
    await saveFile(workspace, 'a/x.qmd', '# Intro\n\npara');
    expect(await loadFile(workspace, 'a/x.qmd')).toBe('# Intro\n\npara\n');
  });

  it('reads a hand-authored file unchanged', async () => {
    await workspace.writeFile('a/x.qmd', '# Intro\n\nhand written');
    expect(await loadFile(workspace, 'a/x.qmd')).toBe('# Intro\n\nhand written');
  });
});
