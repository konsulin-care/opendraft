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
import { Schema, Slice } from '@milkdown/kit/prose/model';
import type { Fragment } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import type { Plugin } from '@milkdown/kit/prose/state';
import { createHeadingGuard } from './heading-guard';
import { headingItems } from '../components/toolbar-items';

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

/**
 * Run the heading guard's `transformPasted` prop over a slice, the way
 * the editor applies it before inserting pasted content. The prop is
 * already bound to the plugin by ProseMirror, so it needs no view.
 *
 * @param plugin - Heading guard plugin from {@link createHeadingGuard}.
 * @param slice - Slice about to be pasted.
 * @returns The transformed slice.
 */
function transformPasted(plugin: Plugin, slice: Slice): Slice {
  const transform = plugin.props.transformPasted as (slice: Slice) => Slice;
  return transform(slice);
}

/**
 * Collect the heading levels of the top-level nodes in a fragment.
 *
 * @param fragment - Fragment of the transformed slice to inspect.
 * @returns Heading levels in document order.
 */
function headingLevels(fragment: Fragment): number[] {
  const levels: number[] = [];
  fragment.forEach((node) => {
    if (node.type.name === 'heading') levels.push(node.attrs.level);
  });
  return levels;
}

describe('transformPasted', () => {
  it("shifts pasted '# A' and '## B' to an H2 and an H3", () => {
    const schema = createSchema();
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.heading.create({ level: 1 }, schema.text('A')),
      schema.nodes.heading.create({ level: 2 }, schema.text('B')),
    ]);
    const transformed = transformPasted(
      createHeadingGuard(),
      new Slice(doc.content, 0, 0),
    );
    expect(headingLevels(transformed.content)).toEqual([2, 3]);
  });

  it('shifts every level by one and keeps H6 at H6', () => {
    const schema = createSchema();
    const doc = schema.nodes.doc.create(
      null,
      [1, 2, 3, 4, 5, 6].map((level) =>
        schema.nodes.heading.create({ level }, schema.text(`H${level}`)),
      ),
    );
    const transformed = transformPasted(
      createHeadingGuard(),
      new Slice(doc.content, 0, 0),
    );
    expect(headingLevels(transformed.content)).toEqual([2, 3, 4, 5, 6, 6]);
  });
});

describe('heading-1 command inside a block body', () => {
  it('leaves the body with an H2', () => {
    const schema = createSchema();
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('Title')),
    ]);
    const state = EditorState.create({
      doc,
      plugins: [createHeadingGuard()],
      selection: TextSelection.create(doc, 1),
    });
    // The setHeading(1) command path: setBlockType to a level-1 heading.
    const next = state.apply(
      state.tr.setBlockType(1, 1, schema.nodes.heading, { level: 1 }),
    );
    const block = next.doc.firstChild;
    expect(block?.type.name).toBe('heading');
    expect(block?.attrs.level).toBe(2);
  });
});

describe('block toolbar heading menu', () => {
  const toolbarSource = readFileSync(
    fileURLToPath(new URL('../components/toolbar-items.ts', import.meta.url)),
    'utf8',
  );

  it('lists no level-1 option', () => {
    const seen: number[] = [];
    const items = headingItems(0, (level) => seen.push(level));
    expect(items.map((item) => item.label)).not.toContain('Heading 1');
    // Selecting every entry never requests level 1.
    items.forEach((item) => item.onSelect());
    expect(seen).not.toContain(1);
    // The source table itself carries no level-1 row.
    expect(toolbarSource).not.toMatch(/\[1,\s*'Heading/);
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

  it('drops the slash menu level-1 entry via the Crepe textGroup hook', () => {
    const crepeSource = readFileSync(
      fileURLToPath(new URL('../components/crepe-config.ts', import.meta.url)),
      'utf8',
    );
    expect(crepeSource).toMatch(/textGroup:\s*\{\s*h1:\s*null/);
  });
});
