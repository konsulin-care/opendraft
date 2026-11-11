/**
 * Heading guard: keeps level-1 headings out of block bodies.
 *
 * `appendTransaction` demotes every H1 node in the doc to H2 (covers
 * typing '# ', commands and shortcuts). `props.transformPasted` shifts
 * every pasted heading level up by one with H6 clamped, so pasted
 * structure stays below H1 relative to the guarded document.
 */
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Fragment, Slice } from '@milkdown/kit/prose/model';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';

/** Plugin key for the heading guard. */
export const headingGuardPluginKey = new PluginKey('heading-guard');

/** Highest heading level the guard allows. */
const MAX_LEVEL = 6;

/**
 * Shift one pasted heading level up by one, clamped at H6.
 *
 * @param level - Current heading level from the node's attrs.
 * @returns The shifted level; defaults to 1 for non-number attrs.
 */
function shiftLevel(level: unknown): number {
  const current = typeof level === 'number' ? level : 1;
  return Math.min(current + 1, MAX_LEVEL);
}

/**
 * Rebuild a fragment with every heading level shifted up by one.
 *
 * Headings hold only inline content and are rebuilt directly; other
 * containers (lists, blockquotes, paragraphs) recurse so headings at
 * any depth are shifted. Leaf nodes pass through unchanged.
 *
 * @param fragment - Slice content about to be pasted.
 * @returns A new fragment with shifted heading levels.
 */
function shiftFragment(fragment: Fragment): Fragment {
  const shifted: ProseNode[] = [];
  fragment.forEach((node) => {
    if (node.type.name === 'heading') {
      shifted.push(
        node.type.create(
          { ...node.attrs, level: shiftLevel(node.attrs.level) },
          node.content,
          node.marks,
        ),
      );
    } else if (node.content.childCount > 0) {
      shifted.push(node.copy(shiftFragment(node.content)));
    } else {
      shifted.push(node);
    }
  });
  return Fragment.fromArray(shifted);
}

/**
 * Create the heading-guard ProseMirror plugin.
 *
 * Appends a transaction demoting every level-1 heading to level 2 and
 * exposes a `transformPasted` prop that shifts pasted heading levels
 * +1 (H6 clamped) before the slice is inserted.
 *
 * @returns The configured ProseMirror plugin.
 */
export function createHeadingGuard(): Plugin {
  return new Plugin({
    key: headingGuardPluginKey,
    appendTransaction: (transactions, _oldState, newState) => {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const tr = newState.tr;
      let changed = false;
      newState.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.attrs.level === 1) {
          // setNodeMarkup keeps the node's size, so later positions
          // in the same pass stay valid.
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, level: 2 });
          changed = true;
        }
      });
      return changed ? tr : null;
    },
    props: {
      transformPasted: (slice) =>
        new Slice(shiftFragment(slice.content), slice.openStart, slice.openEnd),
    },
  });
}
