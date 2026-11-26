import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDismiss } from './use-dismiss';

/** Dispatch a keydown for the given key on the document. */
function pressKey(key: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** Dispatch a mousedown on the given target. */
function mouseDown(target: EventTarget): void {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

interface Harness {
  container: HTMLDivElement;
  outside: HTMLDivElement;
  ref: RefObject<HTMLElement | null>;
}

/** Create a container, an outside element and a ref pointing at the container. */
function setupContainer(): Harness {
  const container = document.createElement('div');
  const outside = document.createElement('div');
  document.body.append(container, outside);
  const ref = createRef<HTMLElement>();
  ref.current = container;
  return { container, outside, ref };
}

describe('useDismiss while open', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onDismiss on Escape', () => {
    const onDismiss = vi.fn();
    const { ref } = setupContainer();

    renderHook(() => useDismiss(true, ref, onDismiss));

    pressKey('Escape');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss on a mousedown outside the container', () => {
    const onDismiss = vi.fn();
    const { outside, ref } = setupContainer();

    renderHook(() => useDismiss(true, ref, onDismiss));

    mouseDown(outside);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores a mousedown inside the container', () => {
    const onDismiss = vi.fn();
    const { container, ref } = setupContainer();
    const inside = document.createElement('span');
    container.appendChild(inside);

    renderHook(() => useDismiss(true, ref, onDismiss));

    mouseDown(inside);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('useDismiss while closed', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does nothing while closed', () => {
    const onDismiss = vi.fn();
    const { outside, ref } = setupContainer();

    renderHook(() => useDismiss(false, ref, onDismiss));

    pressKey('Escape');
    mouseDown(outside);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('cleans up when closed after being open', () => {
    const onDismiss = vi.fn();
    const { outside, ref } = setupContainer();

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useDismiss(open, ref, onDismiss),
      { initialProps: { open: true } },
    );

    rerender({ open: false });
    pressKey('Escape');
    mouseDown(outside);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
