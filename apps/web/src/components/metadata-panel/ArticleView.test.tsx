// @vitest-environment jsdom
/**
 * Article view tests: byline rendering with tooltip, footnotes, the
 * collaborators list, contributions and the collapsed publication
 * details section.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within, type RenderResult } from '@testing-library/react';
import { ArticleView, type ArticleViewProps } from './ArticleView';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Affiliation registry used by the default fixture. */
const AFFILIATIONS = [
  { id: 'ui', name: 'University of Indonesia' },
  { id: 'rscm', name: 'RS Pondok Indah Cempaka Putih' },
];

/** Two person authors with shared affiliation, symbol flags, contact. */
const AUTHORS: MetadataAuthor[] = [
  {
    id: 'smith',
    name: { given: 'Alice Marie', family: 'Smith' },
    email: 'alice@example.edu',
    orcid: '0000-0002-1825-0097',
    corresponding: true,
    affiliations: [{ ref: 'ui' }, { ref: 'rscm' }],
  },
  {
    id: 'lee',
    name: { given: 'Budi', family: 'Lee' },
    'equal-contributor': true,
    affiliations: [{ ref: 'rscm' }],
  },
];

/**
 * Render the article view with defaults overridden per test.
 *
 * @param props - Property overrides for the fixture.
 * @returns The render result.
 */
function renderView(props: Partial<ArticleViewProps> = {}): RenderResult {
  return render(
    <ArticleView
      title="Deep Dive"
      authors={AUTHORS}
      affiliations={AFFILIATIONS}
      setTitle={() => {}}
      {...props}
    />,
  );
}

describe('ArticleView byline', () => {
  it('renders names with superscripts and symbol markers', () => {
    renderView();
    expect(screen.getByTestId('byline-author-0').textContent).toContain('Alice Marie Smith');
    expect(screen.getByTestId('byline-superscript-0').textContent).toBe('1,2*');
    expect(screen.getByTestId('byline-superscript-1').textContent).toBe('2†');
    expect(screen.getByTestId('byline-orcid-0')).toBeDefined();
  });

  it('shows a tooltip with email and ORCID when a byline name is focused', () => {
    renderView();
    fireEvent.focus(screen.getByTestId('byline-author-0'));
    const tooltip = screen.getByTestId('byline-tooltip');
    expect(tooltip.textContent).toContain('alice@example.edu');
    expect(tooltip.textContent).toContain('0000-0002-1825-0097');
    fireEvent.blur(screen.getByTestId('byline-author-0'));
    expect(screen.queryByTestId('byline-tooltip')).toBeNull();
  });

  it('phrases a person signing on behalf of a group', () => {
    renderView({
      authors: [
        {
          id: 'dwg',
          name: { literal: 'OpenDraft Team' },
          members: [{ name: { family: 'Suharto' } }],
        },
        { id: 'dewi', name: { given: 'Dewi', family: 'Sari' }, 'on-behalf-of': 'dwg' },
      ],
      affiliations: [],
    });
    expect(screen.getByTestId('byline-author-1').textContent).toContain(
      'Dewi Sari on behalf of OpenDraft Team',
    );
  });
});

describe('ArticleView footnotes and collaborators', () => {
  it('lists numbered affiliations once under the byline, footnotes with symbols only', () => {
    renderView();
    const list = screen.getByTestId('affiliation-list').textContent ?? '';
    expect(list).toContain('1. University of Indonesia');
    expect(list).toContain('2. RS Pondok Indah Cempaka Putih');
    const notes = screen.getByTestId('byline-footnotes').textContent ?? '';
    expect(notes).toContain('* Corresponding author');
    expect(notes).toContain('† Equal contribution');
    expect(notes).not.toContain('‡');
    expect(notes).not.toContain('University of Indonesia');
  });

  it('renders each affiliation name exactly once for two authors', () => {
    renderView();
    const text = screen.getByTestId('metadata-article-view').textContent ?? '';
    expect(text.split('University of Indonesia')).toHaveLength(2);
    expect(text.split('RS Pondok Indah Cempaka Putih')).toHaveLength(2);
  });

  it('collapses the collaborator list behind a toggle', () => {
    renderView({
      authors: [
        {
          id: 'dwg',
          name: { literal: 'OpenDraft Team' },
          members: [
            { name: { given: 'Maria', family: 'Gonzalez' } },
            { name: { family: 'Suharto' } },
          ],
        },
      ],
      affiliations: [],
    });
    const toggle = screen.getByTestId('collaborators-toggle');
    expect(toggle.textContent).toContain('Collaborators: OpenDraft Team (2)');
    expect(screen.queryByTestId('collaborators-list')).toBeNull();
    fireEvent.click(toggle);
    const list = screen.getByTestId('collaborators-list');
    expect(list.textContent).toContain('Maria Gonzalez');
    expect(list.textContent).toContain('Suharto');
  });
});

