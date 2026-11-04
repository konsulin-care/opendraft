/**
 * Inline add-block form: an autofocused title, a short name derived from
 * the title until it is edited by hand (clearing the field restores the
 * sync), a live preview of the deduplicated candidate short name, a
 * section-type dropdown, Enter to create and Escape to cancel.
 */
import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { normalizeShortName, uniqueShortName } from './slug';
import { sectionTypePresets } from './deo-types';

/** Draft handed to {@link AddBlockFormProps.onCreate} when Enter creates. */
export interface BlockDraft {
  /** Trimmed heading title. */
  title: string;
  /** Deduplicated short name the block file will be created under. */
  short: string;
  /** Section type short name, e.g. `'methods'` or the generic `'section'`. */
  type: string;
}

/** Props for {@link AddBlockForm}. */
export interface AddBlockFormProps {
  /** Short names already in use; the preview de-duplicates against them. */
  taken: readonly string[];
  /** Create the block from the draft; called before the form closes. */
  onCreate: (draft: BlockDraft) => void;
  /** Close the form without creating a block. */
  onClose: () => void;
}

/** Shared text-field styling. */
const FIELD_CLASS =
  'w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/** Section type used when no rhetorical preset is chosen. */
const GENERIC_TYPE = 'section';

/**
 * Title input; autofocused while the form is open.
 *
 * @param props - Current title text and its change handler.
 */
function TitleField({
  value,
  onChange,
}: {
  /** Current title text. */
  value: string;
  /** Receive the new title text. */
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-gray-700">
      Title
      <input
        type="text"
        aria-label="Title"
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      />
    </label>
  );
}

/**
 * Short-name input; shows the derived name until edited by hand.
 *
 * @param props - Displayed short name and its change handler.
 */
function ShortField({
  value,
  onChange,
}: {
  /** Short name to display. */
  value: string;
  /** Receive the raw field value; an empty string releases the lock. */
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-gray-700">
      Short name
      <input
        type="text"
        aria-label="Short name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_CLASS} font-mono`}
      />
    </label>
  );
}

/**
 * Live preview of the deduplicated short name the block will get.
 *
 * @param props - Candidate short name about to be created.
 */
function ShortNamePreview({ candidate }: { candidate: string }) {
  return (
    <p aria-label="Short name preview" className="text-xs text-gray-500">
      Will be saved as <code>{candidate}</code>
    </p>
  );
}

/**
 * Section-type dropdown: the generic section plus the DEO presets.
 *
 * @param props - Selected section type and its change handler.
 */
function TypeSelect({
  value,
  onChange,
}: {
  /** Selected section type short name. */
  value: string;
  /** Receive the newly selected section type. */
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-gray-700">
      Section type
      <select
        aria-label="Section type"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      >
        <option value={GENERIC_TYPE}>Section</option>
        {sectionTypePresets().map((preset) => (
          <option key={preset.shortName} value={preset.shortName}>
            {preset.title}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Inline form for creating a block. The title drives the short name until
 * the short-name field is edited by hand; clearing that field releases the
 * manual lock and resumes the derivation. The preview shows the
 * deduplicated candidate that Enter hands to `onCreate` before `onClose`
 * runs; Escape closes without creating.
 *
 * @param props - See {@link AddBlockFormProps}.
 */
export function AddBlockForm({ taken, onCreate, onClose }: AddBlockFormProps) {
  const [title, setTitle] = useState('');
  const [short, setShort] = useState('');
  const [shortEdited, setShortEdited] = useState(false);
  const [type, setType] = useState(GENERIC_TYPE);

  const effectiveShort = shortEdited ? short : normalizeShortName(title);
  const candidate = useMemo(
    () => uniqueShortName(effectiveShort, (name) => taken.includes(name)),
    [effectiveShort, taken],
  );

  const onShortChange = (value: string) => {
    if (value === '') {
      setShort('');
      setShortEdited(false);
      return;
    }
    setShort(value);
    setShortEdited(true);
  };

  /** Enter creates the trimmed draft and closes; Escape just closes. */
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault();
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    const trimmed = title.trim();
    if (trimmed === '') return;
    onCreate({ title: trimmed, short: candidate, type });
    onClose();
  };
  return (
    <form
      aria-label="Add block"
      onKeyDown={onKeyDown}
      onSubmit={(event) => event.preventDefault()}
      className="space-y-2 rounded-md border border-gray-200 p-3"
    >
      <TitleField value={title} onChange={setTitle} />
      <ShortField value={effectiveShort} onChange={onShortChange} />
      <ShortNamePreview candidate={candidate} />
      <TypeSelect value={type} onChange={setType} />
    </form>
  );
}
