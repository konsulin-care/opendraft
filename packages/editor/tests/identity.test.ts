import { beforeEach, describe, expect, it } from 'vitest';
import { ParserState, SerializerState } from '@milkdown/kit/transformer';
import { buildManuscriptSchema } from '../src/milkdown/manuscript-schema.js';
import { createManuscriptRemark } from '../src/milkdown/manuscript-remark.js';
import {
  collectSectionIds,
  ensureSectionIds,
  renameBlock,
} from '../src/milkdown/identity.js';

/**
 * Block identity: sections carry attrs.id, seeded from `{#slug}` heading
 * suffixes, auto-assigned on creation, unique on rename.
 */
const schema = buildManuscriptSchema();
const remark = createManuscriptRemark();
const parse = ParserState.create(schema, remark);
const serialize = SerializerState.create(schema, remark);

let seq = 0;
function fakeId(): string {
  seq += 1;
  return `uid-${seq}`;
}

beforeEach(() => {
  seq = 0;
});

describe('block identity and slug management', () => {
  it('keeps ids stable across parse->serialize->parse via heading suffixes', () => {
    const doc = parse('# Intro {#intro}\n\npara\n\n# Methods {#methods}');
    expect(collectSectionIds(doc)).toEqual(['intro', 'methods']);

    const roundTripped = parse(serialize(doc));
    expect(collectSectionIds(roundTripped)).toEqual(['intro', 'methods']);
  });

  it('auto-assigns ids to id-less sections and keeps them stable', () => {
    const doc = ensureSectionIds(parse('# Intro\n\npara\n\n# Methods'), fakeId);
    expect(collectSectionIds(doc)).toEqual(['uid-1', 'uid-2']);

    const roundTripped = parse(serialize(doc));
    expect(collectSectionIds(roundTripped)).toEqual(['uid-1', 'uid-2']);
  });

  it('assigns fresh uids to new id-less sections without touching existing ids', () => {
    const doc = ensureSectionIds(parse('# Intro\n\npara\n\n# New'), fakeId);
    expect(collectSectionIds(doc)).toEqual(['uid-1', 'uid-2']);
  });

  it('renameBlock renames a section and keeps its heading id in sync', () => {
    const doc = ensureSectionIds(parse('# Intro\n\npara'), fakeId);
    const result = renameBlock(doc, 'uid-1', 'introduction');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(collectSectionIds(result.doc)).toEqual(['introduction']);
    expect(result.doc.firstChild?.firstChild?.attrs.id).toBe('introduction');
  });

  it('renameBlock rejects a slug colliding with another section', () => {
    const doc = ensureSectionIds(parse('# Intro\n\npara\n\n# Methods'), fakeId);
    const result = renameBlock(doc, 'uid-2', 'uid-1');
    expect(result.ok).toBe(false);
  });

  it('renameBlock rejects malformed slugs', () => {
    const doc = ensureSectionIds(parse('# Intro\n\npara'), fakeId);
    expect(renameBlock(doc, 'uid-1', 'Bad Slug!').ok).toBe(false);
  });
});