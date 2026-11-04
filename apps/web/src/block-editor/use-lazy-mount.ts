/**
 * Lazy mount hook: a block's editor mounts only once the block is
 * expanded and its element has intersected the viewport, and it stays
 * mounted afterwards. Collapsed blocks never report mounted, even while
 * visible; scrolling a mounted block out of view never unmounts it.
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Decide whether a block's editor should be mounted.
 *
 * The element at `ref` is observed with an `IntersectionObserver` when
 * the environment provides one (environments without it never mount).
 * The result flips to true on the first intersection reported while
 * `expanded` is true, and then stays true regardless of later viewport
 * changes; while `expanded` stays false it never flips.
 *
 * @typeParam T - Type of the observed block element.
 * @param ref - Ref attached to the block's container element.
 * @param expanded - Whether the block is expanded rather than collapsed.
 * @returns True once the editor has earned mounting, false until then.
 */
export function useLazyMount<T extends HTMLElement>(
  ref: RefObject<T | null>,
  expanded: boolean,
): boolean {
  const [intersecting, setIntersecting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      setIntersecting(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, expanded]);

  useEffect(() => {
    if (expanded && intersecting) {
      setMounted(true);
    }
  }, [expanded, intersecting]);

  return mounted;
}
