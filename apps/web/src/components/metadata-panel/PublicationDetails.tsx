/**
 * Publication details section of the article view: a labeled grid with
 * a native date input, a license radio group of presets (CC BY 4.0
 * recommended) carrying one-sentence plain-language descriptions and an
 * Other free-text option, copyright and funding inputs, plus the
 * all-or-none subject group whose authority and term sit behind a More
 * disclosure. The section is collapsed by default and persists every
 * field through the parent-supplied frontmatter setter.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SectionLabel } from './SectionLabel';

/** Icon size used by the section chevron. */
const ICON = 'inline size-4 shrink-0';

/** Grid cells of the labeled layout: label column and control input. */
const LABEL = 'self-start pt-3 text-sm text-muted';
const INPUT = 'min-h-11 w-full rounded px-1 outline-none';

/** License presets offered as radios; free text stays allowed via Other. */
const LICENSE_PRESETS = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC0'];

/** One-sentence plain-language description per license choice. */
const LICENSE_DESCRIPTIONS: Record<string, string> = {
  'CC BY 4.0': 'Share and adapt the work for any purpose as long as credit is given.',
  'CC BY-SA 4.0': 'Share and adapt the work for any purpose with credit, and license adaptations under the same terms.',
  'CC BY-NC 4.0': 'Share and adapt the work for non-commercial purposes as long as credit is given.',
  'CC0': 'Dedicate the work to the public domain with no conditions.',
  'Other': 'Use a custom license of your own wording.',
};

/** Persist one _frontmatter.yml field; '' or undefined deletes it. */
export type SetFrontmatterField = (key: string, value: unknown) => void;

/** Read a string field of the frontmatter map ('' when missing). */
function frontmatterText(frontmatter: Record<string, unknown>, key: string): string {
  return typeof frontmatter[key] === 'string' ? frontmatter[key] as string : '';
}

