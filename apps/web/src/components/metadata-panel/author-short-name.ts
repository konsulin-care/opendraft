/**
 * Vancouver-style short author names for the collapsed metadata bar.
 *
 * The expanded panel keeps full names; the pinned bar uses family name
 * plus dotted given-name initials ("Lamuri A.", "Putri M. S.").
 */
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Coerce a parsed YAML value to a plain record. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Dotted initials of one given-name word; hyphens stay inside the token. */
function wordInitials(word: string): string {
  // "Jean-Paul" -> ["Jean", "Paul"] -> "J.-P."
  return word
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join('-');
}

/** Space separated dotted initials for all given-name words. */
function givenInitials(given: string): string {
  return given
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(wordInitials)
    .join(' ');
}

/** Join the non-empty name parts of a short name with single spaces. */
function joinParts(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
}

/**
 * Derive a Vancouver-style short name: family name then dotted initials.
 *
 * Structured names keep the particle in front of the family name and the
 * suffix after the initials; literal group names are returned unchanged.
 * A plain string name splits on whitespace with the last word as family.
 *
 * @param author - Author entry from _author.yml.
 * @returns The short name, or '' when no name is present.
 */
export function authorShortName(author: MetadataAuthor): string {
  const name = author.name;
  if (typeof name === 'string') {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    const family = words[words.length - 1];
    const initials = givenInitials(words.slice(0, -1).join(' '));
    return joinParts([family, initials]);
  }

  const record = asRecord(name);
  if (typeof record.literal === 'string') return record.literal;

  const given = typeof record.given === 'string' ? record.given : '';
  const family = typeof record.family === 'string' ? record.family : '';
  const particle = typeof record.particle === 'string' ? record.particle : '';
  const suffix = typeof record.suffix === 'string' ? record.suffix : '';
  if (!family && !given && !particle) return '';

  const familyPart = joinParts([particle, family]);
  const initials = givenInitials(given);
  return joinParts([familyPart, initials, suffix]);
}
