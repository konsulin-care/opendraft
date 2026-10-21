/**
 * Publication details section of the article view.
 *
 * Collapsed by default; shows the read-only date, license, copyright
 * and funding fields of _frontmatter.yml. The section was relocated
 * from ArticleView.tsx to make room for the authors dialog wiring;
 * the inline editor for these fields lands with the publication
 * details behavior.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/** Icon size used by the section chevron. */
const ICON = 'inline size-4 shrink-0';

/** Read-only field of the publication details section. */
function DetailField({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <span className="text-muted">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Collapsed-by-default publication details section.
 *
 * @param props - `frontmatter`: parsed _frontmatter.yml map.
 * @returns The toggle button and, when open, the detail fields.
 */
export function PublicationDetails(
  { frontmatter }: { frontmatter: Record<string, unknown> },
): ReactNode {
  const [open, setOpen] = useState(false);
  const text = (key: string): string | null =>
    typeof frontmatter[key] === 'string' ? frontmatter[key] as string : null;
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
          {text('date') && <DetailField label="Date" value={text('date') as string} />}
          {text('license') && <DetailField label="License" value={text('license') as string} />}
          {text('copyright') && <DetailField label="Copyright" value={text('copyright') as string} />}
          {text('funding') && <DetailField label="Funding" value={text('funding') as string} />}
        </div>
      )}
    </section>
  );
}
