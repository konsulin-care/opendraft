import { describe, it, expect } from 'vitest';
import { validateOpendraft } from '../src/opendraft.js';
import { validateManuscript } from '../src/manuscript.js';
import { validateMetadata, type MetadataType } from '../src/metadata.js';
import { validateManifest, validateBlockStructure } from '../src/manifest.js';
import type { ManifestData } from '../src/manifest.js';

interface ManuscriptDir {
  id: string;
  files: string[];
  metadata: Record<string, unknown>;
  manifest?: ManifestData;
  blockFiles?: string[];
  blockContents?: Record<string, string>;
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

const VALID_MANIFEST: ManifestData = {
  version: '1.0.0',
  blocks: [{ id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' }],
};

const BLOCK_FILES = [
  '_author.yml', '_abstract.yml', '_frontmatter.yml',
  'references.bib', 'blocks/manifest.json',
];

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

  if (dir.files.includes('blocks/manifest.json') && dir.manifest) {
    const manifestResult = validateManifest(dir.manifest);
    for (const err of manifestResult.errors) {
      errors.push(`manuscripts/${dir.id}/blocks/manifest.json: ${err.path} — ${err.message}`);
    }

    if (dir.blockFiles) {
      const structureResult = validateBlockStructure(
        dir.manifest, dir.blockFiles, dir.blockContents,
      );
      for (const err of structureResult.errors) {
        errors.push(`manuscripts/${dir.id}/blocks/: ${err.path} — ${err.message}`);
      }
    }
  }
}

function makeDir(overrides: Partial<ManuscriptDir>): ManuscriptDir {
  return {
    id: 'my-article',
    files: BLOCK_FILES,
    metadata: VALID_METADATA,
    manifest: VALID_MANIFEST,
    blockFiles: ['a1b2c3d4.qmd'],
    ...overrides,
  };
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
    const dirs: ManuscriptDir[] = [{ id: 'Bad_ID', files: [], metadata: {} }];
    const result = validateProjectLogic({ manuscripts: [] }, dirs);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('validateProject — valid block-based manuscript', () => {
  it('passes for valid block-based manuscript', () => {
    const dirs = [makeDir({})];
    const result = validateProjectLogic(VALID_CONFIG, dirs);
    expect(result.valid).toBe(true);
  });
});

describe('validateProject — block structure errors', () => {
  it('detects entry without file', () => {
    const dirs = [makeDir({ blockFiles: [] })];
    const result = validateProjectLogic(VALID_CONFIG, dirs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('a1b2c3d4.qmd'))).toBe(true);
  });

  it('detects orphan block file', () => {
    const dirs = [makeDir({ blockFiles: ['a1b2c3d4.qmd', 'orphan.qmd'] })];
    const result = validateProjectLogic(VALID_CONFIG, dirs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('orphan'))).toBe(true);
  });

  it('detects empty block file', () => {
    const dirs = [makeDir({ blockContents: { 'a1b2c3d4.qmd': '' } })];
    const result = validateProjectLogic(VALID_CONFIG, dirs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('empty'))).toBe(true);
  });
});

describe('validateProject — manifest validation', () => {
  it('detects bad slug', () => {
    const badManifest: ManifestData = {
      version: '1.0.0',
      blocks: [{ id: 'BadSlug!', file: 'BadSlug!.qmd', title: 'Intro' }],
    };
    const dirs = [makeDir({ manifest: badManifest, blockFiles: ['BadSlug!.qmd'] })];
    const result = validateProjectLogic(VALID_CONFIG, dirs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('slug'))).toBe(true);
  });

  it('detects unsupported version', () => {
    const badVersion: ManifestData = {
      version: '9.0.0',
      blocks: [{ id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' }],
    };
    const dirs = [makeDir({ manifest: badVersion })];
    const result = validateProjectLogic(VALID_CONFIG, dirs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });
});
