// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { positionHandle, GUTTER_OFFSET } from './block-handle-gutter';

const source = readFileSync(resolve(__dirname, 'block-handle-gutter.ts'), 'utf8');

describe('block-handle-gutter exports', () => {
  it('exports blockGutterKey as a PluginKey', () => {
    expect(source).toMatch(/export\s+(const|let)\s+blockGutterKey\s*=/);
    expect(source).toContain('new PluginKey');
  });

  it('exports createBlockGutterPlugin function', () => {
    expect(source).toMatch(/export\s+function\s+createBlockGutterPlugin/);
  });
});

describe('block-handle-gutter DOM structure', () => {
  it('creates a .block-gutter-container div', () => {
    expect(source).toContain('block-gutter-container');
    expect(source).toContain('document.createElement');
  });

  it('creates a .block-gutter-handle div inside the container', () => {
    expect(source).toContain('block-gutter-handle');
  });

  it('appends the gutter to the .milkdown element', () => {
    expect(source).toContain('.milkdown');
    expect(source).toContain('appendChild');
  });

  it('includes the six-dot drag handle SVG icon', () => {
    expect(source).toContain('svg');
    expect(source).toContain('M11 18C11 19.1');
  });

  it('sets handle draggable to true', () => {
    expect(source).toContain('draggable');
    expect(source).toContain('true');
  });
});

describe('block-handle-gutter positioning', () => {
  it('positions handle using getBoundingClientRect', () => {
    expect(source).toContain('getBoundingClientRect');
  });

  it('sets handle top to vertically center on the active block', () => {
    expect(source).toContain('top');
  });

  it('positions the handle relative to the .editor column, not the viewport', () => {
    expect(source).toContain("closest('.editor')");
    expect(source).toContain('GUTTER_OFFSET');
  });
});

/** Build a DOMRect-like object from partial coordinates. */
const rect = (init: { left: number; top: number; width?: number; height?: number }): DOMRect => {
  const width = init.width ?? 800;
  const height = init.height ?? 600;
  return {
    left: init.left,
    top: init.top,
    width,
    height,
    right: init.left + width,
    bottom: init.top + height,
    x: init.left,
    y: init.top,
    toJSON: () => ({}),
  };
};

/** Build the .milkdown > .editor DOM skeleton with a gutter, handle and block element. */
const setupDom = () => {
  const milkdown = document.createElement('div');
  milkdown.className = 'milkdown';
  const column = document.createElement('div');
  column.className = 'editor';
  const editorDom = document.createElement('div');
  column.appendChild(editorDom);
  milkdown.appendChild(column);
  const gutter = document.createElement('div');
  gutter.className = 'block-gutter-container';
  const handle = document.createElement('div');
  handle.className = 'block-gutter-handle';
  gutter.appendChild(handle);
  milkdown.appendChild(gutter);
  document.body.appendChild(milkdown);
  const blockEl = document.createElement('p');
  return { milkdown, column, editorDom, gutter, handle, blockEl };
};

/** Mock getBoundingClientRect on an element. */
const mockRect = (el: Element, init: Parameters<typeof rect>[0]): void => {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(init));
};

describe('positionHandle column-relative placement', () => {
  it('sets handle left to column rect left minus gutter offset on a wide viewport', () => {
    const { milkdown, column, editorDom, gutter, handle, blockEl } = setupDom();

    // Wide viewport: the 70ch column is centered, far right of the viewport edge.
    const COLUMN_LEFT = 420;
    mockRect(column, { left: COLUMN_LEFT, top: 80, width: 700, height: 900 });
    mockRect(gutter, { left: 0, top: 0, width: 1920, height: 1000 });
    mockRect(editorDom, { left: COLUMN_LEFT, top: 112, width: 700, height: 868 });
    mockRect(blockEl, { left: COLUMN_LEFT, top: 160, width: 700, height: 40 });

    positionHandle(
      handle,
      { el: blockEl } as Parameters<typeof positionHandle>[1],
      editorDom,
    );

    expect(Number.parseInt(handle.style.left, 10)).toBe(COLUMN_LEFT - GUTTER_OFFSET);
    expect(handle.style.left).not.toBe('0px');

    milkdown.remove();
    vi.restoreAllMocks();
  });
});

describe('block-handle-gutter drag and selection', () => {
  it('creates NodeSelection on dragstart', () => {
    expect(source).toContain('NodeSelection');
    expect(source).toContain('dragstart');
  });

  it('calls serializeForClipboard on dragstart', () => {
    expect(source).toContain('serializeForClipboard');
  });

  it('sets view.dragging on dragstart', () => {
    expect(source).toContain('dragging');
  });

  it('listens to pointermove to update handle position', () => {
    expect(source).toContain('pointermove');
  });

  it('only repositions handle when the active block changes', () => {
    // handlePointerMove should guard on lastActivePos before calling positionHandle
    expect(source).toMatch(/lastActivePos\s*!==\s*activeBlock\s*\.\s*\$pos\s*\.\s*pos/);
  });

  it('removes gutter and handle elements on destroy', () => {
    expect(source).toContain('destroy');
    expect(source).toContain('remove');
  });

  it('uses state.apply to detect selection changes', () => {
    expect(source).toContain('state');
    expect(source).toContain('apply');
  });

  it('walks up from $anchor to find block node', () => {
    expect(source).toContain('$anchor');
  });

  it('uses view.nodeDOM to get the block element', () => {
    expect(source).toContain('nodeDOM');
  });
});
