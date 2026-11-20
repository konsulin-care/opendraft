/** Combining marks used by LaTeX accent commands. */
const ACCENT_MARKS: Record<string, string> = {
  '"': '\u0308',
  "'": '\u0301',
  '`': '\u0300',
  '^': '\u0302',
  '~': '\u0303',
  c: '\u0327',
  v: '\u030c',
  u: '\u0306',
  H: '\u030b',
  '=': '\u0304',
  '.': '\u0307',
};

/** LaTeX commands that represent standalone letters rather than accents. */
const SPECIAL_LETTERS: Record<string, string> = {
  ss: 'ß',
  aa: 'å',
  AA: 'Å',
  ae: 'æ',
  AE: 'Æ',
  oe: 'œ',
  OE: 'Œ',
  o: 'ø',
  O: 'Ø',
  l: 'ł',
  L: 'Ł',
  i: 'ı',
  j: 'ȷ',
};

const ACCENT_COMMANDS = '["\'`^~=.]|c|v|u|H';
const SPECIAL_COMMAND_NAMES = Object.keys(SPECIAL_LETTERS).sort(
  (a, b) => b.length - a.length,
).join('|');

/**
 * Replace braced and bare LaTeX accent commands with precomposed characters.
 *
 * @param input - Raw LaTeX text.
 * @returns Text with accent commands converted.
 */
function convertAccents(input: string): string {
  const applyAccent = (_match: string, accent: string, char: string): string =>
    `${char}${ACCENT_MARKS[accent]}`;

  let text = input.replace(
    new RegExp(`\\{\\\\(${ACCENT_COMMANDS})\\s*\\{?([A-Za-z])\\}?\\}`, 'g'),
    applyAccent,
  );
  text = text.replace(
    new RegExp(`\\\\(${ACCENT_COMMANDS})\\s*\\{?([A-Za-z])\\}?`, 'g'),
    applyAccent,
  );
  return text;
}

/**
 * Replace LaTeX commands for standalone special letters.
 *
 * @param input - Raw LaTeX text.
 * @returns Text with special letter commands converted.
 */
function convertSpecialLetters(input: string): string {
  return input.replace(
    new RegExp(
      `\\{?\\\\(${SPECIAL_COMMAND_NAMES})(?:\\}|(?![A-Za-z]))`,
      'g',
    ),
    (_match: string, command: string) => SPECIAL_LETTERS[command],
  );
}

/**
 * Clean a raw BibTeX field value for display.
 *
 * Converts accents and special characters, unescapes reserved characters,
 * normalises dashes and ties, strips protective braces and collapses
 * whitespace.
 *
 * @param raw - Raw BibTeX field value.
 * @returns Clean, display-ready text.
 */
export function cleanLatex(raw: string): string {
  let text = convertAccents(raw);
  text = convertSpecialLetters(text);
  text = text.normalize('NFC');
  text = text.replace(/\\([&%_$#])/g, '$1');
  text = text.replace(/---/g, '\u2014').replace(/--/g, '\u2013');
  text = text.replace(/~/g, ' ');
  text = text.replace(/[{}]/g, '');
  return text.replace(/\s+/g, ' ').trim();
}