/** Radio test id for one preset ('CC BY 4.0' -> 'license-preset-cc-by-4-0'). */
function presetTestId(preset: string): string {
  return `license-preset-${preset.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/** The license choice a radio group should select for the stored value. */
function licenseChoice(license: string): string {
  if (LICENSE_PRESETS.includes(license)) return license;
  return license.trim() ? 'Other' : 'CC BY 4.0';
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

/** Validation of the subject group: null when empty or complete. */
function subjectError(label: string, authority: string, term: string): string | null {
  if (!label.trim()) return null;
  return authority.trim() && term.trim() ? null : 'authority and term required';
}

/** One label cell plus control input cell of the labeled grid. */
function Field({ label, testId, value, onChange, type }: {
  label: string; testId: string; value: string;
  onChange: (value: string) => void; type?: string;
}): ReactNode {
  return (
    <>
      <label htmlFor={testId} className={LABEL}>{label}</label>
      <input
        id={testId}
        data-testid={testId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT}
      />
    </>
  );
}

/** Subject edit context: local draft state plus frontmatter persistence. */
interface SubjectEdit {
  /** Current local draft of the three subject parts. */
  draft: SubjectDraft;
  /** Replace the local draft. */
  setDraft: (next: SubjectDraft) => void;
  /** Parsed _frontmatter.yml map. */
  frontmatter: Record<string, unknown>;
  /** Persist one frontmatter field. */
  setField: SetFrontmatterField;
}

/** Apply one subject-part edit, writing the subject only when complete. */
function applySubjectChange(part: keyof SubjectDraft, value: string, ctx: SubjectEdit): void {
  const next = { ...ctx.draft, [part]: value };
  ctx.setDraft(next);
  if (next.text.trim() && next.authority.trim() && next.term.trim()) {
    ctx.setField('subject', next);
  } else if (ctx.frontmatter['subject'] !== undefined) {
    ctx.setField('subject', undefined);
  }
}

/** All-or-none subject editor: label always, authority/term behind More. */
function SubjectFields({ frontmatter, setField }: {
  frontmatter: Record<string, unknown>; setField: SetFrontmatterField;
}): ReactNode {
  const initial = subjectOf(frontmatter);
  const [more, setMore] = useState(false);
  const [draft, setDraft] = useState(initial);
  // Re-seed from the written subject (external reloads); the string deps
  // keep the local draft untouched while it is being typed.
  useEffect(() => { setDraft(initial); },
    [initial.text, initial.authority, initial.term]);
  const change = (part: keyof SubjectDraft, value: string): void => {
    applySubjectChange(part, value, { draft, setDraft, frontmatter, setField });
  };
  const error = subjectError(draft.text, draft.authority, draft.term);
  return (
    <>
      <label htmlFor="subject-label" className={LABEL}>Subject</label>
      <div className="min-w-0 space-y-1">
        <input
          id="subject-label"
          data-testid="subject-label"
          value={draft.text}
          onChange={(event) => change('text', event.target.value)}
          className={INPUT}
        />
        <button
          type="button"
          data-testid="subject-more-toggle"
          aria-expanded={more}
          onClick={() => setMore(!more)}
          className="min-h-11 rounded px-1 text-sm underline hover:bg-hover"
        >
          {more ? 'Less' : 'More'}
        </button>
        {error && <div role="alert" data-testid="subject-error" className="text-sm">{error}</div>}
      </div>
      {more && (
        <>
          <Field label="Authority" testId="subject-authority" value={draft.authority} onChange={(v) => change('authority', v)} />
          <Field label="Term" testId="subject-term" value={draft.term} onChange={(v) => change('term', v)} />
        </>
      )}
    </>
  );
}

/** One license preset radio row, marking CC BY 4.0 as recommended. */
function PresetRadio({ preset, checked, onPick }: {
  preset: string; checked: boolean; onPick: () => void;
}): ReactNode {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="radio"
        name="license-preset"
        value={preset}
        data-testid={presetTestId(preset)}
        checked={checked}
        onChange={onPick}
        className="accent-black"
      />
      {preset}
      {preset === 'CC BY 4.0' && <span className="text-muted">(Recommended)</span>}
    </label>
  );
}

/** License radio group: presets with a recommended default plus Other. */
function LicenseField({ license, setField }: {
  license: string; setField: SetFrontmatterField;
}): ReactNode {
  const [choice, setChoice] = useState(() => licenseChoice(license));
  // Follow external license changes (project reload/switch).
  useEffect(() => { setChoice(licenseChoice(license)); }, [license]);
  const pickPreset = (preset: string): void => {
    setChoice(preset);
    setField('license', preset);
  };
  return (
    <fieldset aria-labelledby="license-row-label" className="min-w-0">
      {LICENSE_PRESETS.map((preset) => (
        <PresetRadio key={preset} preset={preset} checked={choice === preset} onPick={() => pickPreset(preset)} />
      ))}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="radio"
          name="license-preset"
          value="Other"
          data-testid="license-other"
          checked={choice === 'Other'}
          onChange={() => setChoice('Other')}
          className="accent-black"
        />
        Other
      </label>
      <p data-testid="license-description" className="text-sm text-muted">
        {LICENSE_DESCRIPTIONS[choice]}
      </p>
      {choice === 'Other' && (
        <input
          aria-label="License name"
          data-testid="license-input"
          value={license}
          onChange={(event) => setField('license', event.target.value)}
          className={INPUT}
        />
      )}
    </fieldset>
  );
}

/**
 * Collapsed-by-default publication details section.
 *
 * @param props - `frontmatter`: parsed _frontmatter.yml map; `setField`:
 * persists one frontmatter field ('' or undefined deletes it).
 * @returns The toggle button and, when open, the labeled field grid.
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
        className="flex min-h-11 items-center gap-1 rounded hover:bg-hover"
      >
        {open
          ? <ChevronDown aria-hidden className={ICON} />
          : <ChevronRight aria-hidden className={ICON} />}
        <SectionLabel>Publication details</SectionLabel>
      </button>
      {open && (
        <div
          data-testid="publication-details-content"
          className="ml-1 grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1"
        >
          <Field label="Date" testId="date-input" type="date" value={text('date')} onChange={(v) => setField('date', v)} />
          <span id="license-row-label" className={LABEL}>License</span>
          <LicenseField license={text('license')} setField={setField} />
          <Field label="Copyright" testId="copyright-input" value={text('copyright')} onChange={(v) => setField('copyright', v)} />
          <Field label="Funding" testId="funding-input" value={text('funding')} onChange={(v) => setField('funding', v)} />
          <SubjectFields frontmatter={frontmatter} setField={setField} />
        </div>
      )}
    </section>
  );
}
