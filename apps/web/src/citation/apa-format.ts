import type { Reference } from '@opendraft/references';
import { apaAuthorList } from './apa/names';
import { sentenceCase } from './apa/sentence-case';
import { cleanLatex } from './apa/latex';
import {
  ENTRY_FORMATTERS,
  escapeMarkdown,
} from './apa/entry-types';
import type { EntryFormatter } from './apa/entry-types';

/** Strip common DOI prefixes so only the bare DOI remains. */
function stripDoiPrefix(doi: string): string {
  return doi
    .trim()
    .replace(/^(?:doi:\s*|https?:\/\/doi\.org\/)/i, '')
    .trim();
}

/** Get the trailing URL or DOI string, preferring the DOI. */
function getUrlOrDoi(fields: Record<string, string>): string {
  const doi = fields.doi?.trim();
  if (doi) return `https://doi.org/${escapeMarkdown(stripDoiPrefix(doi))}`;
  const url = fields.url?.trim();
  return url ? escapeMarkdown(url) : '';
}

/**
 * Format a Reference in APA 7th edition style as inline markdown.
 *
 * Authors are formatted with the shared name helpers, dates use "(n.d.)" when
 * the year is missing, and entry-type-specific details come from the formatter
 * map. All field-derived text is markdown-escaped before emphasis is applied.
 *
 * @param ref - Parsed BibTeX reference.
 * @returns APA-formatted markdown citation string.
 */
export function formatAPA(ref: Reference): string {
  const { entryType, fields } = ref;
  const rawAuthor = fields.author?.trim() ? apaAuthorList(fields.author) : '';
  const author = rawAuthor ? escapeMarkdown(cleanLatex(rawAuthor)) : '';
  const year = fields.year?.trim();
  const date = year ? `(${escapeMarkdown(cleanLatex(year))}).` : '(n.d.).';
  const rawTitle = fields.title?.trim();
  const title = rawTitle ? escapeMarkdown(sentenceCase(rawTitle)) : '';

  const formatter: EntryFormatter =
    ENTRY_FORMATTERS[entryType] ?? ENTRY_FORMATTERS.book;
  const rendered = formatter(fields, title);

  const parts: string[] = [];
  if (author) {
    parts.push(author.endsWith('.') ? author : `${author}.`);
    parts.push(date);
    parts.push(rendered.title);
  } else {
    parts.push(rendered.title);
    parts.push(date);
  }
  parts.push(rendered.rest);

  const url = getUrlOrDoi(fields);
  parts.push(url);

  let result = parts.filter((part) => part !== '').join(' ');
  result = result.replace(/\s+/g, ' ').trim();
  if (result && !result.endsWith('.') && !url) {
    result += '.';
  }
  return result;
}
