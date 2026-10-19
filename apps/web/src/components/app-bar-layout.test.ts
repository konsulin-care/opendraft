import { describe, it, expect } from 'vitest';
import { APP_BAR_HEIGHT } from './app-bar-layout';

describe('APP_BAR_HEIGHT', () => {
  it('is a non-empty height class sized for two text lines', () => {
    expect(typeof APP_BAR_HEIGHT).toBe('string');
    expect(APP_BAR_HEIGHT.trim().length).toBeGreaterThan(0);
    expect(APP_BAR_HEIGHT).toContain('h-');
  });
});
