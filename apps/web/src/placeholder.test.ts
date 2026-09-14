// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PLACEHOLDER_HINT } from './placeholder';

describe('placeholder hint', () => {
  it('exports a single static placeholder hint', () => {
    expect(typeof PLACEHOLDER_HINT).toBe('string');
    expect(PLACEHOLDER_HINT).toBe('Type / to add a formatted text block');
  });

  it('has a reasonable length', () => {
    expect(PLACEHOLDER_HINT.length).toBeGreaterThan(10);
    expect(PLACEHOLDER_HINT.length).toBeLessThan(100);
  });
});