import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { MemoryWorkspace } from '@opendraft/workspace';
import { OPENDRAFT_CONFIG_PATH, SHARED_BIB_PATH, discoverProject } from '../src/index';

/** Protocol block used by valid config fixtures. */
const PROTOCOL = {
  name: 'opendraft',
  version: 'f192c95d750b6a71b49134819b08aec509790c84',
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: 'f192c95d750b6a71b49134819b08aec509790c84',
};

/** Canonical article frontmatter matching the starter template. */
const ARTICLE_HEAD = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

`;

/**
 * Write a registrable manuscript folder into a workspace.
 *
 * @param ws - Workspace to write into.
 * @param id - Manuscript folder name.
 */
async function writeManuscript(ws: MemoryWorkspace, id: string): Promise<void> {
  await ws.writeFile(`manuscripts/${id}/article.qmd`, ARTICLE_HEAD);
  await ws.writeFile(`manuscripts/${id}/_author.yml`, 'authors: []\n');
  await ws.writeFile(`manuscripts/${id}/_abstract.yml`, 'abstract: ""\n');
  await ws.writeFile(`manuscripts/${id}/_frontmatter.yml`, 'title: "Article"\n');
}

describe('discoverProject — missing config', () => {
  it('returns config missing and one candidate per manuscripts subfolder, excluding references.bib', async () => {
    const ws = new MemoryWorkspace();
    await writeManuscript(ws, 'case-series-review');
    await writeManuscript(ws, 'other-paper');
    await ws.writeFile(SHARED_BIB_PATH, '@misc{keep,}\n');

    const discovery = await discoverProject(ws);

    expect(discovery.config).toBe('missing');
    expect(discovery.configErrors).toEqual([]);
    expect(discovery.listed).toEqual([]);
    expect(discovery.candidates.map((candidate) => candidate.id).sort()).toEqual([
      'case-series-review',
      'other-paper',
    ]);
  });
});

describe('discoverProject — valid config', () => {
  it('returns config valid and lists a registrable folder absent from the config as unlisted', async () => {
    const ws = new MemoryWorkspace();
    await writeManuscript(ws, 'case-series-review');
    await ws.writeFile(
      OPENDRAFT_CONFIG_PATH,
      stringify({
        protocol: PROTOCOL,
        manuscripts: [{ id: 'other-paper', path: 'manuscripts/other-paper' }],
      }),
    );

    const discovery = await discoverProject(ws);

    expect(discovery.config).toBe('valid');
    expect(discovery.configErrors).toEqual([]);
    expect(discovery.listed).toEqual(['other-paper']);
    expect(discovery.unlisted).toEqual(['case-series-review']);
  });
});

describe('discoverProject — invalid config', () => {
  it('reports config invalid with errors for unparseable YAML', async () => {
    const ws = new MemoryWorkspace();
    await writeManuscript(ws, 'case-series-review');
    await ws.writeFile(OPENDRAFT_CONFIG_PATH, 'protocol: [\n');

    const discovery = await discoverProject(ws);

    expect(discovery.config).toBe('invalid');
    expect(discovery.configErrors.length).toBeGreaterThan(0);
  });

  it('reports config invalid with errors for a config missing the protocol block', async () => {
    const ws = new MemoryWorkspace();
    await writeManuscript(ws, 'case-series-review');
    await ws.writeFile(
      OPENDRAFT_CONFIG_PATH,
      stringify({ manuscripts: [{ id: 'case-series-review', path: 'manuscripts/case-series-review' }] }),
    );

    const discovery = await discoverProject(ws);

    expect(discovery.config).toBe('invalid');
    expect(discovery.configErrors.length).toBeGreaterThan(0);
  });
});
