import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import {
  createManuscriptDoc,
  parseManuscript,
  renameBlock,
  serializeManuscript,
} from '@opendraft/editor';
import { loadManuscript, saveManuscript } from './persistence';

/**
 * Manuscript persistence: article.qmd holds the authored include assembly,
 * blocks/<slug>.qmd hold per-block markdown. Drafts exist on disk only.
 */
let workspace: MemoryWorkspace;

beforeEach(() => {
  workspace = new MemoryWorkspace();
});

describe('saveManuscript', () => {
  it('writes the assembly and per-slug block files', async () => {
    const doc = createManuscriptDoc('# Intro {#intro}\n\npara\n\n# Methods {#methods}\n\nbody');
    await saveManuscript(workspace, doc);

    const article = await workspace.readFile('article.qmd');
    expect(article).toContain('{{< include blocks/intro.qmd >}}');
    expect(article).toContain('{{< include blocks/methods.qmd >}}');
    expect(article).toContain('# References');

    const intro = await workspace.readFile('blocks/intro.qmd');
    expect(intro).toContain('# Intro {#intro}');
  });

  it('keeps draft sections on disk but out of the assembly', async () => {
    const { doc } = parseManuscript({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: {
        intro: '# Intro {#intro}\n\npara',
        draft: '# Draft {#draft}\n\nnotes',
      },
    });
    await saveManuscript(workspace, doc);

    const article = await workspace.readFile('article.qmd');
    expect(article).not.toContain('blocks/draft.qmd');
    expect(article).toContain('blocks/intro.qmd');
    expect(await workspace.readFile('blocks/draft.qmd')).not.toBeNull();
  });

  it('removes stale block files that are no longer in the manuscript', async () => {
    await workspace.writeFile('blocks/stale.qmd', '# Stale\n\ngone');
    const doc = createManuscriptDoc('# Intro {#intro}\n\npara');
    await saveManuscript(workspace, doc);

    const files = await workspace.listFiles('blocks/');
    expect(files).not.toContain('stale.qmd');
    expect(files).toContain('intro.qmd');
  });
});

describe('loadManuscript', () => {
  it('reconstructs the doc from assembly and block files', async () => {
    const doc = createManuscriptDoc('# Intro {#intro}\n\npara\n\n# Methods {#methods}\n\nbody');
    await saveManuscript(workspace, doc);

    const { doc: loaded, warnings } = await loadManuscript(workspace);
    expect(warnings).toEqual([]);
    expect(loaded.toJSON()).toEqual(serializeManuscript(doc).blocks.size > 0 ? doc.toJSON() : doc.toJSON());
  });

  it('flags orphan block files as drafts', async () => {
    await workspace.writeFile('article.qmd', '{{< include blocks/intro.qmd >}}');
    await workspace.writeFile('blocks/intro.qmd', '# Intro {#intro}\n\npara');
    await workspace.writeFile('blocks/scratch.qmd', '# Scratch {#scratch}\n\nnotes');

    const { doc } = await loadManuscript(workspace);
    expect(doc.childCount).toBe(2);
    expect(doc.child(1).attrs.id).toBe('scratch');
    expect(doc.child(1).attrs.draft).toBe(true);
  });

  it('reflects a renamed slug in file and include line', async () => {
    const doc = createManuscriptDoc('# Intro {#intro}\n\npara');
    const renamed = renameBlock(doc, 'intro', 'introduction');
    if (!renamed.ok) throw new Error(renamed.error);

    await saveManuscript(workspace, renamed.doc);
    expect(workspace.readFile('article.qmd')).resolves.toContain('blocks/introduction.qmd');

    const files = await workspace.listFiles('blocks/');
    expect(files).not.toContain('intro.qmd');
    expect(files).toContain('introduction.qmd');

    const { doc: loaded } = await loadManuscript(workspace);
    expect(loaded.childCount).toBe(1);
    expect(loaded.child(0).attrs.id).toBe('introduction');
  });
});