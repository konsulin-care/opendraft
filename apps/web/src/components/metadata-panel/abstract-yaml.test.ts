import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { setAbstractLiteral } from './abstract-yaml';

/**
 * Parse the serialized document and read the abstract value back.
 *
 * @param text - YAML text produced by {@link setAbstractLiteral}.
 * @returns The parsed abstract value.
 */
function readAbstract(text: string): unknown {
  return parseDocument(text).toJS() as { abstract?: unknown };
}

describe('setAbstractLiteral', () => {
  it('writes an indented literal block with blank lines between paragraphs', () => {
    const doc = parseDocument('');
    setAbstractLiteral(doc, 'First paragraph.\n\nSecond paragraph.');
    expect(doc.toString()).toBe(
      'abstract: |\n  First paragraph.\n\n  Second paragraph.\n',
    );
  });

  it('keep quotes unescaped and round-trip to the same text plus a newline', () => {
    const doc = parseDocument('');
    setAbstractLiteral(doc, 'He said "hello".');
    const text = doc.toString();
    expect(text).toBe('abstract: |\n  He said "hello".\n');
    const parsed = readAbstract(text) as { abstract?: string };
    expect(parsed.abstract).toBe('He said "hello".\n');
  });

  it('writes an empty string for an empty abstract', () => {
    const doc = parseDocument('abstract: Old\n');
    setAbstractLiteral(doc, '');
    expect(doc.toString()).toBe('abstract: ""\n');
  });

  it('writes an empty string for a whitespace-only abstract', () => {
    const doc = parseDocument('abstract: Old\n');
    setAbstractLiteral(doc, '   \n\n  ');
    expect(doc.toString()).toBe('abstract: ""\n');
  });

  it('keeps a multiline paragraph without blank lines intact', () => {
    const doc = parseDocument('');
    setAbstractLiteral(doc, 'One line\nstill same paragraph.\n\nNext para.\n\n');
    expect(doc.toString()).toBe(
      'abstract: |\n  One line\n  still same paragraph.\n\n  Next para.\n',
    );
  });
});
