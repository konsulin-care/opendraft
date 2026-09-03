/**
 * Legacy-to-block migration: splits flat article.qmd into block-based layout.
 */

import { createHash } from 'node:crypto';
import type { ManifestData } from '@opendraft/schema';

/** Heading pattern: captures level (1-6) and text. */
const HEADING_RE = /^(#{1,6})\s+(.+)$/gm;

/** Generate a slug from content: first 8 chars of SHA-256. */
function contentSlug(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/** Migration output shape. */
export interface MigrationResult {
  manifest: ManifestData;
  blocks: Record<string, string>;
  article: string;
}

interface HeadingMatch {
  level: number;
  text: string;
  index: number;
}

/** Count headings by level and collect matches. */
function parseHeadings(content: string): {
  counts: Record<number, number>;
  matches: HeadingMatch[];
} {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const matches: HeadingMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = HEADING_RE.exec(content)) !== null) {
    const level = match[1].length;
    counts[level]++;
    matches.push({ level, text: match[2].trim(), index: match.index });
  }
  return { counts, matches };
}

/** Find the highest heading level with >= 2 occurrences. */
function findSplitLevel(counts: Record<number, number>): number {
  for (let lvl = 1; lvl <= 6; lvl++) {
    if (counts[lvl] >= 2) return lvl;
  }
  return 0;
}

/** Build a single-block result for content with no usable headings. */
function buildSingleBlock(content: string): MigrationResult {
  const slug = contentSlug(content);
  const file = `${slug}.qmd`;
  const manifest: ManifestData = {
    version: '1.0.0',
    blocks: [{ id: slug, file, title: 'Article' }],
  };
  return { manifest, blocks: { [file]: content }, article: buildArticle(manifest) };
}

/** Build manifest + blocks by splitting content at headings of the chosen level. */
function splitIntoBlocks(
  content: string,
  matches: HeadingMatch[],
  splitLevel: number,
): { manifest: ManifestData; blocks: Record<string, string> } {
  const boundaries = matches.filter((h) => h.level === splitLevel);
  const blocks: Record<string, string> = {};
  const blockEntries: ManifestData['blocks'] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].index;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].index : content.length;
    const blockContent = content.slice(start, end).trimEnd();
    const slug = contentSlug(blockContent);
    const file = `${slug}.qmd`;
    blocks[file] = blockContent;
    blockEntries.push({ id: slug, file, title: boundaries[i].text });
  }

  return { manifest: { version: '1.0.0', blocks: blockEntries }, blocks };
}

/**
 * Migrate a legacy flat article.qmd to block-based layout.
 *
 * Splits by the highest-level heading with >= 2 occurrences (H1 down to H6).
 * Falls back to single block if no headings found.
 * Text before the first block heading is preserved as preamble.
 *
 * @param content - Raw article.qmd content.
 * @returns MigrationResult with manifest, block contents, and new article.qmd.
 */
export function migrateToBlockLayout(content: string): MigrationResult {
  const { counts, matches } = parseHeadings(content);
  const splitLevel = findSplitLevel(counts);

  if (splitLevel === 0) return buildSingleBlock(content);

  const { manifest, blocks } = splitIntoBlocks(content, matches, splitLevel);
  const preamble = content.slice(0, matches.find((h) => h.level === splitLevel)!.index).trimEnd();
  return { manifest, blocks, article: buildArticle(manifest, preamble) };
}

/** Build article.qmd from manifest and optional preamble. */
function buildArticle(manifest: ManifestData, preamble?: string): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('metadata-files:');
  lines.push('  - _author.yml');
  lines.push('  - _abstract.yml');
  lines.push('  - _frontmatter.yml');
  lines.push('---');
  lines.push('');

  if (preamble) {
    lines.push(preamble);
    lines.push('');
  }

  for (const block of manifest.blocks) {
    lines.push(`{{< include blocks/${block.file} >}}`);
    lines.push('');
  }

  lines.push('# References');
  lines.push('');
  lines.push('::: {#refs}');
  lines.push(':::');

  return lines.join('\n');
}
