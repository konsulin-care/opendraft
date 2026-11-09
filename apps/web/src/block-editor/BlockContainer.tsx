/**
 * Collapsible block container: a header owning the H1 title and block
 * controls above a body that goes `inert` while collapsed. In code mode
 * the body opens with a read-only gutter line showing the exact
 * canonical heading written to the block file.
 */
import type { ReactNode } from 'react';
import type { SaveStatus } from '../components/AppHeader';
import { BlockHeader } from './BlockHeader';
import { joinHeading } from './heading';

/** Editing surface of a block body: the visual editor or the code surface. */
export type BlockBodyMode = 'visual' | 'code';

/** Section type used when the block carries no type of its own. */
const GENERIC_TYPE = 'section';

/** Props for {@link BlockContainer}. */
export interface BlockContainerProps {
  /** Block short name — the file name without `.qmd`. */
  short: string;
  /** Section title rendered as the header H1. */
  title: string;
  /** Which surface the body renders; only code mode shows the heading line. */
  mode: BlockBodyMode;
  /** Whether the body is collapsed; collapsed bodies go `inert`. */
  collapsed: boolean;
  /** Flip the collapsed state; wired to the header toggle. */
  onToggle: () => void;
  /** Section type short name used in the canonical heading line. */
  type?: string;
  /** Word count shown in the header. */
  wordCount?: number;
  /** Autosave state shown in the header. */
  saveStatus?: SaveStatus;
  /** Open the block's overflow menu. */
  onOverflow?: () => void;
  /** Save an edited section title; forwarded to the header inline field. */
  onTitleSave?: (title: string) => void | Promise<void>;
  /** The block's body: the visual editor or the code surface. */
  children?: ReactNode;
}

/**
 * Collapsible container for one block.
 *
 * @param props - See {@link BlockContainerProps}.
 * @returns The header, the inertable body and, in code mode, the
 *          read-only heading line above the code surface.
 */
export function BlockContainer({
  short,
  title,
  mode,
  collapsed,
  onToggle,
  type = GENERIC_TYPE,
  wordCount = 0,
  saveStatus = 'saved',
  onOverflow,
  onTitleSave,
  children,
}: BlockContainerProps) {
  // joinHeading appends the body newline; the gutter shows the line only.
  const headingLine = joinHeading({ title, anchor: `sec-${short}`, type }, '').replace(/\n$/, '');
  return (
    <section className="doco-block">
      <BlockHeader
        short={short}
        title={title}
        collapsed={collapsed}
        onToggle={onToggle}
        wordCount={wordCount}
        saveStatus={saveStatus}
        onOverflow={onOverflow}
        onTitleSave={onTitleSave}
      />
      <div className="doco-block-body" data-testid="block-body" inert={collapsed}>
        {mode === 'code' && (
          <div role="note" aria-label="Read-only heading line" className="doco-block-heading-line">
            {headingLine}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
