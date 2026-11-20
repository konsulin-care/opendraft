/** Characters that carry meaning in markdown and must be escaped in text. */
const MARKDOWN_SPECIAL = /[\\*_[\]`~^<>]/g;

/**
 * Escape markdown-significant characters in a field-derived string.
 *
 * @param raw - Raw display text.
 * @returns Text safe for inline markdown rendering.
 */
export function escapeMarkdown(raw: string): string {
  return raw.replace(MARKDOWN_SPECIAL, '\\$&');
}

/** Rendered parts of an entry: the title segment and the remaining fields. */
export interface EntryParts {
  /** Title rendered with type-specific emphasis and punctuation. */
  title: string;
  /** Type-specific fields that follow the title and date. */
  rest: string;
}

/** Formats the type-specific portion of an entry. */
export type EntryFormatter = (
  fields: Readonly<Record<string, string>>,
  title: string,
) => EntryParts;

/** Format page ranges with an en dash. */
function formatPages(pages: string | undefined): string {
  return pages?.trim() ? pages.trim().replace(/-/g, '\u2013') : '';
}

/** Add an ordinal suffix to a purely numeric edition. */
function ordinalEdition(edition: string): string {
  if (!/^\d+$/.test(edition)) return edition;
  const value = Number(edition);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${edition}th`;
  switch (value % 10) {
    case 1:
      return `${edition}st`;
    case 2:
      return `${edition}nd`;
    case 3:
      return `${edition}rd`;
    default:
      return `${edition}th`;
  }
}

/** Render an article: sentence-cased title followed by journal details. */
function formatArticle(
  fields: Readonly<Record<string, string>>,
  title: string,
): EntryParts {
  const segments: string[] = [];
  const journal = fields.journal?.trim();
  const volume = fields.volume?.trim();
  const number = fields.number?.trim();
  const pages = formatPages(fields.pages);

  if (journal) segments.push(`*${escapeMarkdown(journal)}*`);
  if (volume) {
    const vol = `*${escapeMarkdown(volume)}*`;
    segments.push(number ? `${vol}(${escapeMarkdown(number)})` : vol);
  }
  if (pages) segments.push(escapeMarkdown(pages));

  return {
    title: title ? `${title}.` : '',
    rest: segments.length > 0 ? `${segments.join(', ')}.` : '',
  };
}

/** Render a book: italic title, optional edition, then publisher. */
function formatBook(
  fields: Readonly<Record<string, string>>,
  title: string,
): EntryParts {
  const edition = fields.edition?.trim();
  const editionSuffix = edition
    ? ` (${escapeMarkdown(ordinalEdition(edition))} ed.)`
    : '';
  const publisher = fields.publisher?.trim();

  return {
    title: title ? `*${title}*${editionSuffix}.` : '',
    rest: publisher ? `${escapeMarkdown(publisher)}.` : '',
  };
}

/**
 * Formatter map keyed by BibTeX entry type.
 *
 * Unknown entry types fall back to the book formatter.
 */
export const ENTRY_FORMATTERS: Record<string, EntryFormatter> = {
  article: formatArticle,
  book: formatBook,
};
