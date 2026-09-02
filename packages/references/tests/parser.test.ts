import { describe, it, expect } from 'vitest';
import { parseBibTeX } from '../src/parser.js';

describe('parseBibTeX — smoke test', () => {
  it('parses a basic entry', () => {
    const bib = `@article{test2024,
  title = {Test}
}`;
    const refs = parseBibTeX(bib);
    expect(refs).toHaveLength(1);
  });
});
