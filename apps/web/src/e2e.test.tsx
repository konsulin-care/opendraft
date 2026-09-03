import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { ManuscriptEditor, type EditorTestApi } from './components/ManuscriptEditor';
import { seedWorkspace } from './seed';

// @vitest-environment jsdom

describe('End-to-end manuscript editing flow', () => {
  let workspace: MemoryWorkspace;
  let api: EditorTestApi | null;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
    api = null;
  });

  it('autosaves edits to per-slug block files and rebuilds the doc on reload', async () => {    await seedWorkspace(workspace);

    const first = render(
      <ManuscriptEditor workspace={workspace} onEditorReady={(ready) => (api = ready)} />,
    );
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });

    api!.insertText('A fresh sentence appeared.');
    await waitFor(
      async () => {
        const intro = await workspace.readFile('blocks/intro.qmd');
        expect(intro).toContain('A fresh sentence appeared.');
      },
      { timeout: 5000 },
    );

    first.unmount();
    api = null;

    // Reload: the doc is rebuilt from files, not from memory.
    render(<ManuscriptEditor workspace={workspace} onEditorReady={(ready) => (api = ready)} />);
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });
    expect(api!.getMarkdown()).toContain('A fresh sentence appeared.');

    const article = await workspace.readFile('article.qmd');
    expect(article).toContain('{{< include blocks/intro.qmd >}}');
    expect(article).toContain('# References');
  }, 20000);
});

describe('manuscript draft handling', () => {
  let workspace: MemoryWorkspace;
  let api: EditorTestApi | null;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
    api = null;
  });

  it('keeps unlinked drafts out of the assembly across edits', async () => {
    await workspace.writeFile('article.qmd', '{{< include blocks/intro.qmd >}}');
    await workspace.writeFile('blocks/intro.qmd', '# Intro {#intro}\n\nbody');
    await workspace.writeFile('blocks/scratch.qmd', '# Scratch {#scratch}\n\nnotes');

    render(<ManuscriptEditor workspace={workspace} onEditorReady={(ready) => (api = ready)} />);
    await waitFor(() => expect(api).not.toBeNull(), { timeout: 10000 });

    api!.insertText(' more');
    await waitFor(
      async () => {
        const scratch = await workspace.readFile('blocks/scratch.qmd');
        expect(scratch).toContain('more');
      },
      { timeout: 10000 },
    );

    const article = await workspace.readFile('article.qmd');
    expect(article).not.toContain('blocks/scratch.qmd');
    expect(await workspace.readFile('blocks/scratch.qmd')).not.toBeNull();
  }, 20000);
});