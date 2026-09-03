import type { Node } from '@milkdown/kit/prose/model';
import { ParserState, SerializerState } from '@milkdown/kit/transformer';
import { buildManuscriptSchema } from './manuscript-schema.js';
import { createManuscriptRemark } from './manuscript-remark.js';
import { ensureSectionIds } from './identity.js';

const remark = createManuscriptRemark();
const parserSchema = buildManuscriptSchema();
const parseSync = ParserState.create(parserSchema, remark);

/** References trailer appended to the assembly by serializeManuscript. */
export const REFS_TRAILER = '# References\n\n::: {#refs}\n:::';

/** Block file path for a slug. */
function blockPath(slug: string): string {
  return `blocks/${slug}.qmd`;
}

/** Strip the refs trailer from an assembly string. */
function stripRefsTrailer(assembly: string): string {
  const trimmed = assembly.trimEnd();
  if (trimmed.endsWith(REFS_TRAILER)) {
    return trimmed.slice(0, trimmed.length - REFS_TRAILER.length).trimEnd();
  }
  return trimmed;
}

/** Serialize a single section into its block markdown. */
function serializeSection(section: Node): string {
  const schema = section.type.schema;
  const container = schema.nodes.doc.create(undefined, [section]);
  return SerializerState.create(schema, remark)(container).trim();
}

/** True when no section already carries the built-in references id. */
function hasReferencesSection(doc: Node): boolean {
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name === 'section' && child.attrs.id === 'references') return true;
  }
  return false;
}

/**
 * Build a manuscript doc from expanded markdown, normalizing section ids.
 *
 * @param markdown - Expanded manuscript markdown (sections, literals).
 * @returns A manuscript doc with unique section ids.
 */
export function createManuscriptDoc(markdown: string): Node {
  return ensureSectionIds(parseSync(markdown));
}

export interface SerializedManuscript {
  /** Authored assembly: include shortcodes, glue and the refs trailer. */
  assembly: string;
  /** Per-slug block markdown (includes draft sections). */
  blocks: Map<string, string>;
}

/**
 * Split a manuscript doc into block files and an include assembly.
 * Draft sections land in `blocks` only; the assembly references every
 * non-draft section plus any standalone include markers and glue.
 *
 * @param doc - The manuscript document (ids are normalized first).
 * @returns The assembly string and block map keyed by slug.
 */
export function serializeManuscript(doc: Node): SerializedManuscript {
  const normalized = ensureSectionIds(doc);
  const blocks = new Map<string, string>();
  const parts: string[] = [];

  for (let i = 0; i < normalized.childCount; i += 1) {
    const child = normalized.child(i);
    if (child.type.name === 'section') {
      const slug = String(child.attrs.id);
      blocks.set(slug, serializeSection(child));
      if (!child.attrs.draft) parts.push(`{{< include ${blockPath(slug)} >}}`);
    } else if (child.type.name === 'include') {
      parts.push(`{{< include ${String(child.attrs.path)} >}}`);
    } else if (child.type.name === 'glue' || child.type.name === 'quartoBlock') {
      const value = String(child.attrs.value).trimEnd();
      if (value.length > 0) parts.push(value);
    }
  }

  const body = parts.join('\n\n');
  const refs = hasReferencesSection(normalized) ? '' : `${REFS_TRAILER}\n`;
  return { assembly: body.length > 0 ? `${body}\n\n${refs}`.trimEnd() : refs, blocks };
}

export interface ManuscriptInput {
  /** Authored assembly markdown (front matter and refs handled elsewhere). */
  assembly: string;
  /** Block contents keyed by slug. */
  blockFiles: Record<string, string>;
}

export interface ParsedManuscript {
  /** Rebuilt manuscript document. */
  doc: Node;
  /** Warnings for includes without a block file. */
  warnings: string[];
}

/**
 * Rebuild a manuscript doc from the assembly and block files.
 * Include markers are replaced by the sections parsed from their block
 * files; block files not referenced by any include become flagged draft
 * sections appended at the end. Includes without a file become literal
 * marker nodes and raise a warning.
 *
 * @param input - The assembly and block file map.
 * @returns The rebuilt document and any warnings.
 */
export function parseManuscript({ assembly, blockFiles }: ManuscriptInput): ParsedManuscript {
  const warnings: string[] = [];
  const content: Node[] = [];
  const used = new Set<string>();

  const assemblyDoc = parseSync(stripRefsTrailer(assembly) || '');
  for (let i = 0; i < assemblyDoc.childCount; i += 1) {
    const child = assemblyDoc.child(i);
    if (child.type.name === 'include') {
      const path = String(child.attrs.path);
      const slug = path.replace(/^blocks\//, '').replace(/\.qmd$/, '');
      const file = blockFiles[slug];
      if (file !== undefined) {
        used.add(slug);
        pushSections(content, parseBlock(file));
      } else {
        warnings.push(`missing block file: ${path}`);
        const marker = parserSchema.nodes.quartoBlock.create({ value: `{{< include ${path} >}}` });
        content.push(marker);
      }
    } else {
      content.push(child);
    }
  }

  for (const slug of Object.keys(blockFiles)) {
    if (used.has(slug)) continue;
    const file = blockFiles[slug];
    const sections = parseBlock(file);
    for (const section of sections) {
      content.push(markDraft(section, slug));
    }
  }

  const doc = parserSchema.nodes.doc.create(undefined, content);
  return { doc, warnings };
}

/** Parse a block file into its top-level section nodes. */
function parseBlock(markdown: string): Node[] {
  const doc = parseSync(markdown);
  const sections: Node[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name === 'section') sections.push(child);
  }
  return sections;
}

/** Push parsed nodes into the doc content, keeping sections only. */
function pushSections(content: Node[], nodes: Node[]): void {
  for (const node of nodes) {
    if (node.type.name === 'section') content.push(node);
  }
}

/** Flag a section as draft with the given slug id. */
function markDraft(section: Node, slug: string): Node {
  return section.type.create({ ...section.attrs, id: slug, draft: true }, section.content, section.marks);
}