import type { Plugin } from 'unified';

/** Characters allowed in a citekey (word chars + special bibTeX chars + @). */
const CITEKEY_CHARS = '[\\w@:.#$%&\\-+?<>~/]';
/** Pattern for an escaped underscore followed by citekey chars. */
const ESCAPED_US = `(?:\\\\_${CITEKEY_CHARS}*)`;
/** Full citekey pattern: citekey chars with optional escaped underscores interspersed. */
const CITEKEY_PATTERN = `${CITEKEY_CHARS}*(?:${ESCAPED_US}*)`;

/**
 * Strip backslash escapes from underscores within citation patterns.
 *
 * remark-stringify escapes _ in phrasing context (e.g. @Naeem_2023 → @Naeem\_2023).
 * This is incorrect for pandoc/quarto citation syntax. This function restores
 * the unescaped form within matched citation patterns.
 *
 * @param text - The escaped markdown string.
 * @returns The string with citation underscores unescaped.
 */
export function stripCitationEscapes(text: string): string {
  let result = text;
  // Match \[@citekey] → [@citekey]
  result = result.replace(
    new RegExp(`\\\\\\[(${CITEKEY_PATTERN})\\]`, 'g'),
    (_m, citekey: string) => `[${citekey.replace(/\\_/g, '_')}]`,
  );
  // Match @citekey → @citekey
  result = result.replace(
    new RegExp(`(?<!\\w)@(${CITEKEY_PATTERN})`, 'g'),
    (m) => m.replace(/\\_/g, '_'),
  );
  return result;
}

/**
 * Remark plugin that prevents citation patterns from being escaped.
 *
 * Wraps the remark-stringify compiler to strip citation escapes from
 * the serialized markdown output.
 *
 * Non-citation underscores (e.g. _emphasis_) are still escaped normally.
 */
export function citationRemarkPlugin(): Plugin {
  return () => {
    // Wrap the compiler set by remark-stringify.
    // The compiler calls toMarkdown(tree, options) which serializes the AST.
    // We intercept the output and strip citation escapes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = this as any;
    const originalCompiler = proc?.compiler;
    if (typeof originalCompiler !== 'function') return;

    proc.compiler = (tree: unknown) => {
      const markdown: string = originalCompiler.call(proc, tree);
      return stripCitationEscapes(markdown);
    };
  };
}
