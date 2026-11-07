// @vitest-environment node
/**
 * Heading guard: typing "# " in a block lands on an H2 (the heading
 * input rule's H1 is demoted by the guard's appendTransaction), and
 * the block-body Crepe configuration registers the guard so every
 * block editor carries the plugin.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { createHeadingGuard } from './heading-guard';

/**
 * Minimal schema mirroring the block body: doc > paragraph | heading.
 *
 * @returns A schema with doc, paragraph, heading (level attr) and text.
 */
function createSchema(): Schema {
  return new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
      text: { group: 'inline' },
    },
  });
}

/**
 * Build the state as it looks just after the user typed "# " into an
 * empty paragraph: the text sits in the paragraph with the cursor
 * after the space, and the heading guard is installed.
 *
 * @param schema - Schema built by {@link createSchema}.
 * @returns The editor state carrying the guard plugin.
 */
function stateAfterTyping(schema: Schema): EditorState {
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text('# ')),
  ]);
  return EditorState.create({
    doc,
    plugins: [createHeadingGuard()],
    selection: TextSelection.create(doc, 3),
  });
}

describe("typing '# ' in a block", () => {
  it('produces an H2', () => {
    const schema = createSchema();
    const state = stateAfterTyping(schema);
    // The '# ' heading input rule (textblockTypeInputRule /^#\s$/) deletes
    // the matched range and turns the paragraph into an H1 — simulate
    // that exact transaction, then let the guarded state apply it.
    const inputRuleTr = state.tr
      .delete(1, 3)
      .setBlockType(1, 1, schema.nodes.heading, { level: 1 });
    const next = state.apply(inputRuleTr);
    const block = next.doc.firstChild;
    expect(block?.type.name).toBe('heading');
    expect(block?.attrs.level).toBe(2);
  });
});

describe('block-body Crepe configuration', () => {
  const blockBodySource = readFileSync(
    fileURLToPath(new URL('./BlockBody.tsx', import.meta.url)),
    'utf8',
  );

  it('registers the heading guard so every block editor carries the plugin', () => {
    expect(blockBodySource).toContain('createHeadingGuard');
    expect(blockBodySource).toMatch(/createCrepeConfig\([\s\S]*?createHeadingGuard/);
  });
});
