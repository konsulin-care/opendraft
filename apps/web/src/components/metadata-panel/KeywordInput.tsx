/**
 * Keyword chip input for the manuscript metadata panel.
 *
 * A controlled input that turns typed or pasted text into keyword
 * chips: Enter and comma commit the draft, pasted text splits on
 * commas, semicolons and newlines, duplicates are ignored, and
 * Backspace on an empty draft removes the last chip. The caller
 * always receives the deduped keyword array. With no keywords the
 * field hides behind an 'Add keyword' button that reveals and
 * focuses it.
 */
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

/** Props for {@link KeywordInput}. */
export interface KeywordInputProps {
  /** Current keywords in file order. */
  keywords: string[];
  /** Receive the deduped keyword array after every change. */
  onChange: (keywords: string[]) => void;
}

/** Separators that split typed or pasted text into keywords. */
const SEPARATORS = /[,;\n]/;

/**
 * Split raw input into trimmed, non-empty keyword candidates.
 *
 * @param raw - Draft or pasted text.
 * @returns The keyword candidates in order of appearance.
 */
function splitKeywords(raw: string): string[] {
  return raw.split(SEPARATORS).map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * Keyword chip input with a count.
 *
 * @param props - See {@link KeywordInputProps}.
 * @returns The rendered chips, draft field and count.
 */
export function KeywordInput({ keywords, onChange }: KeywordInputProps): ReactNode {
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (revealed) inputRef.current?.focus();
  }, [revealed]);

  const commit = (raw: string): void => {
    const additions = splitKeywords(raw).filter((word) => !keywords.includes(word));
    setDraft('');
    if (additions.length > 0) onChange([...keywords, ...additions]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
    } else if (event.key === 'Backspace' && draft === '' && keywords.length > 0) {
      onChange(keywords.slice(0, -1));
    }
  };

  const onFieldChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    if (SEPARATORS.test(value)) commit(value);
    else setDraft(value);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text');
    if (!SEPARATORS.test(text)) return;
    event.preventDefault();
    commit(text);
  };

  return (
    <KeywordChips
      keywords={keywords}
      draft={draft}
      showInput={revealed || keywords.length > 0}
      onReveal={() => setRevealed(true)}
      inputRef={inputRef}
      onKeyDown={onKeyDown}
      onFieldChange={onFieldChange}
      onPaste={onPaste}
    />
  );
}

/** Props for {@link KeywordChips}. */
interface KeywordChipsProps {
  /** Committed keywords. */
  keywords: string[];
  /** Draft text of the input. */
  draft: string;
  /** Whether the draft input replaces the reveal button. */
  showInput: boolean;
  /** Reveal the draft input. */
  onReveal: () => void;
  /** Ref of the draft input, focused once it is revealed. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Chip commit/removal key handler. */
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Draft change handler. */
  onFieldChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Separator paste handler. */
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}

/** Chips row, draft field and keyword count. */
function KeywordChips({
  keywords,
  draft,
  showInput,
  onReveal,
  inputRef,
  onKeyDown,
  onFieldChange,
  onPaste,
}: KeywordChipsProps): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="keyword-input">
      {keywords.map((keyword) => (
        <span
          key={keyword}
          data-testid="keyword-chip"
          className="rounded bg-surface-low px-2 py-0.5 text-sm"
        >
          {keyword}
        </span>
      ))}
      {showInput ? (
        <input
          ref={inputRef}
          data-testid="keyword-field"
          aria-label="Keywords"
          value={draft}
          onChange={onFieldChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className="min-h-11 min-w-24 flex-1 outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className="min-h-11 rounded px-2 text-sm text-muted hover:bg-hover"
        >
          Add keyword
        </button>
      )}
      <span data-testid="keyword-count" className="text-sm text-muted">
        {keywords.length} keywords
      </span>
    </div>
  );
}
