import { describe, it, expect } from 'vitest';
import { validateAssembly } from '../src/assembly.js';

const ASSEMBLY = [
  '{{< include blocks/_intro.qmd >}}',
  '',
  '{{< include blocks/_methods.qmd >}}',
].join('\n');

describe('validateAssembly: consistency', () => {
  it('accepts a consistent assembly with matching block files', () => {
    const result = validateAssembly({
      assembly: ASSEMBLY,
      blockFiles: { 'blocks/_intro.qmd': '# Intro\n\nbody', 'blocks/_methods.qmd': '# Methods\n\nm1' },
      files: ['_intro.qmd', '_methods.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('rejects an include without a matching block file', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_ghost.qmd >}}',
      blockFiles: {},
      files: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost.qmd'))).toBe(true);
  });

  it('rejects duplicate includes of the same block', () => {
    const result = validateAssembly({
      assembly: ['{{< include blocks/_intro.qmd >}}', '{{< include blocks/_intro.qmd >}}'].join('\n'),
      blockFiles: { 'blocks/_intro.qmd': '# Intro\n\nbody' },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('duplicate'))).toBe(true);
  });

  it('accepts empty block files referenced by the assembly', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '' },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('validateAssembly: drafts and paths', () => {
  it('warns on orphan block files (drafts) without failing validity', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro\n\nbody' },
      files: ['_intro.qmd', '_scratch.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.some((e) => e.message.includes('scratch.qmd'))).toBe(true);
  });

  it('rejects non-block include paths', () => {
    const result = validateAssembly({
      assembly: '{{< include ../outside/x.qmd >}}',
      blockFiles: {},
      files: [],
    });

    expect(result.valid).toBe(false);
  });
});

describe('validateAssembly: heading anchors', () => {
  it("rejects an included block whose heading anchor differs from 'sec-<short>'", () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-other .deo-introduction}\n\nbody' },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('anchor'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('sec-intro'))).toBe(true);
  });

  it("accepts an included block whose heading anchor equals 'sec-<short>'", () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro .deo-introduction}\n\nbody' },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reports no anchor error for an included block with no heading line', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': 'plain body text\nsecond line' },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.message.includes('anchor'))).toBe(false);
  });
});

describe('validateAssembly: optional role class', () => {
  it('accepts anchor headings with an optional role class and with no class', () => {
    const withClass = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro .deo-introduction}\n\nbody' },
      files: ['_intro.qmd'],
    });
    const withoutClass = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro}\n\nbody' },
      files: ['_intro.qmd'],
    });

    expect(withClass.valid).toBe(true);
    expect(withClass.errors).toEqual([]);
    expect(withoutClass.valid).toBe(true);
    expect(withoutClass.errors).toEqual([]);
  });
});

describe('validateAssembly: naming rules', () => {
  it("reports an error naming 'opendraft block normalize' for a legacy blocks/intro.qmd file", () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro}\n\nbody' },
      files: ['_intro.qmd', 'intro.qmd'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('opendraft block normalize'))).toBe(true);
  });

  it('rejects an include of blocks/intro.qmd and a prefixed block stem longer than 40 characters', () => {
    const legacyInclude = validateAssembly({
      assembly: '{{< include blocks/intro.qmd >}}',
      blockFiles: {},
      files: [],
    });

    expect(legacyInclude.valid).toBe(false);
    expect(legacyInclude.errors.some((e) => e.message.includes('opendraft block normalize'))).toBe(true);

    const longStem = 'a'.repeat(41);
    const longInclude = validateAssembly({
      assembly: `{{< include blocks/_${longStem}.qmd >}}`,
      blockFiles: {},
      files: [],
    });

    expect(longInclude.valid).toBe(false);

    const longFile = validateAssembly({
      assembly: '',
      blockFiles: {},
      files: [`_${longStem}.qmd`],
    });

    expect(longFile.valid).toBe(false);
    expect(longFile.errors.some((e) => e.message.includes('invalid block file name'))).toBe(true);
  });
});

describe('validateAssembly: prefixed block acceptance', () => {
  it('accepts blocks/_intro.qmd included as {{< include blocks/_intro.qmd >}} with heading anchor sec-intro', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro .deo-introduction}\n\nbody' },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('validateAssembly: outcomes unchanged by anchor check', () => {
  it('keeps existing include/orphan/duplicate validation outcomes unchanged', () => {
    const missing = validateAssembly({
      assembly: '{{< include blocks/_ghost.qmd >}}',
      blockFiles: {},
      files: [],
    });
    expect(missing.valid).toBe(false);
    expect(missing.errors.some((e) => e.message.includes('ghost.qmd'))).toBe(true);

    const duplicate = validateAssembly({
      assembly: ['{{< include blocks/_intro.qmd >}}', '{{< include blocks/_intro.qmd >}}'].join('\n'),
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro}\n\nbody' },
      files: ['_intro.qmd'],
    });
    expect(duplicate.valid).toBe(false);
    expect(duplicate.errors.some((e) => e.message.includes('duplicate'))).toBe(true);

    const orphan = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro}\n\nbody' },
      files: ['_intro.qmd', '_scratch.qmd'],
    });
    expect(orphan.valid).toBe(true);
    expect(orphan.errors).toEqual([]);
    expect(orphan.warnings.some((w) => w.message.includes('scratch.qmd'))).toBe(true);
  });
});

describe('validateAssembly: heading classes', () => {
  it('returns an error for an included block whose heading class is .deo-bogus', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro .deo-bogus}\n\nbody' },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('.deo-bogus'))).toBe(true);
  });

  it('accepts .doco-section and SECTION_ROLES .deo-<role> heading classes', () => {
    const generic = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': '# Intro {#sec-intro .doco-section}\n\nbody' },
      files: ['_intro.qmd'],
    });
    const role = validateAssembly({
      assembly: '{{< include blocks/_methods.qmd >}}',
      blockFiles: { 'blocks/_methods.qmd': '# Methods {#sec-methods .deo-methods}\n\nbody' },
      files: ['_methods.qmd'],
    });

    expect(generic.errors).toEqual([]);
    expect(role.errors).toEqual([]);
  });
});

describe('validateAssembly: duplicate anchors', () => {
  it('returns one error when two included blocks share the anchor sec-intro', () => {
    const result = validateAssembly({
      assembly: [
        '{{< include blocks/_intro.qmd >}}',
        '{{< include blocks/_other.qmd >}}',
      ].join('\n'),
      blockFiles: {
        'blocks/_intro.qmd': '# Intro {#sec-intro .deo-introduction}\n\nbody',
        'blocks/_other.qmd': '# Other {#sec-intro .doco-section}\n\nbody',
      },
      files: ['_intro.qmd', '_other.qmd'],
    });

    expect(result.valid).toBe(false);
    const duplicates = result.errors.filter(
      (e) => e.message.includes('duplicate anchor') && e.message.includes('sec-intro'),
    );
    expect(duplicates).toHaveLength(1);
  });
});

describe('validateAssembly: heading warnings', () => {
  it('warns, not errors, for a block without a heading', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: { 'blocks/_intro.qmd': 'plain body text\nsecond line' },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.message.includes('missing heading'))).toBe(true);
  });

  it('warns, not errors, for a level-1 heading in the body after the first line', () => {
    const result = validateAssembly({
      assembly: '{{< include blocks/_intro.qmd >}}',
      blockFiles: {
        'blocks/_intro.qmd': '# Intro {#sec-intro .deo-introduction}\n\n# Stray\n\nbody',
      },
      files: ['_intro.qmd'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.message.includes('level-1 heading'))).toBe(true);
  });
});
