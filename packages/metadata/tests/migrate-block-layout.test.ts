import { describe, it, expect } from 'vitest';
import { migrateToBlockLayout } from '../src/migration.js';

describe('migrateToBlockLayout — H1 splitting', () => {
  it('splits article.qmd by H1 headings', () => {
    const content = `# Introduction

Some intro text.

# Methods

Some methods text.

# Results

Some results text.`;

    const result = migrateToBlockLayout(content);

    expect(result.manifest.blocks).toHaveLength(3);
    expect(result.manifest.blocks[0].title).toBe('Introduction');
    expect(result.manifest.blocks[1].title).toBe('Methods');
    expect(result.manifest.blocks[2].title).toBe('Results');
    // Block contents keyed by slug-derived filenames
    const block0File = result.manifest.blocks[0].file;
    const block1File = result.manifest.blocks[1].file;
    expect(result.blocks[block0File]).toContain('Introduction');
    expect(result.blocks[block1File]).toContain('Methods');
  });

  it('preserves order of blocks', () => {
    const content = `# Third

Third content.

# First

First content.

# Second

Second content.`;

    const result = migrateToBlockLayout(content);
    expect(result.manifest.blocks[0].title).toBe('Third');
    expect(result.manifest.blocks[1].title).toBe('First');
    expect(result.manifest.blocks[2].title).toBe('Second');
  });
});

describe('migrateToBlockLayout — H2 fallback', () => {
  it('falls back to H2 when only one H1 exists', () => {
    const content = `# Only One H1

Some text.

## First Section

First section content.

## Second Section

Second section content.`;

    const result = migrateToBlockLayout(content);

    // H2 has 2 occurrences, H1 has 1 — blocks are defined by H2
    expect(result.manifest.blocks).toHaveLength(2);
    expect(result.manifest.blocks[0].title).toBe('First Section');
    expect(result.manifest.blocks[1].title).toBe('Second Section');
  });
});

describe('migrateToBlockLayout — highest-level priority', () => {
  it('uses highest-level heading with ≥2 occurrences', () => {
    const content = `# Single H1

Text.

## Section A

Content A.

## Section B

Content B.

### Sub 1

Sub content 1.

### Sub 2

Sub content 2.`;

    const result = migrateToBlockLayout(content);

    // H2 has 2 occurrences, H3 has 2 occurrences — H2 wins (higher level)
    expect(result.manifest.blocks).toHaveLength(2);
    expect(result.manifest.blocks[0].title).toBe('Section A');
    expect(result.manifest.blocks[1].title).toBe('Section B');
  });
});

describe('migrateToBlockLayout — preamble preservation', () => {
  it('preserves text before first block heading', () => {
    const content = `---
metadata-files:
  - _author.yml
---

Preamble text here.

# First Section

Content.

# Second Section

More content.`;

    const result = migrateToBlockLayout(content);

    expect(result.article).toContain('Preamble text here.');
    expect(result.article).toContain('{{< include blocks/');
    // Preamble should appear before the includes
    const preamblePos = result.article.indexOf('Preamble text here.');
    const includePos = result.article.indexOf('{{< include');
    expect(preamblePos).toBeLessThan(includePos);
  });
});

describe('migrateToBlockLayout — no headings fallback', () => {
  it('creates single block when no headings exist', () => {
    const content = 'Just some plain text without any headings.';

    const result = migrateToBlockLayout(content);

    expect(result.manifest.blocks).toHaveLength(1);
    expect(result.manifest.version).toBe('1.0.0');
  });
});

describe('migrateToBlockLayout — slug determinism', () => {
  it('produces same slugs for same content', () => {
    const content = `# Introduction

Same content.

# Methods

Different content.`;

    const result1 = migrateToBlockLayout(content);
    const result2 = migrateToBlockLayout(content);

    expect(result1.manifest.blocks[0].id).toBe(result2.manifest.blocks[0].id);
    expect(result1.manifest.blocks[1].id).toBe(result2.manifest.blocks[1].id);
  });

  it('produces different slugs for different content', () => {
    const content1 = '# Introduction\n\nContent A.';
    const content2 = '# Introduction\n\nContent B.';

    const result1 = migrateToBlockLayout(content1);
    const result2 = migrateToBlockLayout(content2);

    // Same title, different content → different slugs
    expect(result1.manifest.blocks[0].id).not.toBe(result2.manifest.blocks[0].id);
  });
});

describe('migrateToBlockLayout — article.qmd output', () => {
  it('generates include shortcodes in manifest order', () => {
    const content = `# Introduction

Intro.

# Methods

Methods.`;

    const result = migrateToBlockLayout(content);

    expect(result.article).toContain('---');
    expect(result.article).toContain('metadata-files:');
    expect(result.article).toContain('# References');
    expect(result.article).toContain('::: {#refs}');

    const includes = result.article.match(/\{\{< include blocks\/[^>]+ >}}/g) || [];
    expect(includes).toHaveLength(2);
  });
});
