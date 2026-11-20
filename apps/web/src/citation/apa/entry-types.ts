import { cleanLatex } from './latex';
import { parseName, splitNames } from './names';

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

/** Convert a name's given names to initials, preserving hyphens. */
function nameInitials(given: string | undefined): string {
  if (!given) return '';
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split('-')
        .map((part) => (part ? `${part.charAt(0).toUpperCase()}.` : ''))
        .filter(Boolean)
        .join('-'),
    )
    .join(' ');
}

/** Render one raw editor name as initials followed by the family name. */
function formatEditor(raw: string): string {
  const name = parseName(raw);
  if (name.literal) return name.literal;
  const initials = nameInitials(name.given);
  const family = [name.particle, name.family].filter(Boolean).join(' ');
  return [initials, family].filter(Boolean).join(' ');
}

/** Render the editor clause with the correct singular or plural label. */
function formatEditors(raw: string | undefined): string {
  const names = raw?.trim()
    ? splitNames(raw).map(formatEditor).filter((name) => name !== '')
    : [];
  if (names.length === 0) return '';
  const label = names.length === 1 ? 'Ed.' : 'Eds.';
  const joined =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} & ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  return `${escapeMarkdown(joined)} (${label}), `;
}

/** Render a chapter or proceedings paper with its book container. */
function formatInCollection(
  fields: Readonly<Record<string, string>>,
  title: string,
): EntryParts {
  const editors = formatEditors(fields.editor);
  const booktitle = fields.booktitle?.trim();
  const pages = formatPages(fields.pages);
  const publisher = fields.publisher?.trim();

  const segments: string[] = [];
  if (booktitle) {
    const pageSuffix = pages ? ` (pp. ${escapeMarkdown(pages)})` : '';
    segments.push(
      `In ${editors}*${escapeMarkdown(cleanLatex(booktitle))}*${pageSuffix}.`,
    );
  } else if (editors) {
    segments.push(`In ${editors.replace(/, $/, '')}.`);
  }
  if (publisher) segments.push(`${escapeMarkdown(cleanLatex(publisher))}.`);

  return {
    title: title ? `${title}.` : '',
    rest: segments.join(' '),
  };
}

/** Render a thesis with its bracketed degree description. */
function thesisFormatter(label: string): EntryFormatter {
  return (fields, title) => {
    const school = fields.school?.trim();
    const degree = school
      ? `${label}, ${escapeMarkdown(cleanLatex(school))}`
      : label;
    return {
      title: title ? `*${title}* [${degree}].` : '',
      rest: '',
    };
  };
}

/** Render a technical report with an optional report number. */
function formatTechReport(
  fields: Readonly<Record<string, string>>,
  title: string,
): EntryParts {
  const number = fields.number?.trim();
  const institution = fields.institution?.trim();
  const numberSuffix = number
    ? ` (Report No. ${escapeMarkdown(cleanLatex(number))})`
    : '';

  return {
    title: title ? `*${title}*${numberSuffix}.` : '',
    rest: institution ? `${escapeMarkdown(cleanLatex(institution))}.` : '',
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
  incollection: formatInCollection,
  inbook: formatInCollection,
  inproceedings: formatInCollection,
  conference: formatInCollection,
  phdthesis: thesisFormatter('Doctoral dissertation'),
  mastersthesis: thesisFormatter("Master's thesis"),
  techreport: formatTechReport,
};
