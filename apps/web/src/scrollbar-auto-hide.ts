/**
 * Auto-hide scrollbars.
 *
 * Scrollbar styling lives in `scrollbar.css`, which keeps every scrollbar
 * thumb transparent and only shows it while an element carries the
 * `data-scrolling` attribute. This module is what sets that attribute: one
 * document-level listener marks whatever element scrolled and clears the mark
 * once scrolling has been idle for {@link SCROLL_IDLE_MS}.
 *
 * Scroll events do not bubble, so the listener is registered in the capture
 * phase, which is what lets a single listener see every scroll container:
 * editor scrollers, the metadata overlay, drawers and dialogs alike. Wheel,
 * trackpad, touch, keyboard (arrows, PageUp/PageDown, Space, Home/End) and
 * app-driven scrolls (`scrollIntoView`, caret following) all produce scroll
 * events, so no input-specific handling is needed.
 */

/** Idle delay after the last scroll event before the scrollbar hint hides. */
export const SCROLL_IDLE_MS = 800;

/** Attribute (and value) that reveals the scrollbar of a scroll container. */
const SCROLLING_ATTRIBUTE = 'data-scrolling';

/** Live installations, so repeated installs share one listener per document. */
const INSTALLATIONS = new WeakMap<Document, () => void>();

/**
 * Resolve the element whose scrollbar should be revealed for a scroll event.
 *
 * Page scrolling reports the `Document` as the event target, and the element
 * that actually carries the scrollbar in that case is the root element.
 *
 * @param doc - Document that owns the listener, used for the element constructor.
 * @param target - Scroll event target as reported by the browser.
 * @returns The element to mark, or `null` when the target cannot be resolved.
 */
function resolveScrolledElement(doc: Document, target: EventTarget | null): Element | null {
  if (!target) {
    return null;
  }
  if (target === doc) {
    return doc.documentElement;
  }
  const elementConstructor = doc.defaultView?.Element;
  return elementConstructor && target instanceof elementConstructor ? (target as Element) : null;
}

/**
 * Track `data-scrolling` marks and their idle timers for every scrolled element.
 *
 * @returns Handlers to reveal a container's scrollbar and to clear all marks.
 */
function createScrollingMarks(): {
  mark: (element: Element) => void;
  clearAll: () => void;
} {
  const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
  const pending = new Set<Element>();

  const hide = (element: Element): void => {
    const timer = timers.get(element);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(element);
    }
    pending.delete(element);
    element.removeAttribute(SCROLLING_ATTRIBUTE);
  };

  const mark = (element: Element): void => {
    if (!element.hasAttribute(SCROLLING_ATTRIBUTE)) {
      element.setAttribute(SCROLLING_ATTRIBUTE, '');
    }
    const timer = timers.get(element);
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    pending.add(element);
    timers.set(
      element,
      setTimeout(() => hide(element), SCROLL_IDLE_MS),
    );
  };

  const clearAll = (): void => {
    for (const element of pending) {
      hide(element);
    }
    pending.clear();
  };

  return { mark, clearAll };
}

/**
 * Reveal scrollbars while the document is being scrolled, auto-hiding each
 * container's scrollbar {@link SCROLL_IDLE_MS} after its last scroll event.
 *
 * @param doc - Document to observe, defaults to the global document.
 * @returns Disposer that removes the listener and clears pending timers. Calling
 * the disposer twice is safe, and installing again afterwards re-registers.
 */
export function installScrollbarAutoHide(doc: Document = document): () => void {
  const existing = INSTALLATIONS.get(doc);
  if (existing) {
    return existing;
  }

  const marks = createScrollingMarks();

  const handleScroll = (event: Event): void => {
    const element = resolveScrolledElement(doc, event.target);
    if (element) {
      marks.mark(element);
    }
  };

  const disposer = (): void => {
    doc.removeEventListener('scroll', handleScroll, { capture: true });
    marks.clearAll();
    INSTALLATIONS.delete(doc);
  };

  doc.addEventListener('scroll', handleScroll, { capture: true, passive: true });
  INSTALLATIONS.set(doc, disposer);
  return disposer;
}
