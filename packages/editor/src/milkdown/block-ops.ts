import type { Node } from '@milkdown/kit/prose/model';

/** Result of a mutation that changes the document. */
export type BlockOpResult = { ok: true; doc: Node } | { ok: false; error: string };

/** Result of an operation that also creates a new section. */
export type ExtractedBlockResult = { ok: true; doc: Node; newId: string } | { ok: false; error: string };

/** Locate a top-level section by id. */
function findSection(doc: Node, id: string): { index: number; section: Node } | null {
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name === 'section' && child.attrs.id === id) {
      return { index: i, section: child };
    }
  }
  return null;
}

/** Short text of a node, used to derive headings for new sections. */
function headingText(node: Node): string {
  const text = node.textContent.trim().replace(/\s+/g, ' ');
  return text.length > 0 ? text.slice(0, 60) : 'Untitled';
}

/** Create a level-1 heading node with the given title. */
function makeHeading(schema: Node['type']['schema'], title: string): Node {
  const text = schema.text(title);
  return schema.nodes.heading.create({ level: 1 }, [text]);
}

/** Rebuild the document with a replaced section list. */
function withSections(doc: Node, sections: Node[]): Node {
  return doc.type.create(doc.attrs, sections, doc.marks);
}

/**
 * Flag or unflag a section as draft.
 *
 * @param doc - The manuscript document.
 * @param id - Section id to toggle.
 * @param draft - Desired draft flag.
 * @returns A new document, or an error when the section is unknown.
 */
export function setDraft(doc: Node, id: string, draft: boolean): BlockOpResult {
  const found = findSection(doc, id);
  if (!found) return { ok: false, error: `section not found: ${id}` };

  const content: Node[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (i === found.index) {
      content.push(child.type.create({ ...child.attrs, draft }, child.content, child.marks));
    } else {
      content.push(child);
    }
  }
  return { ok: true, doc: withSections(doc, content) };
}

/**
 * Move a section so it appears immediately before a target section.
 *
 * @param doc - The manuscript document.
 * @param id - Section to move.
 * @param targetId - Section it should precede.
 * @returns A new document, or an error when either id is unknown.
 */
export function reorderBlock(doc: Node, id: string, targetId: string): BlockOpResult {
  const source = findSection(doc, id);
  const target = findSection(doc, targetId);
  if (!source) return { ok: false, error: `section not found: ${id}` };
  if (!target) return { ok: false, error: `section not found: ${targetId}` };

  const reordered: Node[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (i === target.index && i !== source.index) reordered.push(doc.child(source.index));
    if (i !== source.index) reordered.push(child);
  }
  if (source.index >= target.index) {
    const idx = reordered.indexOf(doc.child(source.index));
    if (idx >= 0) reordered.splice(idx, 1);
    reordered.splice(reordered.findIndex((n) => n.attrs.id === targetId), 0, doc.child(source.index));
  }
  return { ok: true, doc: withSections(doc, reordered) };
}

/**
 * Split a section at a block index: blocks before the index stay in the
 * original section, blocks from the index onward move to a new section
 * with a headline derived from the first moved block.
 *
 * @param doc - The manuscript document.
 * @param id - Section to split.
 * @param nodeIndex - Block index inside the section (>= 1).
 * @returns A new document (run ensureSectionIds afterwards), or an error.
 */
export function splitSection(doc: Node, id: string, nodeIndex: number): ExtractedBlockResult {
  const found = findSection(doc, id);
  if (!found) return { ok: false, error: `section not found: ${id}` };
  const { section } = found;
  if (nodeIndex < 1 || nodeIndex >= section.childCount) {
    return { ok: false, error: `invalid split index: ${nodeIndex}` };
  }

  const moved: Node[] = [];
  const kept: Node[] = [];
  for (let i = 0; i < section.childCount; i += 1) {
    (i >= nodeIndex ? moved : kept).push(section.child(i));
  }

  const schema = section.type.schema;
  const heading = makeHeading(schema, headingText(moved[0]));
  const newSection = schema.nodes.section.create({}, [heading, ...moved]);

  const content: Node[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    if (i === found.index) {
      content.push(section.type.create(section.attrs, kept, section.marks));
      content.push(newSection);
    } else {
      content.push(doc.child(i));
    }
  }
  return { ok: true, doc: withSections(doc, content), newId: '' };
}

/**
 * Merge the section after `id` into `id` (its heading is dropped).
 *
 * @param doc - The manuscript document.
 * @param id - Section that absorbs its successor.
 * @returns A new document, or an error when there is no successor.
 */
export function mergeSection(doc: Node, id: string): BlockOpResult {
  const found = findSection(doc, id);
  if (!found) return { ok: false, error: `section not found: ${id}` };
  const next = findSection(doc, id) && found.index + 1 < doc.childCount ? doc.child(found.index + 1) : null;
  if (!next || next.type.name !== 'section') {
    return { ok: false, error: `no section after: ${id}` };
  }

  const extra: Node[] = [];
  for (let i = 1; i < next.childCount; i += 1) extra.push(next.child(i));
  const merged = found.section.type.create(found.section.attrs, [...found.section.content.content, ...extra], found.section.marks);

  const content: Node[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    if (i === found.index) content.push(merged);
    else if (i !== found.index + 1) content.push(doc.child(i));
  }
  return { ok: true, doc: withSections(doc, content) };
}

/**
 * Extract a block range from a section into a new section right after it.
 *
 * @param doc - The manuscript document.
 * @param id - Source section.
 * @param start - First block index (inclusive, >= 1).
 * @param end - Exclusive end index.
 * @returns A new document plus the new section id ('' until normalized).
 */
export function extractBlocks(doc: Node, id: string, start: number, end: number): ExtractedBlockResult {
  const found = findSection(doc, id);
  if (!found) return { ok: false, error: `section not found: ${id}` };
  const { section } = found;
  if (start < 1 || start >= end || end > section.childCount) {
    return { ok: false, error: `invalid extract range: ${start}..${end}` };
  }

  const moved: Node[] = [];
  const kept: Node[] = [];
  for (let i = 0; i < section.childCount; i += 1) {
    (i >= start && i < end ? moved : kept).push(section.child(i));
  }

  const schema = section.type.schema;
  const heading = makeHeading(schema, headingText(moved[0]));
  const newSection = schema.nodes.section.create({}, [heading, ...moved]);

  const content: Node[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    if (i === found.index) {
      content.push(section.type.create(section.attrs, kept, section.marks));
      content.push(newSection);
    } else {
      content.push(doc.child(i));
    }
  }
  return { ok: true, doc: withSections(doc, content), newId: '' };
}