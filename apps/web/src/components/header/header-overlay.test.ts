import { describe, expect, it } from 'vitest';
import { headerOverlayReducer } from './header-overlay';

describe('headerOverlayReducer', () => {
  it('opens the details panel from closed and closes it from details or picker', () => {
    expect(headerOverlayReducer('closed', 'toggleDetails')).toBe('details');
    expect(headerOverlayReducer('details', 'toggleDetails')).toBe('closed');
    expect(headerOverlayReducer('picker', 'toggleDetails')).toBe('closed');
  });

  it('shows only the picker when opened from details and returns to details on dismiss', () => {
    expect(headerOverlayReducer('details', 'openPicker')).toBe('picker');
    expect(headerOverlayReducer('closed', 'openPicker')).toBe('closed');
    expect(headerOverlayReducer('picker', 'openPicker')).toBe('picker');
    expect(headerOverlayReducer('picker', 'dismiss')).toBe('details');
  });

  it('closes every overlay on pick and drawerOpened, and closes details on dismiss', () => {
    expect(headerOverlayReducer('closed', 'pick')).toBe('closed');
    expect(headerOverlayReducer('details', 'pick')).toBe('closed');
    expect(headerOverlayReducer('picker', 'pick')).toBe('closed');

    expect(headerOverlayReducer('closed', 'drawerOpened')).toBe('closed');
    expect(headerOverlayReducer('details', 'drawerOpened')).toBe('closed');
    expect(headerOverlayReducer('picker', 'drawerOpened')).toBe('closed');

    expect(headerOverlayReducer('closed', 'dismiss')).toBe('closed');
    expect(headerOverlayReducer('details', 'dismiss')).toBe('closed');
  });
});
