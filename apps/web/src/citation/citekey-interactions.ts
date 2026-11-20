import type { EditorView } from '@milkdown/kit/prose/view';
import type { Reference } from '@opendraft/references';
import type { CrossrefKind } from '@opendraft/manuscript';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { handleCitekeyClick } from './citekey-click';
import { CitekeyTooltip } from './citekey-tooltip';
import { CrossrefTooltip } from './crossref-tooltip';
import type { CrossrefTooltipProps } from './crossref-tooltip';
import { citationPluginKey, getCitationState } from './plugin';


/** Active tooltip state. */
let tooltipRoot: ReturnType<typeof createRoot> | null = null;
let tooltipContainer: HTMLElement | null = null;

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

  const citationState = getCitationState(citationPluginKey.getState(view.state));
  if (!citationState?.items) return false;

  const ref = citationState.items.find((r) => r.citeKey === citekey);
  if (!ref) return false;

  handleCitekeyClick(ref);
  return true;
}

/** Look up reference by citekey from editor state. */
function findRefByCitekey(view: EditorView, citekey: string): Reference | null {
  const citationState = getCitationState(citationPluginKey.getState(view.state));
  return citationState?.items?.find((r) => r.citeKey === citekey) ?? null;
}

/** Handle mouseover for tooltip via event delegation. */
export function handleMouseOver(view: EditorView, event: MouseEvent) {
  const target = event.target as HTMLElement;

  if (target.classList.contains('citekey-link')) {
    const citekey = target.getAttribute('data-citekey');
    if (!citekey) return;
    const ref = findRefByCitekey(view, citekey);
    if (ref) showTooltip(ref, target);
    return;
  }

  if (target.classList.contains('crossref-link')) {
    const id = target.getAttribute('data-crossref');
    const kind = target.getAttribute('data-crossref-kind') as CrossrefKind | null;
    if (!id || !kind) return;
    showCrossrefTooltip(
      {
        id,
        kind,
        caption: target.getAttribute('data-crossref-caption') ?? '',
        broken: false,
        anchorEl: target,
      },
      target,
    );
    return;
  }

  if (target.classList.contains('crossref-broken')) {
    const id = target.getAttribute('data-crossref');
    if (!id) return;
    showCrossrefTooltip(
      {
        id,
        kind: id.slice(0, id.indexOf('-')) as CrossrefKind,
        broken: true,
        anchorEl: target,
      },
      target,
    );
  }
}

/** Handle mouseout for tooltip via event delegation. */
export function handleMouseOut(_view: EditorView, event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (
    target.classList.contains('citekey-link') ||
    target.classList.contains('crossref-link') ||
    target.classList.contains('crossref-broken')
  ) {
    hideTooltip();
  }
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
  tooltipContainer = container;

  tooltipRoot = createRoot(container);
  tooltipRoot.render(
    React.createElement(CitekeyTooltip, {
      reference: ref,
      anchorEl: anchor,
    }),
  );
}

/**
 * Show the cross-reference tooltip.
 *
 * @param props - The label data and anchor element.
 * @param anchor - The element to anchor the tooltip to.
 */
function showCrossrefTooltip(
  props: CrossrefTooltipProps,
  anchor: HTMLElement,
) {
  hideTooltip();

  const container = document.createElement('div');
  container.className = 'crossref-tooltip-container';
  document.body.appendChild(container);
  tooltipContainer = container;

  tooltipRoot = createRoot(container);
  tooltipRoot.render(
    React.createElement(CrossrefTooltip, {
      ...props,
      anchorEl: anchor,
    }),
  );
}

/** Hide the active tooltip. */
export function hideTooltip() {
  if (tooltipRoot) {
    tooltipRoot.unmount();
    tooltipRoot = null;
  }
  if (tooltipContainer) {
    tooltipContainer.remove();
    tooltipContainer = null;
  }
}
