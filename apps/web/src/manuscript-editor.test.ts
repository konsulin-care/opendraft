// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('./components/ManuscriptEditor.tsx', import.meta.url)),
  'utf8',
);

describe('ManuscriptEditor crepe theme integration', () => {
  it('imports the aggregate Crepe common style sheet', () => {
    expect(source).toContain('@milkdown/crepe/theme/common/style.css');
  });

  it('does not import the split prosemirror/reset sheets', () => {
    expect(source).not.toContain('@milkdown/crepe/theme/common/prosemirror.css');
    expect(source).not.toContain('@milkdown/crepe/theme/common/reset.css');
  });

  it('configures a random uplifting placeholder feature', () => {
    expect(source).toContain('Crepe.Feature.Placeholder');
    expect(source).toContain('pickPlaceholderHint');
  });
});