describe('ArticleView contributions', () => {
  it('renders no Author contributions when no author has roles', () => {
    renderView();
    expect(screen.queryByTestId('author-contributions')).toBeNull();
    expect(screen.queryByText(/Author contributions/)).toBeNull();
  });

  it('renders per-author contribution lines by full name when roles exist', () => {
    renderView({
      authors: [
        { id: 'john', name: { given: 'John' }, roles: ['conceptualization'] },
        {
          id: 'jane',
          name: { given: 'Jane', family: 'Doe' },
          roles: ['data-curation', 'formal-analysis'],
        },
      ],
      affiliations: [],
    });
    const lines = within(screen.getByTestId('author-contributions'))
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(lines).toEqual([
      'John: Conceptualization',
      'Jane Doe: Data curation, Formal analysis',
    ]);
  });

  it('renders the contributions section read-only directly after Keywords', () => {
    renderView({
      authors: [
        {
          id: 'smith',
          name: { given: 'Alice Marie', family: 'Smith' },
          roles: ['conceptualization'],
        },
      ],
      affiliations: [],
    });
    const keywordsSection = screen.getByTestId('keyword-input').closest('section');
    const contributions = screen.getByTestId('author-contributions');
    expect(keywordsSection?.nextElementSibling).toBe(contributions);
    expect(contributions.querySelector('button, input, textarea, select')).toBeNull();
  });
});

describe('ArticleView publication details', () => {
  it('keeps the publication details content hidden until clicked', () => {
    renderView({ frontmatter: { license: 'CC BY 4.0', date: '2024-01-01' } });
    expect(screen.queryByTestId('publication-details-content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Publication details/ }));
    expect(screen.getByTestId('publication-details-content')).toBeDefined();
    expect((screen.getByTestId('license-preset-cc-by-4-0') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('date-input') as HTMLInputElement).value).toBe('2024-01-01');
  });
});

describe('ArticleView section labels', () => {
  it('renders Abstract, Keywords, Contributions and Publication details via one small-caps label', () => {
    renderView({
      authors: [
        { id: 'smith', name: { given: 'Alice Marie', family: 'Smith' }, roles: ['writing-original-draft'] },
      ],
      affiliations: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /Publication details/ }));
    const labels = screen.getAllByTestId('section-label');
    expect(labels.map((el) => el.textContent)).toEqual(
      expect.arrayContaining(['Abstract', 'Keywords', 'Contributions', 'Publication details']),
    );
    for (const label of labels) {
      expect(label.className).toContain('font-variant-caps:all-small-caps');
    }
  });

  it('places the word count in the abstract label row with a guidance placeholder', () => {
    renderView({ abstract: 'one two three' });
    const row = screen.getByTestId('abstract-label-row');
    expect(row.querySelector('[data-testid="section-label"]')?.textContent).toBe('Abstract');
    expect(row.textContent).toContain('3 words');
    const textarea = screen.getByTestId('metadata-abstract') as HTMLTextAreaElement;
    expect(textarea.getAttribute('placeholder')).toBe(
      'Summarize background, objectives, methods, results, and conclusions.',
    );
    const parent = row.parentElement;
    expect(parent).not.toBeNull();
    const children = Array.from(parent?.children ?? []);
    expect(children.indexOf(row)).toBeLessThan(children.indexOf(textarea));
  });
});

describe('ArticleView inline editing', () => {
  it('Enter in the title inserts no newline and focuses the abstract', () => {
    renderView();
    const title = screen.getByTestId('metadata-panel-title-input') as HTMLInputElement;
    title.focus();
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(title.value).not.toContain('\n');
    expect(title.value).toBe('Deep Dive');
    expect(document.activeElement).toBe(screen.getByTestId('metadata-abstract'));
  });

  it("abstract '  one two  three ' shows '3 words'", () => {
    renderView({ abstract: '  one two  three ' });
    expect(screen.getByTestId('abstract-word-count').textContent).toBe('3 words');
  });

  it('reports abstract edits and updates the word count', () => {
    const setAbstract = vi.fn();
    const { rerender } = renderView({ abstract: '', setAbstract });
    fireEvent.change(screen.getByTestId('metadata-abstract'), {
      target: { value: '  one two  three ' },
    });
    expect(setAbstract).toHaveBeenCalledWith('  one two  three ');
    rerender(
      <ArticleView
        title="Deep Dive"
        authors={AUTHORS}
        affiliations={AFFILIATIONS}
        setTitle={() => {}}
        setAbstract={() => {}}
        abstract="  one two  three "
      />,
    );
    expect(screen.getByTestId('abstract-word-count').textContent).toBe('3 words');
  });

  it('renders the keyword chip input with a count', () => {
    renderView({ keywords: ['fasting', 'keto'] });
    expect(screen.getByTestId('keyword-count').textContent).toBe('2 keywords');
    expect(screen.getAllByTestId('keyword-chip')).toHaveLength(2);
  });
});
