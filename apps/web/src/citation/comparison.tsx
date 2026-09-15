import { useMemo } from 'react';
import type { ComparisonState, Reference } from './types';

interface ComparisonViewProps {
  /** Comparison state with current and incoming entries. */
  comparison: ComparisonState;
  /** Callback when edited BibTeX changes. */
  onBibtexChange: (bibtex: string) => void;
  /** Callback when Discard button is clicked. */
  onDiscard: () => void;
  /** Callback when Replace/Save button is clicked. */
  onAction: (action: 'replace' | 'save', comparison: ComparisonState) => void;
}

/**
 * Extract citekey from a BibTeX string.
 * Matches @type{citekey, or @type{ citekey,
 */
function extractCitekey(bibtex: string): string | null {
  const match = bibtex.match(/@[a-zA-Z]+\s*\{\s*([^,\s]+)/);
  return match?.[1] ?? null;
}

/** Format a Reference as BibTeX string. */
function formatReference(ref: Reference): string {
  const lines = [`@${ref.entryType}{${ref.citeKey},`];
  for (const [key, value] of Object.entries(ref.fields)) {
    lines.push(`  ${key} = {${value}},`);
  }
  lines.push('}');
  return lines.join('\n');
}

/**
 * Comparison view for duplicate DOI detection.
 *
 * Shows current entry (read-only) and new entry (editable)
 * with Discard, Replace, or Save buttons.
 */
export function ComparisonView({
  comparison,
  onBibtexChange,
  onDiscard,
  onAction,
}: ComparisonViewProps) {
  const citekeyChanged = useMemo(() => {
    const editedCitekey = extractCitekey(comparison.editedBibtex);
    return editedCitekey !== comparison.originalCitekey;
  }, [comparison.editedBibtex, comparison.originalCitekey]);

  const handleAction = () => {
    const action = citekeyChanged ? 'save' : 'replace';
    onAction(action, comparison);
  };

  return (
    <div className="citation-comparison">
      <div className="citation-comparison-header">
        DOI already in references.bib
      </div>
      <ComparisonColumns
        current={comparison.current}
        editedBibtex={comparison.editedBibtex}
        onBibtexChange={onBibtexChange}
      />
      <div className="citation-comparison-actions">
        <button
          type="button"
          className="citation-btn citation-btn-secondary"
          onClick={onDiscard}
        >
          Discard
        </button>
        <button
          type="button"
          className="citation-btn citation-btn-primary"
          onClick={handleAction}
        >
          {citekeyChanged ? 'Save' : 'Replace'}
        </button>
      </div>
    </div>
  );
}

interface ComparisonColumnsProps {
  current: Reference;
  editedBibtex: string;
  onBibtexChange: (bibtex: string) => void;
}

function ComparisonColumns({ current, editedBibtex, onBibtexChange }: ComparisonColumnsProps) {
  return (
    <div className="citation-comparison-columns">
      <div className="citation-comparison-current">
        <div className="citation-comparison-label">Current</div>
        <pre className="citation-comparison-bibtex">
          {formatReference(current)}
        </pre>
      </div>
      <div className="citation-comparison-new">
        <div className="citation-comparison-label">New (from DOI)</div>
        <textarea
          className="citation-comparison-editor"
          value={editedBibtex}
          onChange={(e) => onBibtexChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
