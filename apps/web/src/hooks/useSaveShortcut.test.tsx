import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaveShortcut } from './useSaveShortcut';

/** Fake saver recording flushed writes instead of touching a workspace. */
interface FakeSaver {
  /** Content waiting to be written, if any. */
  pending?: string;
  /** Writes performed by flush. */
  writes: string[];
  /** Flush pending content immediately; a silent no-op when nothing is pending. */
  flush(): void;
}

/**
 * Build an in-memory saver for the hook to flush.
 *
 * @param pending - Optional content considered pending before the first flush.
 * @returns Saver plus a log of performed writes.
 */
function createFakeSaver(pending?: string): FakeSaver {
  const saver: FakeSaver = {
    pending,
    writes: [],
    flush(): void {
      if (saver.pending !== undefined) {
        saver.writes.push(saver.pending);
        saver.pending = undefined;
      }
    },
  };
  return saver;
}

/**
 * Dispatch a keydown on window and report whether it was prevented.
 *
 * @param init - KeyboardEvent initializer (modifiers, code, key, repeat).
 * @returns Whether preventDefault was called on the event.
 */
function pressKey(init: KeyboardEventInit & { repeat?: boolean }): boolean {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

describe('useSaveShortcut — Cmd/Ctrl+S triggers', () => {
  it('calls preventDefault and flushes the saver on Cmd+S (metaKey + KeyS)', () => {
    const saver = createFakeSaver('draft');
    renderHook(() => useSaveShortcut(saver));

    const prevented = pressKey({ metaKey: true, code: 'KeyS', key: 's' });

    expect(prevented).toBe(true);
    expect(saver.writes).toEqual(['draft']);
  });

  it('calls preventDefault and flushes the saver on Ctrl+S (ctrlKey + KeyS)', () => {
    const saver = createFakeSaver('draft');
    renderHook(() => useSaveShortcut(saver));

    const prevented = pressKey({ ctrlKey: true, code: 'KeyS', key: 's' });

    expect(prevented).toBe(true);
    expect(saver.writes).toEqual(['draft']);
  });
});

describe('useSaveShortcut — no pending save', () => {
  it('still prevents the browser dialog on Cmd+S (silent no-op, no write)', () => {
    const saver = createFakeSaver();
    renderHook(() => useSaveShortcut(saver));

    const prevented = pressKey({ metaKey: true, code: 'KeyS', key: 's' });

    expect(prevented).toBe(true);
    // The flush happened but nothing was written.
    expect(saver.writes).toEqual([]);
  });
});

describe('useSaveShortcut — repeated keydown', () => {
  it('does not flush again while the key is held', () => {
    const saver = createFakeSaver('draft');
    renderHook(() => useSaveShortcut(saver));

    pressKey({ metaKey: true, code: 'KeyS', key: 's' });
    pressKey({ metaKey: true, code: 'KeyS', key: 's', repeat: true });

    expect(saver.writes).toEqual(['draft']);
  });
});

describe('useSaveShortcut — ignored keys', () => {
  it('ignores a plain S without any modifier', () => {
    const flush = vi.fn();
    renderHook(() => useSaveShortcut({ flush }));

    const prevented = pressKey({ code: 'KeyS', key: 's' });

    expect(prevented).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });

  it('ignores a modifier without the S key', () => {
    const flush = vi.fn();
    renderHook(() => useSaveShortcut({ flush }));

    const prevented = pressKey({ metaKey: true, code: 'KeyF', key: 'f' });

    expect(prevented).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });

  it('lets Cmd+B pass through without preventDefault or flush', () => {
    const flush = vi.fn();
    renderHook(() => useSaveShortcut({ flush }));

    const prevented = pressKey({ metaKey: true, code: 'KeyB', key: 'b' });

    expect(prevented).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });
});

describe('useSaveShortcut — unmount', () => {
  it('removes the window keydown listener', () => {
    const flush = vi.fn();
    const { unmount } = renderHook(() => useSaveShortcut({ flush }));
    unmount();

    const prevented = pressKey({ metaKey: true, code: 'KeyS', key: 's' });

    expect(prevented).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });
});
