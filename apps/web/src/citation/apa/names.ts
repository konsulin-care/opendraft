import { cleanLatex } from './latex';

/** A parsed BibTeX person or group name. */
export interface BibName {
  given?: string;
  particle?: string;
  family?: string;
  suffix?: string;
  literal?: string;
}

/** Returns true when the word starts with a lowercase letter. */
function startsLower(word: string): boolean {
  const stripped = word.replace(/^[{\\]/, '');
  const first = stripped.charAt(0);
  return first !== '' && first === first.toLowerCase() && first !== first.toUpperCase();
}

/** Splits text on commas that are not nested inside braces. */
function splitByComma(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (char === '{') depth += 1;
    else if (char === '}') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      parts.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(raw.slice(start).trim());
  return parts;
}

/** Splits text on whitespace that is not nested inside braces. */
function splitWords(raw: string): string[] {
  const words: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of raw) {
    if (char === '{') depth += 1;
    if (char === '}') depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) {
      if (current) words.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) words.push(current);
  return words;
}

/** Returns true when the whole value is one outer brace group. */
function isSingleBraceGroup(raw: string): boolean {
  if (!raw.startsWith('{') || !raw.endsWith('}')) return false;
  let depth = 0;
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '{') depth += 1;
    else if (raw[i] === '}') depth -= 1;
    if (depth === 0 && i < raw.length - 1) return false;
  }
  return depth === 0;
}

/** Splits a "von Last" segment into particle and family. */
function splitVonLast(raw: string): { particle?: string; family?: string } {
  const words = splitWords(raw);
  let index = 0;
  while (index < words.length - 1 && startsLower(words[index])) index += 1;
  const particle = words.slice(0, index).join(' ');
  const family = words.slice(index).join(' ');
  return { particle, family };
}

/** Cleans each present name part with {@link cleanLatex}. */
function buildName(parts: BibName): BibName {
  const cleaned: BibName = {};
  for (const key of ['given', 'particle', 'family', 'suffix', 'literal'] as const) {
    const value = parts[key]?.trim();
    if (value) cleaned[key] = cleanLatex(value);
  }
  return cleaned;
}

/**
 * Split a raw BibTeX author field into individual names.
 *
 * Splits on the word "and" only at brace depth 0, case-insensitively, and only
 * when surrounded by whitespace.
 *
 * @param raw - Raw BibTeX author field.
 * @returns Trimmed raw name strings.
 */
export function splitNames(raw: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (char === '{') depth += 1;
    else if (char === '}') depth = Math.max(0, depth - 1);
    else if (
      depth === 0 &&
      /^and$/i.test(raw.slice(i, i + 3)) &&
      /\s/.test(raw[i - 1] ?? '') &&
      /\s/.test(raw[i + 3] ?? '')
    ) {
      names.push(raw.slice(start, i).trim());
      start = i + 3;
      i += 2;
    }
  }
  const tail = raw.slice(start).trim();
  if (tail || names.length > 0) names.push(tail);
  return names.filter((name) => name !== '');
}

/**
 * Parse a single BibTeX name into its parts.
 *
 * Handles "First von Last", "von Last, First" and "von Last, Jr, First".
 * A value wrapped in one brace group becomes a literal group name.
 *
 * @param raw - Raw BibTeX name string.
 * @returns Parsed name parts.
 */
export function parseName(raw: string): BibName {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (isSingleBraceGroup(trimmed)) {
    return { literal: cleanLatex(trimmed.slice(1, -1)) };
  }

  const commaParts = splitByComma(trimmed);
  if (commaParts.length >= 3) {
    const { particle, family } = splitVonLast(commaParts[0]);
    return buildName({
      given: commaParts.slice(2).join(', '),
      particle,
      family,
      suffix: commaParts[1],
    });
  }
  if (commaParts.length === 2) {
    const { particle, family } = splitVonLast(commaParts[0]);
    return buildName({ given: commaParts[1], particle, family });
  }

  const words = splitWords(trimmed);
  if (words.length === 1) return buildName({ family: words[0] });

  const family = words[words.length - 1];
  const rest = words.slice(0, -1);
  const particleIndex = rest.findIndex((word) => startsLower(word));
  if (particleIndex === -1) {
    return buildName({ given: rest.join(' '), family });
  }
  return buildName({
    given: rest.slice(0, particleIndex).join(' '),
    particle: rest.slice(particleIndex).join(' '),
    family,
  });
}

/** Converts given names to APA initials, preserving hyphens. */
function toInitials(given: string | undefined): string {
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

/**
 * Render a parsed name as an APA reference-list entry.
 *
 * @param name - Parsed BibTeX name.
 * @returns "Family, G. M." form, or the literal for group names.
 */
export function apaName(name: BibName): string {
  if (name.literal) return name.literal;
  const family = [name.particle, name.family].filter(Boolean).join(' ');
  const initials = toInitials(name.given);
  let result = family;
  if (initials) result = result ? `${result}, ${initials}` : initials;
  if (name.suffix) {
    const suffix = /^(jr|sr)$/i.test(name.suffix) ? `${name.suffix}.` : name.suffix;
    result = result ? `${result}, ${suffix}` : suffix;
  }
  return result;
}

/**
 * Format a raw BibTeX author field as an APA author list.
 *
 * @param raw - Raw BibTeX author field.
 * @returns APA-formatted author list.
 */
export function apaAuthorList(raw: string): string {
  const formatted = splitNames(raw)
    .map((name) => apaName(parseName(name)))
    .filter((name) => name !== '');

  if (formatted.length === 0) return '';
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  if (formatted.length <= 20) {
    const last = formatted[formatted.length - 1];
    return `${formatted.slice(0, -1).join(', ')}, & ${last}`;
  }
  const last = formatted[formatted.length - 1];
  return `${formatted.slice(0, 19).join(', ')}, . . . ${last}`;
}

/**
 * Render a parsed name for display in the author dropdown.
 *
 * @param name - Parsed BibTeX name.
 * @returns "Given particle Family" form, or the literal for group names.
 */
export function displayName(name: BibName): string {
  if (name.literal) return name.literal;
  return [name.given, name.particle, name.family].filter(Boolean).join(' ');
}
