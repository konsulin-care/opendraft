import { describe, it, expect } from 'vitest';
import { createPointerKindTracker } from './pointer-kind';

describe('createPointerKindTracker', () => {
  it('returns false before any event is recorded', () => {
    const tracker = createPointerKindTracker();

    expect(tracker.isTouch()).toBe(false);
  });

  it('returns true after a touch pointer event', () => {
    const tracker = createPointerKindTracker();

    tracker.record({ pointerType: 'touch' });

    expect(tracker.isTouch()).toBe(true);
  });

  it.each(['mouse', 'pen'])(
    'returns false after a %s pointer event',
    (pointerType) => {
      const tracker = createPointerKindTracker();

      tracker.record({ pointerType: 'touch' });
      tracker.record({ pointerType });

      expect(tracker.isTouch()).toBe(false);
    },
  );

  it('follows the last recorded event', () => {
    const tracker = createPointerKindTracker();

    tracker.record({ pointerType: 'mouse' });
    tracker.record({ pointerType: 'touch' });

    expect(tracker.isTouch()).toBe(true);
  });
});
