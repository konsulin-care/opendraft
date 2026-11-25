import type { EditorView } from '@milkdown/kit/prose/view';
import type { Reference } from '@opendraft/references';
import type { CrossrefKind } from '@opendraft/manuscript';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { handleCitekeyClick } from './citekey-click';
import { CitekeyTooltip } from './citekey-tooltip';
import { CrossrefTooltip } from './crossref-tooltip';
import type { CrossrefTooltipProps } from './crossref-tooltip';
import { showReferenceSheet } from './reference-sheet';
import { showCrossrefSheet } from './crossref-sheet';
import { citationPluginKey, getCitationState } from './plugin';
import { createPointerKindTracker } from '../hooks/pointer-kind';
import type { PointerKindEvent } from '../hooks/pointer-kind';

/** Classifies the input device of the latest pointer interaction. */
const pointerKind = createPointerKindTracker();

/**
 * Record the pointer type of a `pointerdown` event.
 *
 * Touch versus mouse is decided per interaction so hybrid devices work.
 *
 * @param event - The pointer event carrying `pointerType`.
 */
export function handlePointerDown(event: PointerKindEvent): void {
  pointerKind.record(event);
}


/** Active tooltip state. */
let tooltipRoot: ReturnType<typeof createRoot> | null = null;
let tooltipContainer: HTMLElement | null = null;

/**
 * Handle click on citekey and cross-reference links.
 *
 * Mouse clicks on a citekey open its DOI/URL. Touch taps open a bottom
 * sheet instead: the reference sheet for citekeys and the
 * cross-reference sheet for cross-ref links.
 *
 * @param view - The editor view.
 * @param event - The click event.
 * @returns True if the event was handled.
 */
export function handleClickEvent(view: EditorView, event: Event): boolean {
  const target = (event as MouseEvent).target as HTMLElement;
  const touch = pointerKind.isTouch();

  if (target.classList.contains('citekey-link')) {
    const citekey = target.getAttribute('data-citekey');
    if (!citekey) return false;
    const ref = findRefByCitekey(view, citekey);
    if (!ref) return false;
    if (touch) {
      event.preventDefault();
      showReferenceSheet(ref);
    } else {
      handleCitekeyClick(ref);
    }
    return true;
  }

  if (!touch) return false;

  if (target.classList.contains('crossref-link')) {
    const id = target.getAttribute('data-crossref');
    const kind = target.getAttribute('data-crossref-kind') as CrossrefKind | null;
    if (!id || !kind) return false;
    event.preventDefault();
    showCrossrefSheet({
      id,
      kind,
      caption: target.getAttribute('data-crossref-caption') ?? '',
      file: target.getAttribute('data-crossref-file') ?? undefined,
    });
    return true;
  }

  if (target.classList.contains('crossref-broken')) {
    const id = target.getAttribute('data-crossref');
    if (!id) return false;
    event.preventDefault();
    showCrossrefSheet({
      id,
      kind: id.slice(0, id.indexOf('-')) as CrossrefKind,
      broken: true,
    });
    return true;
  }

  return false;
}

/** Look up reference by citekey from editor state. */
function findRefByCitekey(view: EditorView, citekey: string): Reference | null {
  const citationState = getCitationState(citationPluginKey.getState(view.state));
  return citationState?.items?.find((r) => r.citeKey === citekey) ?? null;
}

/** Handle mouseover for tooltip via event delegation. */
export function handleMouseOver(view: EditorView, event: MouseEvent) {
  if (pointerKind.isTouch()) return;

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
