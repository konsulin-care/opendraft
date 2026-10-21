/**
 * Publication details section of the article view: an editable date,
 * license (combobox presets plus free text), copyright and funding,
 * plus the all-or-none subject group (label, authority, term). The
 * section is collapsed by default and persists every field through
 * the parent-supplied frontmatter setter.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/** Icon size used by the section chevron. */
const ICON = 'inline size-4 shrink-0';

/** License presets offered by the combobox; free text stays allowed. */
const LICENSE_PRESETS = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC0'];

/** Persist one _frontmatter.yml field; '' or undefined deletes it. */
export type SetFrontmatterField = (key: string, value: unknown) => void;

/** Read a string field of the frontmatter map ('' when missing). */
function frontmatterText(frontmatter: Record<string, unknown>, key: string): string {
  return typeof frontmatter[key] === 'string' ? frontmatter[key] as string : '';
}

/** The three subject parts as written in _frontmatter.yml. */
interface SubjectDraft {
  /** Human-readable label; becomes subject.text. */
  text: string;
  /** Authority base IRI; becomes subject.authority. */
  authority: string;
  /** Term id within the authority; becomes subject.term. */
  term: string;
}

/** Record view of the subject object ('' fields when missing). */
function subjectOf(frontmatter: Record<string, unknown>): SubjectDraft {
  const value = frontmatter['subject'];
  const record = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    text: typeof record['text'] === 'string' ? record['text'] : '',
    authority: typeof record['authority'] === 'string' ? record['authority'] : '',
    term: typeof record['term'] === 'string' ? record['term'] : '',
  };
}

/** Borderless labelled input of one frontmatter string field. */
function Field({ label, testId, value, onChange, list }: {
  label: string; testId: string; value: string;
  onChange: (value: string) => void; list?: string;
}): ReactNode {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input
        data-testid={testId}
        value={value}
        list={list}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded px-1 outline-none"
      />
    </label>
  );
}

/** Validation of the subject group: null when empty or complete. */
function subjectError(label: string, authority: string, term: string): string | null {
  if (!label.trim()) return null;
  return authority.trim() && term.trim() ? null : 'authority and term required';
}

/** All-or-none subject editor: the three parts write to YAML together. */
function SubjectFields({ frontmatter, setField }: {
  frontmatter: Record<string, unknown>; setField: SetFrontmatterField;
}): ReactNode {
  const initial = subjectOf(frontmatter);
  const [label, setLabel] = useState(initial.text);
  const [authority, setAuthority] = useState(initial.authority);
  const [term, setTerm] = useState(initial.term);
  // Re-seed from the written subject (external reloads); the string deps
  // keep the local draft untouched while it is being typed.
  useEffect(() => {
    setLabel(initial.text);
    setAuthority(initial.authority);
    setTerm(initial.term);
  }, [initial.text, initial.authority, initial.term]);
  const change = (part: keyof SubjectDraft, value: string): void => {
    const next = { text: label, authority, term, [part]: value } as SubjectDraft;
    if (part === 'text') setLabel(value);
    else if (part === 'authority') setAuthority(value);
    else setTerm(value);
    if (next.text.trim() && next.authority.trim() && next.term.trim()) {
      setField('subject', next);
    } else if (frontmatter['subject'] !== undefined) {
      setField('subject', undefined);
    }
  };
  const error = subjectError(label, authority, term);
  return (
    <fieldset>
      <legend className="text-sm text-muted">Subject</legend>
      <Field label="Label" testId="subject-label" value={label} onChange={(v) => change('text', v)} />
      <Field label="Authority" testId="subject-authority" value={authority} onChange={(v) => change('authority', v)} />
      <Field label="Term" testId="subject-term" value={term} onChange={(v) => change('term', v)} />
      {error && <div role="alert" data-testid="subject-error" className="text-sm">{error}</div>}
    </fieldset>
  );
}

/**
 * Collapsed-by-default publication details section.
 *
 * @param props - `frontmatter`: parsed _frontmatter.yml map; `setField`:
 * persists one frontmatter field ('' or undefined deletes it).
 * @returns The toggle button and, when open, the editable fields.
 */
export function PublicationDetails(
  { frontmatter, setField = () => {} }: {
    frontmatter: Record<string, unknown>; setField?: SetFrontmatterField;
  },
): ReactNode {
  const [open, setOpen] = useState(false);
  const text = (key: string): string => frontmatterText(frontmatter, key);
  return (
    <section className="mt-3">
      <button
        type="button"
        data-testid="publication-details-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-1 rounded font-medium hover:bg-hover"
      >
        {open
          ? <ChevronDown aria-hidden className={ICON} />
          : <ChevronRight aria-hidden className={ICON} />}
        Publication details
      </button>
      {open && (
        <div data-testid="publication-details-content" className="ml-1 space-y-1">
          <Field label="Date" testId="date-input" value={text('date')} onChange={(v) => setField('date', v)} />
          <Field
            label="License"
            testId="license-input"
            value={text('license')}
            list="license-presets"
            onChange={(v) => setField('license', v)}
          />
          <datalist id="license-presets">
            {LICENSE_PRESETS.map((preset) => (
              <option key={preset} value={preset} data-testid="license-preset">{preset}</option>
            ))}
          </datalist>
          <Field label="Copyright" testId="copyright-input" value={text('copyright')} onChange={(v) => setField('copyright', v)} />
          <Field label="Funding" testId="funding-input" value={text('funding')} onChange={(v) => setField('funding', v)} />
          <SubjectFields frontmatter={frontmatter} setField={setField} />
        </div>
      )}
    </section>
  );
}
