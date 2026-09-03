import type { Node } from '@milkdown/kit/prose/model';

/** Filesystem-safe slug pattern for block ids. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const SECTION_ID_ATTR = 'id';

/**
 * Generate a fresh block id (short uuid, lowercase).
 *
 * @returns A random id matching the slug pattern.
 */
export function generateBlockId(): string {
  return crypto.randomUUID().slice(0, 12);
}

/**
 * Collect the ids of all top-level sections, in document order.
 *
 * @param doc - The manuscript document.
 * @returns Array of section ids.
 */
export function collectSectionIds(doc: Node): string[] {
  const ids: string[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name === 'section') {
      ids.push(String(child.attrs[SECTION_ID_ATTR] ?? ''));
    }
  }
  return ids;
}

/**
 * Return a new document where every section carries a unique, valid id.
 * Existing valid ids are preserved; missing or duplicate ids are replaced.
 * Section ids are mirrored onto the section's heading so serialization
 * emits `{#slug}` suffixes.
 *
 * @param doc - The manuscript document.
 * @param generateId - Id generator (defaults to generateBlockId).
 * @returns A new document with normalized section ids.
 */
export function ensureSectionIds(doc: Node, generateId: () => string = generateBlockId): Node {
  const used = new Set<string>();
  const content: Node[] = [];

  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name !== 'section') {
      content.push(child);
      continue;
    }

    let id = String(child.attrs[SECTION_ID_ATTR] ?? '');
    if (!SLUG_RE.test(id) || used.has(id)) {
      do {
        id = generateId();
      } while (used.has(id));
    }
    used.add(id);

    const heading = child.firstChild;
    const syncedHeading =
      heading && heading.type.name === 'heading'
        ? heading.type.create({ ...heading.attrs, id }, heading.content, heading.marks)
        : heading;
    const section = child.type.create(
      { ...child.attrs, id },
      syncedHeading ? child.content.replaceChild(0, syncedHeading) : child.content,
      child.marks,
    );
    content.push(section);
  }

  return doc.type.create(doc.attrs, content, doc.marks);
}

export type RenameResult = { ok: true; doc: Node } | { ok: false; error: string };

/**
 * Rename a section block, enforcing uniqueness against all other ids.
 *
 * @param doc - The manuscript document.
 * @param id - The current section id.
 * @param newSlug - The desired slug.
 * @returns A new document with the renamed section, or an error result.
 */
export function renameBlock(doc: Node, id: string, newSlug: string): RenameResult {
  if (!SLUG_RE.test(newSlug)) {
    return { ok: false, error: `invalid slug: ${newSlug}` };
  }

  let found = false;
  let collision = false;
  const content: Node[] = [];

  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name !== 'section') {
      content.push(child);
      continue;
    }

    const current = String(child.attrs[SECTION_ID_ATTR] ?? '');
    if (current === newSlug && current !== id) collision = true;
    if (current === id) found = true;
    content.push(child);
  }

  if (!found) return { ok: false, error: `section not found: ${id}` };
  if (collision) return { ok: false, error: `duplicate slug: ${newSlug}` };

  const updated = content.map((child) => {
    if (child.type.name !== 'section') return child;
    if (String(child.attrs[SECTION_ID_ATTR]) !== id) return child;

    const heading = child.firstChild;
    const syncedHeading =
      heading && heading.type.name === 'heading'
        ? heading.type.create({ ...heading.attrs, id: newSlug }, heading.content, heading.marks)
        : heading;
    return child.type.create(
      { ...child.attrs, id: newSlug },
      syncedHeading ? child.content.replaceChild(0, syncedHeading) : child.content,
      child.marks,
    );
  });

  return { ok: true, doc: doc.type.create(doc.attrs, updated, doc.marks) };
}