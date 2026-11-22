import { useEffect, useRef } from 'react';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import type { CrossrefKind } from '@opendraft/manuscript';

/** Display names for each cross-reference kind. */
const KIND_NAMES: Record<CrossrefKind, string> = {
  sec: 'Section',
  fig: 'Figure',
  tbl: 'Table',
  eq: 'Equation',
};

/** Props for the cross-reference hover tooltip. */
export interface CrossrefTooltipProps {
  /** The label id, for example `fig-cat`. */
  id: string;
  /** The label kind, used to show the human-readable kind name. */
  kind: CrossrefKind;
  /** The label caption, empty for broken labels. */
  caption?: string;
  /** Whether the label could not be resolved in the manuscript. */
  broken?: boolean;
  /** The element the tooltip is anchored to. */
  anchorEl: HTMLElement | null;
}

/** Render the tooltip body for a known or broken label. */
function TooltipBody({
  id,
  kind,
  caption,
  broken,
}: Pick<CrossrefTooltipProps, 'id' | 'kind' | 'caption' | 'broken'>) {
  if (broken) {
    return (
      <div className="crossref-tooltip-broken">
        Unknown cross-reference: {id}
      </div>
    );
  }
  return (
    <>
      <div className="crossref-tooltip-kind">{KIND_NAMES[kind]}</div>
      <div className="crossref-tooltip-id">{id}</div>
      {caption && <div className="crossref-tooltip-caption">{caption}</div>}
    </>
  );
}

/**
 * Tooltip for a Quarto cross-reference label.
 *
 * Uses the same Floating UI positioning as the citekey tooltip: below the
 * anchor by default, flipping above near the viewport bottom, and shifting
 * horizontally to stay inside the viewport.
 *
 * @param props - The label data and anchor element.
 * @returns The tooltip element, or `null` when there is no anchor.
 */
export function CrossrefTooltip(props: CrossrefTooltipProps) {
  const { id, kind, caption, broken, anchorEl } = props;
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tooltipRef.current;
    if (!anchorEl || !el) return;

    /** Compute and apply the tooltip position. */
    async function update() {
      const { x, y } = await computePosition(anchorEl!, el!, {
        strategy: 'fixed',
        placement: 'bottom',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      });
      Object.assign(el!.style, { top: `${y}px`, left: `${x}px` });
    }

    update();

    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update, { passive: true });

    return () => {
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }, [anchorEl, id, broken]);

  if (!anchorEl) return null;

  return (
    <div
      ref={tooltipRef}
      className="crossref-tooltip"
      role="tooltip"
      style={{ position: 'fixed' }}
    >
      <TooltipBody id={id} kind={kind} caption={caption} broken={broken} />
    </div>
  );
}
