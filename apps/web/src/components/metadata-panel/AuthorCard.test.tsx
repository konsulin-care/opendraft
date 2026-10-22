// @vitest-environment jsdom
/**
 * Author card tests: placeholder-only name fields, single-name literal
 * storage with author-type metadata, comma-paste split, particle/suffix
 * options, Person/Group toggle, degrees, email, status toggles,
 * on-behalf-of, CRediT pills and the affiliation warning marker.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AuthorCard, type GroupOption } from './AuthorCard';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Person author with affiliation, contact, degrees and status flags. */
const PERSON: MetadataAuthor = {
  id: 'smith',
  name: { given: 'Alice Marie', family: 'Smith' },
  email: 'alice@example.edu',
  orcid: '0000-0002-1825-0097',
  degrees: ['PhD'],
  corresponding: true,
  affiliations: [{ ref: 'ui' }],
};

/** Last author handed to onChange. */
function lastChange(onChange: ReturnType<typeof vi.fn>): MetadataAuthor {
  return onChange.mock.calls.at(-1)?.[0] as MetadataAuthor;
}

/** Render the card with a spy onChange; returns the spy and rerender. */
function renderCard(author: MetadataAuthor = PERSON, groups: GroupOption[] = []) {
  const onChange = vi.fn();
  const view = render(<AuthorCard author={author} groups={groups} onChange={onChange} />);
  return { onChange, rerender: view.rerender, groups };
}

/** Rerender the controlled card with the author of the latest change. */
function follow(
  rerender: (node: ReactElement) => void,
  onChange: ReturnType<typeof vi.fn>,
  groups: GroupOption[] = [],
): void {
  rerender(<AuthorCard author={lastChange(onChange)} groups={groups} onChange={onChange} />);
}

