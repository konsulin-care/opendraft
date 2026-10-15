// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { Editor, editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { replaceAll } from '@milkdown/kit/utils';
import type { Node } from '@milkdown/kit/prose/model';
import {
  CARET_SENTINEL,
  visualSelectionToSourceOffset,
  sourceOffsetToVisualPosition,
} from './caret-sync';

const SAMPLE = '# Heading\n\nSome *emphasized* text.\n\n- item one\n\n```js\ncode\n```\n';

let editor: Editor;
let doc: Node;
let cleanMarkdown: string;
let serialize: (doc: Node) => string;
let parse: (markdown: string) => Node | null;

/** ProseMirror caret position `within` characters into the first text node containing needle. */
function findTextPos(needle: string, within: number): number {
  let result = -1;
  doc.descendants((node, pos) => {
    if (result >= 0) return false;
    if (node.isText && node.text?.includes(needle)) {
      result = pos + within;
      return false;
    }
    return true;
  });
  return result;
}

beforeAll(async () => {
  editor = await Editor.make().use(commonmark).create();
  editor.action(replaceAll(SAMPLE));
  editor.action((ctx) => {
    serialize = (docNode: Node) => ctx.get(serializerCtx)(docNode);
    parse = (markdown: string) => ctx.get(parserCtx)(markdown);
    doc = ctx.get(editorViewCtx).state.doc;
  });
  cleanMarkdown = serialize(doc);
});

describe('visualSelectionToSourceOffset', () => {
  it('maps a caret in a heading to its markdown offset', () => {
    const pos = findTextPos('Head', 4);
    const offset = visualSelectionToSourceOffset({ doc, pos, serialize });
    expect(cleanMarkdown.slice(0, offset)).toBe(cleanMarkdown.slice(0, cleanMarkdown.indexOf('Head') + 4));
  });

  it('maps a caret in emphasis to its markdown offset', () => {
    const pos = findTextPos('emphasized', 4);
    const offset = visualSelectionToSourceOffset({ doc, pos, serialize });
    expect(cleanMarkdown.slice(0, offset)).toBe(cleanMarkdown.slice(0, cleanMarkdown.indexOf('emphasized') + 4));
  });

  it('maps a caret in a list item to its markdown offset', () => {
    const pos = findTextPos('item one', 6);
    const offset = visualSelectionToSourceOffset({ doc, pos, serialize });
    expect(cleanMarkdown.slice(0, offset)).toBe(cleanMarkdown.slice(0, cleanMarkdown.indexOf('item one') + 6));
  });

  it('maps a caret in a code block to its markdown offset', () => {
    const pos = findTextPos('code', 2);
    const offset = visualSelectionToSourceOffset({ doc, pos, serialize });
    expect(cleanMarkdown.slice(0, offset)).toBe(cleanMarkdown.slice(0, cleanMarkdown.indexOf('code') + 2));
  });

  it('falls back to document start when the sentinel is lost', () => {
    const pos = findTextPos('Head', 4);
    const offset = visualSelectionToSourceOffset({
      doc,
      pos,
      serialize: (docNode) => serialize(docNode).replaceAll(CARET_SENTINEL, ''),
    });
    expect(offset).toBe(0);
  });
});

describe('sourceOffsetToVisualPosition', () => {
  it('maps a source offset back to a ProseMirror position with matching text', () => {
    const offset = cleanMarkdown.indexOf('emphasized') + 4;
    const result = sourceOffsetToVisualPosition({ markdown: cleanMarkdown, offset, parse });
    expect(result.found).toBe(true);
    expect(result.doc).not.toBeNull();
    expect(result.doc!.toString()).not.toContain(CARET_SENTINEL);
    expect(result.doc!.textBetween(result.pos - 4, result.pos)).toBe('emph');
    expect(result.doc!.textBetween(result.pos, result.pos + 5)).toBe('asize');
  });

  it('maps an offset in a code block back to a position inside the code text', () => {
    const offset = cleanMarkdown.indexOf('code') + 2;
    const result = sourceOffsetToVisualPosition({ markdown: cleanMarkdown, offset, parse });
    expect(result.found).toBe(true);
    expect(result.doc!.textBetween(result.pos - 2, result.pos + 2)).toBe('co' + 'de');
  });

  it('falls back to document start when the sentinel is lost', () => {
    const offset = cleanMarkdown.indexOf('emphasized') + 4;
    const result = sourceOffsetToVisualPosition({
      markdown: cleanMarkdown,
      offset,
      parse: (markdown) => parse(markdown.replaceAll(CARET_SENTINEL, '')),
    });
    expect(result.found).toBe(false);
    expect(result.pos).toBe(0);
  });
});
