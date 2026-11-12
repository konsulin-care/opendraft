import { describe, it, expect } from 'vitest';
import { getMarkdown } from '@milkdown/kit/utils';
import { MemoryWorkspace } from '@opendraft/workspace';
import { createCrepeConfig } from './crepe-config';

/**
 * Mount a Crepe instance configured the way a block body is (same
 * `createCrepeConfig` path) seeded with the given source, then
 * serialize its document back to markdown.
 *
 * @param body - Block body markdown seeded into the editor.
 * @returns The serializer output for the seeded document.
 */
async function serializeBody(body: string): Promise<string> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const crepe = createCrepeConfig({
    root,
    defaultValue: body,
    workspace: new MemoryWorkspace(),
    onStateChangeRef: { current: () => undefined },
  });
  await crepe.create();
  try {
    return crepe.editor.action(getMarkdown());
  } finally {
    crepe.destroy();
    root.remove();
  }
}

/** Compare ignoring trailing newlines (contract: modulo one trailing newline). */
function normalized(text: string): string {
  return text.replace(/\n+$/, '');
}

describe('createCrepeConfig — Quarto chunk serialization', () => {
  it('returns seeded ```{r} and ```{r label, echo=FALSE} chunks unchanged', async () => {
    const input = '```{r}\ncode\n```\n\n```{r label, echo=FALSE}\ncode\n```\n';
    const markdown = await serializeBody(input);
    expect(normalized(markdown)).toBe(normalized(input));
  });

  it('keeps the ```{python} header and #| option lines unchanged', async () => {
    const input = '```{python}\n#| echo: false\nx = 1\n```\n';
    const markdown = await serializeBody(input);
    expect(markdown).toContain('```{python}\n');
    expect(markdown).toContain('#| echo: false\n');
    expect(normalized(markdown)).toBe(normalized(input));
  });

  it('serializes a standard ```r fence as ```r with no braces added', async () => {
    const input = '```r\ncode\n```\n';
    const markdown = await serializeBody(input);
    expect(markdown).toContain('```r\n');
    expect(markdown).not.toContain('{r}');
  });
});
