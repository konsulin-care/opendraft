import { describe, it, expect } from 'vitest';
import type { ValidationResult, ValidationError } from '../src/index.js';

describe('packages/schema exports', () => {
  it('exports ValidationResult type', () => {
    // Compile-time check: this test passes if the type imports correctly.
    const result: ValidationResult = { valid: true, errors: [] };
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('exports ValidationError type', () => {
    const error: ValidationError = { path: 'test', message: 'msg' };
    expect(error.path).toBe('test');
    expect(error.message).toBe('msg');
  });
});
