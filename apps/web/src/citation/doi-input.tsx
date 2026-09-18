import { useRef, useEffect } from 'react';

interface DoiInputProps {
  /** Current DOI input value. */
  doi: string;
  /** Callback when DOI input changes. */
  onDoiChange: (doi: string) => void;
  /** Callback when user submits DOI (Enter key). */
  onResolve: (doi: string) => void;
  /** Callback when user cancels (Escape or empty Backspace). */
  onEscape: () => void;
}

/**
 * DOI input field for adding new citations.
 *
 * Allows users to enter a DOI and resolve it to BibTeX.
 */
export function DoiInput({ doi, onDoiChange, onResolve, onEscape }: DoiInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && doi) {
      e.preventDefault();
      onResolve(doi);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
    } else if (e.key === 'Backspace' && !doi) {
      e.preventDefault();
      onEscape();
    }
  };

  return (
    <div className="citation-doi-input">
      <input
        ref={inputRef}
        type="text"
        className="citation-doi-field"
        placeholder="Enter DOI (e.g., 10.1186/s12909-024-06415-w)"
        value={doi}
        onChange={(e) => onDoiChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
