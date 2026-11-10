import { afterEach, describe, expect, it } from 'vitest';
import { isDebugEnabled } from './debug-flags';

describe('isDebugEnabled', () => {
  afterEach(() => localStorage.removeItem('opendraft:debug'));

  it('is false when unset', () => {
    expect(isDebugEnabled('workspace')).toBe(false);
  });

  it('is true when listed', () => {
    localStorage.setItem('opendraft:debug', 'git,workspace');
    expect(isDebugEnabled('workspace')).toBe(true);
  });

  it('is false when other channels only', () => {
    localStorage.setItem('opendraft:debug', 'workspaces,git');
    expect(isDebugEnabled('workspace')).toBe(false);
  });
});
