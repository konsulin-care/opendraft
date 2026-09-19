import type { EditorView } from '@milkdown/kit/prose/view';
import type { Reference } from '@opendraft/references';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { handleCitekeyClick } from './citekey-click';
import { CitekeyTooltip } from './citekey-tooltip';
import { citationPluginKey } from './plugin';
import type { CitationState } from './types';

/** Active tooltip state. */
let tooltipRoot: ReturnType<typeof createRoot> | null = null;
let tooltipAnchor: HTMLElement | null = null;

/**
 * Handle click on citekey links.
 *
 * @param view - The editor view.
 * @param event - The mouse event.
 * @returns True if the event was handled.
 */
export function handleClickEvent(view: EditorView, event: Event): boolean {
  const target = (event as MouseEvent).target as HTMLElement;
  if (!target.classList.contains('citekey-link')) return false;

  const citekey = target.getAttribute('data-citekey');
  if (!citekey) return false;

  const citationState = citationPluginKey.getState(view.state) as CitationState;
  if (!citationState?.items) return false;

  const ref = citationState.items.find((r) => r.citeKey === citekey);
  if (!ref) return false;

  handleCitekeyClick(ref);
  return true;
}

/**
 * Handle mouseenter/mouseleave for tooltip.
 *
 * @param view - The editor view.
 * @param event - The mouse event.
 * @param isEnter - True for mouseenter, false for mouseleave.
 * @returns False (don't prevent default).
 */
export function handleMouseEvent(
  view: EditorView,
  event: Event,
  isEnter: boolean,
): boolean {
  const target = (event as MouseEvent).target as HTMLElement;
  if (!target.classList.contains('citekey-link')) return false;

  const citekey = target.getAttribute('data-citekey');
  if (!citekey) return false;

  const citationState = citationPluginKey.getState(view.state) as CitationState;
  if (!citationState?.items) return false;

  const ref = citationState.items.find((r) => r.citeKey === citekey);
  if (!ref) return false;

  if (isEnter) {
    showTooltip(ref, target);
  } else {
    hideTooltip();
  }

  return false;
}

/**
 * Show tooltip for a citekey.
 *
 * @param ref - The reference to display.
 * @param anchor - The element to anchor to.
 */
function showTooltip(ref: Reference, anchor: HTMLElement) {
  hideTooltip();

  const container = document.createElement('div');
  container.className = 'citekey-tooltip-container';
  document.body.appendChild(container);
  tooltipAnchor = anchor;

  tooltipRoot = createRoot(container);
  tooltipRoot.render(
    React.createElement(CitekeyTooltip, {
      reference: ref,
      anchorEl: anchor,
      onClose: hideTooltip,
    }),
  );
}

/** Hide the active tooltip. */
export function hideTooltip() {
  if (tooltipRoot) {
    tooltipRoot.unmount();
    tooltipRoot = null;
  }
  if (tooltipAnchor) {
    const container = tooltipAnchor.closest('.citekey-tooltip-container');
    if (container) container.remove();
    tooltipAnchor = null;
  }
}
