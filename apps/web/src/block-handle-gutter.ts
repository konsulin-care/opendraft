import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { NodeSelection } from '@milkdown/kit/prose/state';
import type { Node, ResolvedPos } from '@milkdown/kit/prose/model';

/** The six-dot drag handle SVG icon. */
const DRAG_HANDLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g clip-path="url(#clip0_971_7680)"><path d="M11 18C11 19.1 10.1 20 9 20C7.9 20 7 19.1 7 18C7 16.9 7.9 16 9 16C10.1 16 11 16.9 11 18ZM9 10C7.9 10 7 10.9 7 12C7 13.1 7.9 14 9 14C10.1 14 11 13.1 11 12C11 10.9 10.1 10 9 10ZM9 4C7.9 4 7 4.9 7 6C7 7.1 7.9 8 9 8C10.1 8 11 7.1 11 6C11 4.9 10.1 4 9 4ZM15 8C16.1 8 17 7.1 17 6C17 4.9 16.1 4 15 4C13.9 4 13 4.9 13 6C13 7.1 13.9 8 15 8ZM15 10C13.9 10 13 10.9 13 12C13 13.1 13.9 14 15 14C16.1 14 17 13.1 17 12C17 10.9 16.1 10 15 10ZM15 16C13.9 16 13 16.9 13 18C13 19.1 13.9 20 15 20C16.1 20 17 19.1 17 18C17 16.9 16.1 16 15 16Z"/></g><defs><clipPath id="clip0_971_7680"><rect width="24" height="24"/></clipPath></defs></svg>`;

/** Active block information tracked by the gutter handle. */
interface ActiveBlock {
  $pos: ResolvedPos;
  node: Node;
  el: HTMLElement;
}

/** Mutable state for the plugin instance. */
interface GutterState {
  handleEl: HTMLDivElement | null;
  gutterEl: HTMLDivElement | null;
  lastActivePos: number | null;
  editorView: EditorView | null;
}

const GUTTER_CLASS = 'block-gutter-container';
const HANDLE_CLASS = 'block-gutter-handle';

/** PluginKey for the block gutter plugin. */
export const blockGutterKey = new PluginKey('block-gutter');

/** Walk up from $pos to find the nearest block-level ancestor at depth >= 1. */
function findBlockAtPos(view: EditorView, $pos: ResolvedPos): ActiveBlock | null {
  let depth = $pos.depth;
  while (depth > 0) {
    const node = $pos.node(depth);
    if (node.isBlock) {
      const ancestorPos = $pos.before(depth);
      const el = view.nodeDOM(ancestorPos) as HTMLElement | null;
      if (el) return { $pos: view.state.doc.resolve(ancestorPos), node, el };
    }
    depth--;
  }
  return null;
}

/** Position the handle element vertically centered on the active block. */
function positionHandle(
  handle: HTMLDivElement,
  activeBlock: ActiveBlock,
  editorDom: HTMLElement,
): void {
  const editorRect = editorDom.getBoundingClientRect();
  const blockRect = activeBlock.el.getBoundingClientRect();
  const sc = editorDom.closest('[style*="overflow"]') ?? editorDom.parentElement;
  const scrollTop = sc ? sc.scrollTop : 0;
  const h = 32;
  handle.style.left = '0px';
  handle.style.top = `${blockRect.top - editorRect.top + scrollTop + (blockRect.height - h) / 2}px`;
  handle.dataset.show = 'true';
}

/** Create the gutter container and handle DOM elements. */
function createGutterElements(): { gutter: HTMLDivElement; handle: HTMLDivElement } {
  const gutter = document.createElement('div');
  gutter.className = GUTTER_CLASS;
  const handle = document.createElement('div');
  handle.className = HANDLE_CLASS;
  handle.innerHTML = DRAG_HANDLE_ICON;
  handle.draggable = true;
  handle.dataset.show = 'false';
  gutter.appendChild(handle);
  return { gutter, handle };
}

/** Append the gutter to the .milkdown container. */
function appendToMilkdown(view: EditorView, gutter: HTMLDivElement): void {
  const milkdown = view.dom.closest('.milkdown') ?? view.dom.parentElement;
  if (milkdown) milkdown.appendChild(gutter);
}

/** Handle dragstart: create NodeSelection and set up drag data. */
function handleDragStart(state: GutterState, event: DragEvent): void {
  const { editorView, lastActivePos } = state;
  if (!editorView || !lastActivePos || !event.dataTransfer) return;
  const { state: editorState } = editorView;
  const nodeSelection = NodeSelection.create(editorState.doc, lastActivePos);
  editorView.dispatch(editorState.tr.setSelection(nodeSelection));
  const slice = nodeSelection.content();
  event.dataTransfer.effectAllowed = 'copyMove';
  const { dom, text } = editorView.serializeForClipboard(slice);
  event.dataTransfer.clearData();
  event.dataTransfer.setData('text/html', dom.innerHTML);
  event.dataTransfer.setData('text/plain', text);
  const target = nodeSelection.node === editorState.doc
    ? editorView.dom
    : (editorView.nodeDOM(lastActivePos) as HTMLElement);
  event.dataTransfer.setDragImage(target, 0, 0);
  Object.assign(editorView, { dragging: { slice, move: true, node: nodeSelection } });
}

/** Find the block under the cursor and reposition the handle. */
function handlePointerMove(
  state: GutterState,
  view: EditorView,
  event: MouseEvent,
): boolean {
  const { handleEl } = state;
  const rect = view.dom.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const dom = view.root.elementFromPoint(x, event.clientY);
  if (!(dom instanceof Element) || !handleEl) return false;
  const sel =
    '.ProseMirror > p,.ProseMirror > h1,.ProseMirror > h2,.ProseMirror > h3,.ProseMirror > h4,.ProseMirror > h5,.ProseMirror > h6,.ProseMirror > ul,.ProseMirror > ol,.ProseMirror > blockquote,.ProseMirror > pre,.ProseMirror > hr,.ProseMirror > table';
  if (!dom.closest(sel)) return false;
  const pos = view.posAtCoords({ left: x, top: event.clientY });
  if (!pos) return false;
  const activeBlock = findBlockAtPos(view, view.state.doc.resolve(pos.inside));
  if (!activeBlock) return false;
  state.lastActivePos = activeBlock.$pos.pos;
  positionHandle(handleEl, activeBlock, view.dom);
  return false;
}

/** Update handle position from the current selection. */
function updateFromSelection(state: GutterState, view: EditorView): void {
  const { handleEl, gutterEl } = state;
  if (!handleEl || !gutterEl) return;
  const activeBlock = findBlockAtPos(view, view.state.selection.$anchor);
  if (!activeBlock) {
    handleEl.dataset.show = 'false';
    state.lastActivePos = null;
    return;
  }
  if (state.lastActivePos === activeBlock.$pos.pos) return;
  state.lastActivePos = activeBlock.$pos.pos;
  positionHandle(handleEl, activeBlock, view.dom);
}

/** Build the ProseMirror PluginView for the gutter. */
function buildView(state: GutterState) {
  return (view: EditorView) => {
    state.editorView = view;
    const { gutter, handle } = createGutterElements();
    state.gutterEl = gutter;
    state.handleEl = handle;
    appendToMilkdown(view, gutter);
    handle.addEventListener('dragstart', (e) => handleDragStart(state, e));
    requestAnimationFrame(() => updateFromSelection(state, view));
    return {
      update: (v: EditorView) => updateFromSelection(state, v),
      destroy: () => {
        state.handleEl?.remove();
        state.gutterEl?.remove();
        state.handleEl = null;
        state.gutterEl = null;
        state.lastActivePos = null;
        state.editorView = null;
      },
    };
  };
}

/**
 * Creates a ProseMirror plugin that renders a draggable six-dot handle
 * in a left gutter, tracking the active block via selection changes.
 */
export function createBlockGutterPlugin(): Plugin {
  const state: GutterState = { handleEl: null, gutterEl: null, lastActivePos: null, editorView: null };

  return new Plugin({
    key: blockGutterKey,
    state: {
      init: () => null,
      apply: (tr, prev) => (tr.selection && !tr.selection.eq(tr.before) ? tr.selection : prev),
    },
    view: buildView(state),
    props: {
      handleDOMEvents: {
        pointermove: (view, event) => handlePointerMove(state, view, event),
      },
    },
  });
}
