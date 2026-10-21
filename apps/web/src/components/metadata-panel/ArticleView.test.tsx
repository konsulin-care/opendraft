// @vitest-environment jsdom
/**
 * Article view tests: byline rendering with tooltip, footnotes, the
 * collaborators list, contributions and the collapsed publication
 * details section.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, type RenderResult } from '@testing-library/react';
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
  it('lists numbered affiliations and only the symbols in use', () => {
    renderView();
    const notes = screen.getByTestId('byline-footnotes').textContent ?? '';
    expect(notes).toContain('1. University of Indonesia');
    expect(notes).toContain('2. RS Pondok Indah Cempaka Putih');
    expect(notes).toContain('* Corresponding author');
    expect(notes).toContain('† Equal contribution');
    expect(notes).not.toContain('‡');
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

describe('ArticleView contributions and publication details', () => {
  it('renders no Author contributions when no author has roles', () => {
    renderView();
    expect(screen.queryByTestId('author-contributions')).toBeNull();
    expect(screen.queryByText(/Author contributions/)).toBeNull();
  });

  it('renders the contribution statement with derived initials when roles exist', () => {
    renderView({
      authors: [
        {
          id: 'smith',
          name: { given: 'Alice Marie', family: 'Smith' },
          roles: ['writing-original-draft'],
        },
      ],
    });
    expect(screen.getByTestId('author-contributions').textContent).toContain('A.M.S.');
  });

  it('keeps the publication details content hidden until clicked', () => {
    renderView({ frontmatter: { license: 'CC BY 4.0', date: '2024-01-01' } });
    expect(screen.queryByTestId('publication-details-content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Publication details/ }));
    const content = screen.getByTestId('publication-details-content');
    expect(content.textContent).toContain('CC BY 4.0');
    expect(content.textContent).toContain('2024-01-01');
  });
});
