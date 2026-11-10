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

describe('createCrepeConfig — citation serialization at config time', () => {
  it("round-trips a body containing '[@smith2020]' without a backslash escape", async () => {
    const markdown = await serializeBody('As shown by prior work [@smith2020].');
    expect(markdown).toContain('[@smith2020]');
    expect(markdown).not.toContain('\\[');
  });

  it("round-trips a citekey with underscores '[@smith_2020]' without '\\_' escapes", async () => {
    const markdown = await serializeBody('As shown by prior work [@smith_2020].');
    expect(markdown).toContain('[@smith_2020]');
    expect(markdown).not.toContain('\\_');
  });
});
