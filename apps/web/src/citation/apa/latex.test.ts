import { describe, expect, it } from 'vitest';
import { cleanLatex } from './latex';

describe('cleanLatex', () => {
  it('strips protective braces', () => {
    expect(
      cleanLatex('{MindKind} Study findings from {India}, {South Africa}'),
    ).toBe('MindKind Study findings from India, South Africa');
  });

  it('converts braced and bare accent commands to precomposed characters', () => {
    expect(cleanLatex('M{\\"u}ller, Caf\\\'e and Fran\\c{c}ois')).toBe(
      'Müller, Café and François',
    );
  });

  it('converts other accent and symbol commands', () => {
    expect(cleanLatex('\\`a \\^o \\~n \\v{s} {\\ss} {\\o} {\\aa}')).toBe(
      'à ô ñ š ß ø å',
    );
  });

  it('unescapes reserved characters, dashes and ties', () => {
    expect(cleanLatex('A \\& B, 5\\%, 10--20, a---b, Dr.~X')).toBe(
      'A & B, 5%, 10–20, a—b, Dr. X',
    );
  });
});
