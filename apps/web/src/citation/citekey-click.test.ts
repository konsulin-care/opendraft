import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleCitekeyClick } from './citekey-click';
import type { Reference } from '@opendraft/references';

describe('handleCitekeyClick', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => { openSpy = vi.spyOn(window, 'open').mockImplementation(() => null); });
  afterEach(() => { openSpy.mockRestore(); });

  it('opens DOI link', () => {
    const ref: Reference = { citeKey: 'test', entryType: 'article', fields: { doi: '10.1000/test' } };
    handleCitekeyClick(ref);
    expect(openSpy).toHaveBeenCalledWith('https://doi.org/10.1000/test', '_blank', 'noopener,noreferrer');
  });

  it('opens URL when no doi', () => {
    const ref: Reference = { citeKey: 'test', entryType: 'misc', fields: { url: 'https://example.com' } };
    handleCitekeyClick(ref);
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });

  it('prefers DOI over URL', () => {
    const ref: Reference = { citeKey: 'test', entryType: 'article', fields: { doi: '10.1000/test', url: 'https://example.com' } };
    handleCitekeyClick(ref);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing without doi or url', () => {
    const ref: Reference = { citeKey: 'test', entryType: 'article', fields: {} };
    handleCitekeyClick(ref);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
