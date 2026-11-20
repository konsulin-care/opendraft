/**
 * Abstract field of the manuscript metadata panel.
 *
 * A non-empty abstract renders as markdown until the reader activates it;
 * it then turns into the editable auto-growing textarea. An empty abstract
 * always renders the textarea so the missing-abstract focus target keeps
 * working.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { InlineMarkdown } from '../inline-markdown';
import { SectionLabel } from './SectionLabel';

/** Imperative actions exposed by {@link AbstractField}. */
export interface AbstractFieldHandle {
  /** Switch to edit mode and focus the textarea. */
  startEditing(): void;
}

/** Props for {@link AbstractField}. */
export interface AbstractFieldProps {
  /** Abstract text; '' before the first edit. */
  abstract: string;
  /** Persist an abstract change to _abstract.yml. */
  setAbstract: (text: string) => void;
}

/** Props for the internal {@link AbstractEditor} textarea. */
interface AbstractEditorProps {
  /** Saved abstract, used to decide whether blur may leave edit mode. */
  abstract: string;
  /** Current textarea value: the local draft while editing. */
  value: string;
  /** Whether the textarea is in edit mode. */
  editing: boolean;
  /** Persist a textarea change. */
  setAbstract: (text: string) => void;
  /** Replace the local draft. */
  setDraft: (text: string) => void;
  /** Toggle edit mode. */
  setEditing: (editing: boolean) => void;
  /** Ref to the textarea element. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/** Grow a textarea to its content height. */
function autoGrow(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/** Count whitespace-separated words in a text. */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Small-caps label row with the abstract word count. */
function AbstractLabelRow({ abstract }: { abstract: string }): ReactNode {
  return (
    <div data-testid="abstract-label-row" className="flex items-baseline justify-between text-sm">
      <SectionLabel>Abstract</SectionLabel>
      <span data-testid="abstract-word-count" className="text-muted">
        {countWords(abstract)} words
      </span>
    </div>
  );
}

/** Auto-growing abstract textarea that focuses itself on entry. */
function AbstractEditor({
  abstract,
  value,
  editing,
  setAbstract,
  setDraft,
  setEditing,
  textareaRef,
}: AbstractEditorProps): ReactNode {
  useEffect(() => {
    autoGrow(textareaRef.current);
  }, [value, textareaRef]);
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing, textareaRef]);
  return (
    <textarea
      ref={textareaRef}
      data-testid="metadata-abstract"
      aria-label="Abstract"
      value={value}
      rows={2}
      onFocus={() => {
        if (editing) return;
        setDraft(abstract);
        setEditing(true);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        setEditing(true);
        setAbstract(next);
        autoGrow(event.currentTarget);
      }}
      onBlur={() => {
        if (abstract.trim() !== '') setEditing(false);
      }}
      className="min-h-11 w-full resize-none text-sm outline-none"
    />
  );
}

/**
 * Abstract view/edit field.
 *
 * While editing, the textarea holds a local draft and ignores incoming
 * abstract prop changes so save-side normalization never moves the cursor.
 *
 * @param props - See {@link AbstractFieldProps}.
 * @param ref - Receives the imperative edit-mode actions.
 * @returns The rendered abstract section.
 */
export const AbstractField = forwardRef<AbstractFieldHandle, AbstractFieldProps>(
  function AbstractField({ abstract, setAbstract }, ref): ReactNode {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const startEditing = (): void => {
      setDraft(abstract);
      setEditing(true);
    };
    useImperativeHandle(ref, () => ({ startEditing }), [abstract]);
    const showTextarea = editing || abstract.trim() === '';
    const value = editing && draft !== null ? draft : abstract;
    return (
      <section className="mt-3">
        <AbstractLabelRow abstract={value} />
        {showTextarea ? (
          <AbstractEditor
            abstract={abstract}
            value={value}
            editing={editing}
            setAbstract={setAbstract}
            setDraft={setDraft}
            setEditing={setEditing}
            textareaRef={textareaRef}
          />
        ) : (
          <div
            data-testid="metadata-abstract-view"
            role="button"
            tabIndex={0}
            aria-label="Edit abstract"
            onClick={startEditing}
            onFocus={startEditing}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                startEditing();
              }
            }}
            className="cursor-text text-sm outline-none"
          >
            <InlineMarkdown source={abstract} />
          </div>
        )}
      </section>
    );
  },
);
