import { describe, it, expect } from 'vitest';
import { validateBlockStructure } from '../src/manifest.js';
import type { ManifestData } from '../src/manifest.js';

function makeManifest(blocks: Array<{ id: string; file: string; title: string }>): ManifestData {
  return { version: '1.0.0', blocks };
}

describe('validateBlockStructure — valid structure', () => {
  it('passes when all manifest entries have matching files', () => {
    const manifest = makeManifest([
      { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
    ]);
    const files = ['a1b2c3d4.qmd'];
    const result = validateBlockStructure(manifest, files);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes with multiple blocks and extra non-qmd files', () => {
    const manifest = makeManifest([
      { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
      { id: 'e5f6a7b8', file: 'e5f6a7b8.qmd', title: 'Methods' },
    ]);
    const files = ['a1b2c3d4.qmd', 'e5f6a7b8.qmd', 'diagram.png'];
    const result = validateBlockStructure(manifest, files);
    expect(result.valid).toBe(true);
  });
});

describe('validateBlockStructure — entry without file', () => {
  it('detects manifest entry with no matching file on disk', () => {
    const manifest = makeManifest([
      { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
      { id: 'e5f6a7b8', file: 'e5f6a7b8.qmd', title: 'Methods' },
    ]);
    const files = ['a1b2c3d4.qmd']; // e5f6a7b8.qmd missing
    const result = validateBlockStructure(manifest, files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('e5f6a7b8.qmd'))).toBe(true);
  });
});

describe('validateBlockStructure — orphan files', () => {
  it('detects .qmd file in blocks/ not referenced by manifest', () => {
    const manifest = makeManifest([
      { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
    ]);
    const files = ['a1b2c3d4.qmd', 'orphan.qmd'];
    const result = validateBlockStructure(manifest, files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('orphan'))).toBe(true);
  });

  it('ignores non-qmd orphan files', () => {
    const manifest = makeManifest([
      { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
    ]);
    const files = ['a1b2c3d4.qmd', 'diagram.png', 'notes.txt'];
    const result = validateBlockStructure(manifest, files);
    expect(result.valid).toBe(true);
  });
});

describe('validateBlockStructure — empty block files', () => {
  it('detects empty block file', () => {
    const manifest = makeManifest([
      { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
    ]);
    const files = ['a1b2c3d4.qmd'];
    const contents: Record<string, string> = { 'a1b2c3d4.qmd': '' };
    const result = validateBlockStructure(manifest, files, contents);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.toLowerCase().includes('empty'))).toBe(true);
  });

  it('detects block file with only whitespace', () => {
    const manifest = makeManifest([
      { id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' },
    ]);
    const files = ['a1b2c3d4.qmd'];
    const contents: Record<string, string> = { 'a1b2c3d4.qmd': '   \n  \n  ' };
    const result = validateBlockStructure(manifest, files, contents);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.toLowerCase().includes('empty'))).toBe(true);
  });
});

describe('validateBlockStructure — bad slugs', () => {
  it('rejects id with uppercase', () => {
    const manifest = makeManifest([
      { id: 'A1b2c3d4', file: 'A1b2c3d4.qmd', title: 'Intro' },
    ]);
    const files = ['A1b2c3d4.qmd'];
    const result = validateBlockStructure(manifest, files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('slug'))).toBe(true);
  });

  it('rejects id longer than 20 characters', () => {
    const manifest = makeManifest([
      { id: 'a'.repeat(21), file: 'a'.repeat(21) + '.qmd', title: 'Intro' },
    ]);
    const files = ['a'.repeat(21) + '.qmd'];
    const result = validateBlockStructure(manifest, files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('slug'))).toBe(true);
  });
});

describe('validateBlockStructure — unsupported version', () => {
  it('rejects manifest with unsupported version', () => {
    const manifest = { version: '9.0.0', blocks: [{ id: 'a1b2c3d4', file: 'a1b2c3d4.qmd', title: 'Intro' }] };
    const files = ['a1b2c3d4.qmd'];
    const result = validateBlockStructure(manifest, files);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('version'))).toBe(true);
  });
});
