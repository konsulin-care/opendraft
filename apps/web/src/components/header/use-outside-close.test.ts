// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { useOutsideClose } from './use-outside-close';

interface Fixture {
  container: HTMLDivElement;
  inside: HTMLButtonElement;
  outside: HTMLButtonElement;
  containerRef: { current: HTMLDivElement | null };
}

function makeFixture(): Fixture {
  const container = document.createElement('div');
  const inside = document.createElement('button');
  const outside = document.createElement('button');
  container.appendChild(inside);
  document.body.append(container, outside);
  return { container, inside, outside, containerRef: { current: container } };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useOutsideClose', () => {
  it('calls onClose when a mousedown lands outside the container while open', () => {
    const onClose = vi.fn();
    const fixture = makeFixture();
    renderHook(() => useOutsideClose(true, fixture.containerRef, onClose));

    fireEvent.mouseDown(fixture.outside);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for a mousedown inside the container', () => {
    const onClose = vi.fn();
    const fixture = makeFixture();
    renderHook(() => useOutsideClose(true, fixture.containerRef, onClose));

    fireEvent.mouseDown(fixture.inside);
    fireEvent.mouseDown(fixture.container);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not register any listener while closed', () => {
    const onClose = vi.fn();
    const fixture = makeFixture();
    const addSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useOutsideClose(false, fixture.containerRef, onClose));
    const registrations = addSpy.mock.calls.filter(([type]) => type === 'mousedown');
    addSpy.mockRestore();

    fireEvent.mouseDown(fixture.outside);

    expect(registrations).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });
});
