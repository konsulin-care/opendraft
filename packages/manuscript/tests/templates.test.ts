import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { MemoryWorkspace } from '@opendraft/workspace';
import { addManuscript, scaffoldProject } from '../src/index';
import { STARTER_REFERENCES_BIB, starterManuscriptFiles } from '../src/templates';

/** Protocol block used by the scaffold comparison. */
const PROTOCOL = {
  name: 'opendraft',
  version: 'f192c95d750b6a71b49134819b08aec509790c84',
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: 'f192c95d750b6a71b49134819b08aec509790c84',
};

/** Starter file names shared by scaffoldProject and addManuscript. */
const SHARED_STARTER_FILES = ['article.qmd', '_author.yml', '_abstract.yml'];

describe('starterManuscriptFiles', () => {
  it('builds an article.qmd whose front matter lists the metadata files and shared bibliography', () => {
    const files = starterManuscriptFiles('2024-01-15');
    const article = files['article.qmd'];
    expect(article).toBeDefined();

    const frontmatter = article.slice(4, article.indexOf('\n---', 4));
    const parsed = parse(frontmatter) as {
      'metadata-files': string[];
      bibliography: string;
    };

    expect(parsed['metadata-files']).toEqual([
      '_author.yml',
      '_abstract.yml',
      '_frontmatter.yml',
    ]);
    expect(parsed.bibliography).toBe('../references.bib');
  });

  it('stamps the given date into _frontmatter.yml', () => {
    const files = starterManuscriptFiles('2024-01-15');
    expect(files['_frontmatter.yml']).toContain('date: 2024-01-15');
  });

  it('exposes the shared references.bib starter', () => {
    expect(STARTER_REFERENCES_BIB).toContain('@article{doe2024');
  });
});

describe('scaffoldProject and addManuscript share starter templates', () => {
  it('writes identical article.qmd, _author.yml and _abstract.yml for the same id', async () => {
    const scaffolded = new MemoryWorkspace();
    await scaffoldProject(scaffolded, { manuscriptId: 'same-paper', protocol: PROTOCOL });

    const added = new MemoryWorkspace();
    await addManuscript(added, 'same-paper');

    for (const file of SHARED_STARTER_FILES) {
      expect(await added.readFile(`manuscripts/same-paper/${file}`)).toBe(
        await scaffolded.readFile(`manuscripts/same-paper/${file}`),
      );
    }
  });
});
