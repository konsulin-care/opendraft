import type { Reference } from '@opendraft/references';

/**
 * Format a single author name in APA style.
 *
 * @param author - Raw author name string.
 * @returns APA-formatted author name, or empty string.
 */
function formatSingleAuthor(author: string): string {
  const trimmed = author.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    const last = parts[0];
    const initials = parts.slice(1).join(',')
      .split(/\s+/)
      .map((name) => name.charAt(0).toUpperCase() + '.')
      .join(' ');
    return `${last}, ${initials}`;
  }

  const nameParts = trimmed.split(/\s+/);
  if (nameParts.length === 1) return trimmed;

  const last = nameParts[nameParts.length - 1];
  const initials = nameParts.slice(0, -1)
    .map((name) => name.charAt(0).toUpperCase() + '.')
    .join(' ');
  return `${last}, ${initials}`;
}

/**
 * Format authors in APA style.
 *
 * @param author - Raw BibTeX author string.
 * @returns APA-formatted author string.
 */
function formatAuthors(author: string | undefined): string {
  if (!author?.trim()) return '';

  const authors = author.split(' and ').map((a) => a.trim());
  const formatted = authors.map(formatSingleAuthor).filter((a) => a);

  if (formatted.length === 0) return '';
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;

  const last = formatted[formatted.length - 1];
  return `${formatted.slice(0, -1).join(', ')}, & ${last}`;
}

/** Format page numbers with en-dash. */
function formatPages(pages: string | undefined): string {
  return pages?.replace(/-/g, '–') ?? '';
}

/** Format journal/volume/number fields. */
function formatJournalFields(fields: Record<string, string>): string[] {
  const parts: string[] = [];
  if (fields.journal) parts.push(`*${fields.journal}*`);
  if (fields.volume) {
    const vol = `*${fields.volume}*`;
    parts.push(fields.number ? `${vol}(${fields.number})` : vol);
  }
  if (fields.pages) parts.push(formatPages(fields.pages));
  return parts;
}

/** Format book-specific fields. */
function formatBookFields(fields: Record<string, string>): string[] {
  return fields.publisher ? [`${fields.publisher}.`] : [];
}

/** Format proceedings-specific fields. */
function formatProceedingsFields(fields: Record<string, string>): string[] {
  const parts: string[] = [];
  if (fields.booktitle) parts.push(`In *${fields.booktitle}*`);
  if (fields.pages) parts.push(`(pp. ${formatPages(fields.pages)})`);
  if (fields.publisher) parts.push(`${fields.publisher}.`);
  return parts;
}

/** Format thesis-specific fields. */
function formatThesisFields(fields: Record<string, string>): string[] {
  return fields.school ? [`${fields.school}.`] : [];
}

/** Format report-specific fields. */
function formatReportFields(fields: Record<string, string>): string[] {
  return fields.institution ? [`${fields.institution}.`] : [];
}

/** Get URL or DOI string. */
function getUrlOrDoi(fields: Record<string, string>): string {
  if (fields.doi) return `https://doi.org/${fields.doi}`;
  if (fields.url) return fields.url;
  return '';
}

/**
 * Format a Reference in APA 7th edition style.
 *
 * @param ref - Parsed BibTeX reference.
 * @returns APA-formatted citation string.
 */
export function formatAPA(ref: Reference): string {
  const { entryType, fields } = ref;
  const author = formatAuthors(fields.author);
  const year = fields.year;
  const title = fields.title;

  const parts: string[] = [];

  if (author) parts.push(author);
  if (year) parts.push(`(${year})`);
  if (title) {
    const isBookType = ['book', 'online', 'misc'].includes(entryType);
    parts.push(isBookType ? `*${title}*.` : `${title}.`);
  }

  // Entry-type-specific formatting
  const formatByType: Record<string, () => string[]> = {
    article: () => formatJournalFields(fields),
    book: () => formatBookFields(fields),
    inproceedings: () => formatProceedingsFields(fields),
    conference: () => formatProceedingsFields(fields),
    phdthesis: () => formatThesisFields(fields),
    mastersthesis: () => formatThesisFields(fields),
    techreport: () => formatReportFields(fields),
  };
  const formatter = formatByType[entryType];
  parts.push(...(formatter ? formatter() : (fields.publisher ? [`${fields.publisher}.`] : [])));

  const url = getUrlOrDoi(fields);
  if (url) parts.push(url);

  let result = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (result && !result.endsWith('.') && !result.match(/https?:\/\//)) {
    result += '.';
  }

  return result;
}
