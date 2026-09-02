import { describe, it, expect } from 'vitest';
import { validateOpendraft } from '../src/opendraft.js';
import { validateManuscript } from '../src/manuscript.js';
import { validateMetadata, type MetadataType } from '../src/metadata.js';

interface ManuscriptDir {
  id: string;
  files: string[];
  metadata: Record<string, unknown>;
}

const VALID_CONFIG = {
  protocol: {
    name: 'opendraft',
    version: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
    repository: 'https://github.com/konsulin-care/opendraft',
    commit: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
  },
  manuscripts: [{ id: 'my-article', path: 'manuscripts/my-article' }],
};

const VALID_MANUSCRIPT_FILES = [
  'article.qmd', '_author.yml', '_abstract.yml', '_frontmatter.yml', 'references.bib',
];

const VALID_METADATA: Record<string, unknown> = {
  author: { authors: [{ name: 'Jane Doe' }] },
  abstract: { abstract: 'This paper presents...' },
  frontmatter: { title: 'My Article' },
};

function validateProjectLogic(
  opendraftConfig: unknown,
  manuscriptDirs: ManuscriptDir[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const configResult = validateOpendraft(opendraftConfig);
  for (const err of configResult.errors) {
    errors.push(`opendraft.yml: ${err.path} — ${err.message}`);
  }

  for (const dir of manuscriptDirs) {
    addManuscriptErrors(dir, errors);
  }

  return { valid: errors.length === 0, errors };
}

function addManuscriptErrors(dir: ManuscriptDir, errors: string[]): void {
  const manuscriptResult = validateManuscript(dir.id, dir.files);
  for (const err of manuscriptResult.errors) {
    errors.push(`manuscripts/${dir.id}: ${err.path} — ${err.message}`);
  }

  const metadataTypes: MetadataType[] = ['author', 'abstract', 'frontmatter'];
  const fileMap: Record<MetadataType, string> = {
    author: '_author.yml',
    abstract: '_abstract.yml',
    frontmatter: '_frontmatter.yml',
  };

  for (const type of metadataTypes) {
    const fileName = fileMap[type];
    if (dir.files.includes(fileName) && dir.metadata[type]) {
      const metaResult = validateMetadata(dir.metadata[type], type);
      for (const err of metaResult.errors) {
        errors.push(`manuscripts/${dir.id}/${fileName}: ${err.path} — ${err.message}`);
      }
    }
  }
}

describe('validateProject — valid project', () => {
  it('passes for a valid opendraft.yml with no manuscripts', () => {
    const config = { ...VALID_CONFIG, manuscripts: [] };
    const result = validateProjectLogic(config, []);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes for a valid project with manuscripts', () => {
    const dirs: ManuscriptDir[] = [{
      id: 'my-article',
      files: VALID_MANUSCRIPT_FILES,
      metadata: VALID_METADATA,
    }];
    const result = validateProjectLogic(VALID_CONFIG, dirs);
    expect(result.valid).toBe(true);
  });
});

describe('validateProject — invalid project', () => {
  it('fails for invalid opendraft.yml', () => {
    const result = validateProjectLogic({ manuscripts: [] }, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('opendraft.yml'))).toBe(true);
  });

  it('collects errors from all sources', () => {
    const dirs: ManuscriptDir[] = [{
      id: 'Bad_ID',
      files: [],
      metadata: {},
    }];
    const result = validateProjectLogic({ manuscripts: [] }, dirs);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
