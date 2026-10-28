// @vitest-environment jsdom
/**
 * Group members editor tests: 'Paste list' parsing in 'Family, Given'
 * form, member add/edit/remove persisted to _author.yml and the
 * collaborators count line of the article view.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryWorkspace, type WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { ArticleView } from './ArticleView';
import { GroupMembers } from './GroupMembers';
import { useManuscriptMetadata } from './use-manuscript-metadata';

const ROOT = 'manuscripts/x';

/** Group author without members. */
const EMPTY_GROUP_YML = `# author registry
affiliations:
  - id: ui
    name: University of Indonesia
authors:
  - id: dwg
    name:
      literal: OpenDraft Team
    members: []
`;

/** Group author with one existing member. */
const WITH_MEMBER_YML = `# author registry
affiliations:
  - id: ui
    name: University of Indonesia
authors:
  - id: dwg
    name:
      literal: OpenDraft Team
    members:
      - name:
          family: Suharto
`;

/** The article view wired to the manuscript metadata hook. */
function TestPanel({ ws }: { ws: WorkspaceAdapter }) {
  const meta = useManuscriptMetadata(ws, ROOT);
  return (
    <ArticleView
      title={meta.title}
      authors={meta.authors}
      setTitle={meta.setTitle}
      setAuthors={meta.setAuthors}
      setAbstract={meta.setAbstract}
      abstract={meta.abstract ?? ''}
    />
  );
}

/** Seed a memory workspace with one group author and render it. */
async function boot(authorYml: string): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(`${ROOT}/_frontmatter.yml`, 'title: "Team Paper"\n');
  await ws.writeFile(`${ROOT}/_author.yml`, authorYml);
  render(<TestPanel ws={ws} />);
  await act(async () => {});
  return ws;
}

/** Members of the first (group) author currently written to _author.yml. */
async function readMembers(ws: WorkspaceAdapter): Promise<Record<string, unknown>[]> {
  const text = await ws.readFile(`${ROOT}/_author.yml`);
  const doc = parse(text ?? '') as { authors?: Record<string, unknown>[] };
  return (doc.authors?.[0]?.['members'] as Record<string, unknown>[] | undefined) ?? [];
}

/** Run the 800ms autosave debounce so pending edits hit the file. */
async function flushWrites(): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(800); });
}

/** Open the authors dialog on the group author's expanded card. */
function openGroupCard(): void {
  fireEvent.click(screen.getByTestId('byline-author-0'));
  expect(screen.getByTestId('author-card-0')).toBeDefined();
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('GroupMembers paste list', () => {
  it("pasting 'Gonzalez, Maria\\nSuharto' adds the members to _author.yml", async () => {
    const ws = await boot(EMPTY_GROUP_YML);
    openGroupCard();
    fireEvent.click(screen.getByTestId('member-paste-list'));
    fireEvent.change(screen.getByTestId('member-paste-input'), {
      target: { value: 'Gonzalez, Maria\nSuharto' },
    });
    fireEvent.click(screen.getByTestId('member-paste-add'));
    await flushWrites();
    expect(await readMembers(ws)).toEqual([
      { name: { given: 'Maria', family: 'Gonzalez' } },
      { name: { family: 'Suharto' } },
    ]);
    expect(screen.getByTestId('collaborators-toggle').textContent).toContain(
      'Collaborators: OpenDraft Team (2)',
    );
  });

  it('skips blank lines when pasting a list', async () => {
    const ws = await boot(EMPTY_GROUP_YML);
    openGroupCard();
    fireEvent.click(screen.getByTestId('member-paste-list'));
    fireEvent.change(screen.getByTestId('member-paste-input'), {
      target: { value: 'Gonzalez, Maria\r\n\r\nSuharto\n' },
    });
    fireEvent.click(screen.getByTestId('member-paste-add'));
    await flushWrites();
    expect(await readMembers(ws)).toHaveLength(2);
  });
});

describe('GroupMembers remove', () => {
  it('removing a member updates the YAML', async () => {
    const ws = await boot(WITH_MEMBER_YML);
    openGroupCard();
    expect(screen.getByTestId('group-member-0')).toBeDefined();
    fireEvent.click(screen.getByTestId('member-remove-0'));
    await flushWrites();
    expect(await readMembers(ws)).toEqual([]);
  });
});

describe('GroupMembers edit', () => {
  it('edits write name, ORCID and affiliation ref to the YAML', async () => {
    const ws = await boot(WITH_MEMBER_YML);
    openGroupCard();
    fireEvent.change(screen.getByTestId('member-given-0'), { target: { value: 'Dewi' } });
    fireEvent.change(screen.getByTestId('member-orcid-0'), {
      target: { value: '0000-0002-1825-0097' },
    });
    fireEvent.change(screen.getByTestId('member-affiliation-0'), { target: { value: 'ui' } });
    await flushWrites();
    expect(await readMembers(ws)).toEqual([
      {
        name: { family: 'Suharto', given: 'Dewi' },
        orcid: '0000-0002-1825-0097',
        affiliations: [{ ref: 'ui' }],
      },
    ]);
  });
});

describe('GroupMembers add', () => {
  it('Add member appends a blank member entry', () => {
    const onChange = vi.fn();
    render(<GroupMembers members={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('member-add'));
    expect(onChange).toHaveBeenCalledWith([{ name: { given: '', family: '' } }]);
  });

  it('renders one editable row per member', () => {
    const onChange = vi.fn();
    render(
      <GroupMembers
        members={[{ name: { given: 'Maria', family: 'Gonzalez' } }]}
        onChange={onChange}
      />,
    );
    const rows = screen.getAllByTestId(/^group-member-/);
    expect(rows).toHaveLength(1);
    expect((screen.getByTestId('member-family-0') as HTMLInputElement).value)
      .toBe('Gonzalez');
    expect((screen.getByTestId('member-given-0') as HTMLInputElement).value)
      .toBe('Maria');
  });
});