describe('AuthorCard name editing', () => {
  it("pasting 'Smith, Alice Marie' in Family sets given and family", () => {
    const { onChange } = renderCard({ id: 'x', name: { family: '' } });
    fireEvent.paste(screen.getByTestId('author-family'), {
      clipboardData: { getData: () => 'Smith, Alice Marie' },
    });
    expect(lastChange(onChange).name).toEqual({ family: 'Smith', given: 'Alice Marie' });
  });

  it("'only one name' hides Given and stores {literal} with author-type person", () => {
    const { onChange, rerender } = renderCard({ id: 'dewi', name: { given: '', family: '' } });
    fireEvent.click(screen.getByTestId('author-single-name'));
    follow(rerender, onChange);
    expect(screen.queryByTestId('author-given')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Dewi' } });
    expect(lastChange(onChange).name).toEqual({ literal: 'Dewi' });
    expect(lastChange(onChange).metadata).toMatchObject({ 'author-type': 'person' });
  });

  it('offers particle and suffix behind More name options', () => {
    const { onChange } = renderCard();
    fireEvent.click(screen.getByText('More name options'));
    fireEvent.change(screen.getByTestId('author-particle'), { target: { value: 'van' } });
    expect(lastChange(onChange).name).toMatchObject({ particle: 'van' });
  });
});

describe('AuthorCard person/group toggle', () => {
  it('Group toggle stores {literal} and hides person-only fields', () => {
    const { onChange, rerender } = renderCard();
    fireEvent.click(screen.getByTestId('author-type-group'));
    const group = lastChange(onChange);
    expect(group.name).toEqual({ literal: 'Alice Marie Smith' });
    expect(group.metadata).toMatchObject({ 'author-type': 'group' });
    rerender(<AuthorCard author={group} onChange={onChange} />);
    expect(screen.queryByTestId('author-orcid')).toBeNull();
    expect(screen.queryByTestId('author-degree-field')).toBeNull();
    expect(screen.queryByTestId('author-corresponding')).toBeNull();
    expect(screen.queryByTestId('author-deceased')).toBeNull();
    expect(screen.getByTestId('author-group-name')).toBeDefined();
    fireEvent.change(screen.getByTestId('author-group-name'), {
      target: { value: 'WHO DWG' },
    });
    expect(lastChange(onChange).name).toEqual({ literal: 'WHO DWG' });
  });
});

describe('AuthorCard fields', () => {
  it('toggling a CRediT pill writes its slug and toggling again removes it', () => {
    const { onChange, rerender } = renderCard();
    fireEvent.click(screen.getByTestId('credit-writing-original-draft'));
    expect(lastChange(onChange).roles).toEqual(['writing-original-draft']);
    follow(rerender, onChange);
    fireEvent.click(screen.getByTestId('credit-writing-original-draft'));
    expect(lastChange(onChange).roles).toEqual([]);
  });

  it('a card without affiliation shows a warning marker', () => {
    const { rerender } = renderCard({ id: 'lee', name: { given: 'Budi', family: 'Lee' } });
    expect(screen.getByTestId('author-warning')).toBeDefined();
    rerender(<AuthorCard author={PERSON} onChange={vi.fn()} />);
    expect(screen.queryByTestId('author-warning')).toBeNull();
  });

  it('adds degrees as chips and writes the list', () => {
    const { onChange, rerender } = renderCard();
    const field = screen.getByTestId('author-degree-field');
    fireEvent.change(field, { target: { value: 'MSc' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    follow(rerender, onChange);
    const chips = screen.getAllByTestId('author-degree-chip');
    expect(chips).toHaveLength(2);
    expect(chips[1].textContent).toContain('MSc');
    expect(lastChange(onChange).degrees).toEqual(['PhD', 'MSc']);
  });

  it('writes the email and the on-behalf-of selection', () => {
    const groups: GroupOption[] = [{ id: 'dwg', name: 'OpenDraft Team' }];
    const { onChange, rerender } = renderCard(
      { id: 'dewi', name: { given: 'Dewi', family: 'Sari' } },
      groups,
    );
    fireEvent.change(screen.getByTestId('author-email'), { target: { value: 'dewi@example.org' } });
    follow(rerender, onChange, groups);
    fireEvent.change(screen.getByTestId('author-on-behalf-of'), { target: { value: 'dwg' } });
    expect(lastChange(onChange).email).toBe('dewi@example.org');
    expect(lastChange(onChange)['on-behalf-of']).toBe('dwg');
  });
});

describe('AuthorCard black accent', () => {
  it('styles the active Person pill with the black token, not blue-600', () => {
    renderCard();
    const person = screen.getByTestId('author-type-person');
    expect(person.className).toMatch(/\bbg-black\b/);
    expect(person.className).toMatch(/\bborder-black\b/);
    expect(person.className).not.toMatch(/blue-600/);
    const inactive = screen.getByTestId('author-type-group');
    expect(inactive.className).not.toMatch(/\bbg-black\b/);
  });

  it('styles a pressed CRediT pill with the black token, not blue-600', () => {
    renderCard({ ...PERSON, roles: ['conceptualization'] });
    const pill = screen.getByTestId('credit-conceptualization');
    expect(pill.getAttribute('aria-pressed')).toBe('true');
    expect(pill.className).toMatch(/\bbg-black\b/);
    expect(pill.className).not.toMatch(/blue-600/);
  });
});

describe('AuthorCard placeholder-only name fields', () => {
  it('renders no visible given/family labels, only placeholders and aria-labels', () => {
    renderCard();
    expect(screen.queryByText('Given name(s)')).toBeNull();
    expect(screen.queryByText('Family name')).toBeNull();
    const given = screen.getByTestId('author-given') as HTMLInputElement;
    expect(given.placeholder).toBe('Given name(s)');
    expect(given.getAttribute('aria-label')).toBe('Given name(s)');
    const family = screen.getByTestId('author-family') as HTMLInputElement;
    expect(family.placeholder).toBe('Family name');
    expect(family.getAttribute('aria-label')).toBe('Family name');
  });

  it('keeps no author-preview testid (byline preview removed)', () => {
    renderCard();
    expect(screen.queryByTestId('author-preview')).toBeNull();
  });
});

describe('AuthorCard single-name literal storage', () => {
  it('ticking shows one input with placeholder Name storing a literal person', () => {
    const { onChange, rerender } = renderCard({ id: 'dewi', name: { given: '', family: '' } });
    fireEvent.click(screen.getByTestId('author-single-name'));
    follow(rerender, onChange);
    expect(screen.queryByTestId('author-given')).toBeNull();
    const single = screen.getByPlaceholderText('Name') as HTMLInputElement;
    expect(single.getAttribute('aria-label')).toBe('Name');
    fireEvent.change(single, { target: { value: 'Dewi' } });
    expect(lastChange(onChange).name).toEqual({ literal: 'Dewi' });
    expect(lastChange(onChange).metadata).toMatchObject({ 'author-type': 'person' });
  });

  it('unticking restores given/family with the literal as family', () => {
    const { onChange, rerender } = renderCard({
      id: 'plato', name: { literal: 'Plato' }, metadata: { 'author-type': 'person' },
    });
    expect((screen.getByTestId('author-single-name') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByTestId('author-single-name'));
    expect(lastChange(onChange).name).toEqual({ given: '', family: 'Plato' });
    expect(lastChange(onChange).metadata).toMatchObject({ 'author-type': 'person' });
    follow(rerender, onChange);
    expect(screen.getByTestId('author-given')).toBeDefined();
    expect((screen.getByTestId('author-family') as HTMLInputElement).value).toBe('Plato');
  });

  it('renders a literal name with author-type person as a person card', () => {
    renderCard({ id: 'plato', name: { literal: 'Plato' }, metadata: { 'author-type': 'person' } });
    expect(screen.getByTestId('author-type-person').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByPlaceholderText('Name')).toBeDefined();
    expect(screen.queryByTestId('author-group-name')).toBeNull();
  });
});
