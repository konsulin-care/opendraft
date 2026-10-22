/**
 * Shared icon fields of the author card.
 *
 * {@link IconField} renders a leading lucide icon (or a text badge)
 * next to a placeholder input carrying an aria-label and the light
 * grey bottom border. The degree, email and collapsible contact
 * fields of the author card build on it.
 */
import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { GraduationCap, HeartHandshake, Link, Mail, Phone, Printer, StickyNote, type LucideIcon } from 'lucide-react';
import { EMAIL_PATTERN } from '@opendraft/schema';
import { INPUT } from './author-name-fields';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Props for {@link IconField}: standard input props plus the icon. */
export interface IconFieldProps extends ComponentPropsWithRef<'input'> {
  /** Leading visual rendered at the left of the input. */
  icon: ReactNode;
  /** `data-testid` rendered on the input element. */
  testid: string;
  /** Accessible name of the input. */
  ariaLabel: string;
}

/**
 * One-line input with a leading icon or badge, a placeholder and the
 * light grey bottom border.
 *
 * @param props - See {@link IconFieldProps}; remaining props are
 *                spread onto the underlying input element.
 * @returns A flex wrapper holding the icon at left and the input.
 */
export function IconField({ icon, testid, ariaLabel, className, ...rest }: IconFieldProps): ReactNode {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className="flex shrink-0 items-center text-muted">{icon}</span>
      <input {...rest} data-testid={testid} aria-label={ariaLabel} className={`${INPUT} ${className ?? ''}`} />
    </div>
  );
}

/**
 * Set or delete one string field of an author.
 *
 * @param author - Author entry to copy.
 * @param key - Field key to write or remove.
 * @param value - New value; an empty string removes the key.
 * @returns A copy of the author with the field set or deleted.
 */
export function setStr(author: MetadataAuthor, key: string, value: string): MetadataAuthor {
  const next = { ...author };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

/** Props for {@link Degrees}. */
export interface DegreesProps {
  /** Current degree strings of the author. */
  degrees: string[];
  /** Receives the updated degree list. */
  onSet: (degrees: string[]) => void;
}

/**
 * Degree chips with an icon input adding a new degree on Enter.
 *
 * @param props - See {@link DegreesProps}.
 * @returns The chip list and the add-degree field.
 */
export function Degrees({ degrees, onSet }: DegreesProps): ReactNode {
  const [text, setText] = useState('');
  const add = (): void => {
    const value = text.trim();
    if (value && !degrees.includes(value)) onSet([...degrees, value]);
    setText('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {degrees.map((degree, index) => (
          <span key={degree} data-testid="author-degree-chip" className="rounded bg-surface-low px-2 py-0.5 text-sm">
            {degree}
            <button type="button" data-testid={`author-degree-remove-${index}`} aria-label={`Remove ${degree}`}
              onClick={() => onSet(degrees.filter((d) => d !== degree))}>×</button>
          </span>
        ))}
      </div>
      <IconField icon={<GraduationCap aria-hidden className="size-4" />} testid="author-degree-field"
        ariaLabel="Degree" placeholder="Add degree" value={text} onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
    </div>
  );
}

/** Extra contact fields: author key, field label and leading icon. */
const CONTACT_FIELDS: ReadonlyArray<readonly [string, string, LucideIcon]> = [
  ['url', 'Website URL', Link],
  ['phone', 'Phone', Phone],
  ['fax', 'Fax', Printer],
  ['note', 'Note', StickyNote],
  ['acknowledgements', 'Acknowledgements', HeartHandshake],
];

/** Props for {@link MoreFields}. */
export interface MoreFieldsProps {
  /** Author entry whose contact fields are edited. */
  author: MetadataAuthor;
  /** Receives the patch merged into the updated author. */
  onChange: (patch: Partial<MetadataAuthor>) => void;
}

/**
 * Collapsible contact section: url, phone, fax, note and
 * acknowledgements, each an icon field labelled by its own name.
 *
 * @param props - See {@link MoreFieldsProps}.
 * @returns The toggle button and the open contact fields.
 */
export function MoreFields({ author, onChange }: MoreFieldsProps): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm text-muted hover:bg-hover">{open ? 'Hide contact details' : 'More contact details'}</button>
      {open && CONTACT_FIELDS.map(([key, label, Icon]) => (
        <IconField key={key} icon={<Icon aria-hidden className="size-4" />} testid={`author-${key}`} ariaLabel={label}
          placeholder={label} value={typeof author[key] === 'string' ? author[key] : ''}
          onChange={(event) => onChange(setStr(author, key, event.target.value))} />
      ))}
    </>
  );
}

/** Props for {@link EmailField}. */
export interface EmailFieldProps {
  /** Author entry whose email is edited. */
  author: MetadataAuthor;
  /** Receives the patch merged into the updated author. */
  apply: (patch: Partial<MetadataAuthor>) => void;
}

/**
 * Email input with a mail icon, shared by the person and group bodies.
 * Validated on blur against {@link EMAIL_PATTERN}; an invalid value
 * shows a non-blocking inline alert. A corresponding author without
 * an email gets a non-blocking warning. Neither blocks onChange.
 *
 * @param props - See {@link EmailFieldProps}.
 * @returns The email icon field plus the inline messages.
 */
export function EmailField({ author, apply }: EmailFieldProps): ReactNode {
  const [invalid, setInvalid] = useState(false);
  const email = typeof author.email === 'string' ? author.email : '';
  return (
    <>
      <IconField icon={<Mail aria-hidden className="size-4" />} testid="author-email" ariaLabel="Email" placeholder="Email"
        value={email}
        onChange={(event) => { setInvalid(false); apply(setStr(author, 'email', event.target.value)); }}
        onBlur={(event) => setInvalid(event.target.value !== '' && !EMAIL_PATTERN.test(event.target.value))} />
      {invalid && (
        <p role="alert" data-testid="author-email-error" className="text-sm text-red-700">Not a valid email address</p>
      )}
      {author.corresponding === true && email === '' && (
        <p data-testid="author-email-warning" className="text-sm text-amber-800">Corresponding author needs an email</p>
      )}
    </>
  );
}
