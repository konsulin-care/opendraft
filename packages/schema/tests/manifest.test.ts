import { describe, it, expect } from 'vitest';
import { validateManifest } from '../src/manifest.js';

describe('validateManifest — valid input', () => {
  it('accepts a valid manifest with one block', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Introduction' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a valid manifest with multiple blocks', () => {
    const data = {
      version: '1.0.0',
      blocks: [
        { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Introduction' },
        { id: 'e5f6a7b8', file: 'e5f6a7b8.qmd', title: 'Methods' },
        { id: 'c9d0e1f2', file: 'c9d0e1f2.qmd', title: 'Results' },
      ],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(true);
  });
});

describe('validateManifest — version validation', () => {
  it('rejects missing version', () => {
    const data = {
      blocks: [{ id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('version'))).toBe(true);
  });

  it('rejects unsupported version', () => {
    const data = {
      version: '2.0.0',
      blocks: [{ id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('version') || e.message.includes('version'))).toBe(true);
  });
});

describe('validateManifest — blocks validation', () => {
  it('rejects missing blocks', () => {
    const data = { version: '1.0.0' };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('blocks'))).toBe(true);
  });

  it('rejects empty blocks array', () => {
    const data = { version: '1.0.0', blocks: [] };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
  });

  it('rejects block missing id', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ file: 'a1b2c3d4.qmd', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('id'))).toBe(true);
  });

  it('rejects block missing file', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'a1b2c3d4', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('file'))).toBe(true);
  });

  it('rejects block missing title', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'a1b2c3d4', file: 'a1b2c3d4.qmd' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('title'))).toBe(true);
  });
});

describe('validateManifest — id format', () => {
  it('rejects id with uppercase letters', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'A1b2c3d4', file: 'A1b2c3d4.qmd', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('id'))).toBe(true);
  });

  it('rejects id with underscores', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'a1_b2c3d', file: 'a1_b2c3d.qmd', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
  });

  it('rejects id longer than 20 characters', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'a'.repeat(21), file: 'a'.repeat(21) + '.qmd', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
  });

  it('accepts id with hyphens and numbers', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'a1b2-c3d4', file: 'a1b2-c3d4.qmd', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(true);
  });
});

describe('validateManifest — file naming', () => {
  it('rejects file not matching id.qmd pattern', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'a1b2c3d4', file: 'wrong-name.qmd', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('file'))).toBe(true);
  });

  it('rejects file without .qmd extension', () => {
    const data = {
      version: '1.0.0',
      blocks: [{ id: 'a1b2c3d4', file: 'a1b2c3d4', title: 'Intro' }],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
  });
});

describe('validateManifest — duplicate detection', () => {
  it('rejects duplicate ids', () => {
    const data = {
      version: '1.0.0',
      blocks: [
        { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
        { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Duplicate' },
      ],
    };
    const result = validateManifest(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.toLowerCase().includes('duplicate'))).toBe(true);
  });
});
