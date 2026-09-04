// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('./components/ManuscriptEditor.tsx', import.meta.url)),
  'utf8',
);

const css = readFileSync(
  fileURLToPath(new URL('./index.css', import.meta.url)),
  'utf8',
);

describe('ManuscriptEditor crepe theme integration', () => {
  it('does not import Crepe theme CSS in the component', () => {
    expect(source).not.toContain('@milkdown/crepe/theme/common/style.css');
    expect(source).not.toContain('@milkdown/crepe/theme/classic.css');
  });

  it('does not import the split prosemirror/reset sheets', () => {
    expect(source).not.toContain('@milkdown/crepe/theme/common/prosemirror.css');
    expect(source).not.toContain('@milkdown/crepe/theme/common/reset.css');
  });

  it('imports Crepe theme CSS in index.css inside a cascade layer', () => {
    expect(css).toMatch(/@layer\s+crepe/);
    expect(css).toContain('@milkdown/crepe/theme/common/style.css');
    expect(css).toContain('@milkdown/crepe/theme/classic.css');
  });

  it('configures a random uplifting placeholder feature', () => {
    expect(source).toContain('Crepe.Feature.Placeholder');
    expect(source).toContain('pickPlaceholderHint');
  });
});