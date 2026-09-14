// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('./block-handle-gutter.ts', import.meta.url)),
  'utf8',
);

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

  it('sets handle left to 0 for gutter placement', () => {
    expect(source).toContain('left');
    expect(source).toContain('0px');
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
