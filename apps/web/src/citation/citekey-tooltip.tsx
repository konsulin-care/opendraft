import { useEffect, useRef, useState } from 'react';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import type { Reference } from '@opendraft/references';
import { formatAPA } from './apa-format';

interface CitekeyTooltipProps {
  reference: Reference | null;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

/**
 * Tooltip component for displaying APA-formatted citation.
 *
 * Uses Floating UI for smart positioning: appears below the anchor
 * by default, flips above when near the viewport bottom edge,
 * and shifts horizontally to stay within the viewport.
 */
export function CitekeyTooltip({ reference, anchorEl }: CitekeyTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [apaText, setApaText] = useState('');

  useEffect(() => {
    setApaText(reference ? formatAPA(reference) : '');
  }, [reference]);

  useEffect(() => {
    const el = tooltipRef.current;
    if (!anchorEl || !el || !apaText) return;

    /** Compute and apply position to the tooltip element. */
    async function update() {
      const { x, y } = await computePosition(anchorEl!, el, {
        placement: 'bottom',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      });
      Object.assign(el.style, { top: `${y}px`, left: `${x}px` });
    }

    update();

    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update, { passive: true });

    return () => {
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }, [reference, anchorEl, apaText]);

  if (!reference || !apaText || !anchorEl) return null;

  return (
    <div
      ref={tooltipRef}
      className="citekey-tooltip"
      role="tooltip"
      style={{ position: 'fixed' }}
    >
      {apaText}
    </div>
  );
}
