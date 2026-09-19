import { useEffect, useRef, useState, useCallback } from 'react';
import type { Reference } from '@opendraft/references';
import { formatAPA } from './apa-format';

interface TooltipPosition {
  top: number;
  left: number;
}

interface CitekeyTooltipProps {
  reference: Reference | null;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

/**
 * Calculate tooltip position relative to anchor element.
 *
 * @param anchor - The anchor element.
 * @param tooltip - The tooltip element.
 * @returns Position coordinates.
 */
function calculatePosition(anchor: HTMLElement, tooltip: HTMLElement): TooltipPosition {
  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = anchorRect.top - tooltipRect.height - 8;
  let left = anchorRect.left + (anchorRect.width - tooltipRect.width) / 2;

  if (top < 0) top = anchorRect.bottom + 8;
  if (left < 8) left = 8;
  if (left + tooltipRect.width > vw - 8) left = vw - tooltipRect.width - 8;
  if (top + tooltipRect.height > vh - 8) top = 8;

  return { top, left };
}

/**
 * Tooltip component for displaying APA-formatted citation.
 */
export function CitekeyTooltip({ reference, anchorEl, onClose }: CitekeyTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [apaText, setApaText] = useState('');
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });

  useEffect(() => {
    setApaText(reference ? formatAPA(reference) : '');
  }, [reference]);

  const updatePosition = useCallback(() => {
    if (!anchorEl || !tooltipRef.current) return;
    setPosition(calculatePosition(anchorEl, tooltipRef.current));
  }, [anchorEl]);

  useEffect(() => {
    if (!reference || !anchorEl || !tooltipRef.current) return;

    updatePosition();
    window.addEventListener('scroll', updatePosition, { capture: true, passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    return () => {
      window.removeEventListener('scroll', updatePosition, { capture: true });
      window.removeEventListener('resize', updatePosition);
    };
  }, [reference, anchorEl, updatePosition]);

  if (!reference || !apaText || !anchorEl) return null;

  return (
    <div
      ref={tooltipRef}
      className="citekey-tooltip"
      role="tooltip"
      style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px` }}
      onMouseLeave={onClose}
    >
      {apaText}
    </div>
  );
}
