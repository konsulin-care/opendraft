import { describe, expect, it } from 'vitest';
import { createManuscriptDoc } from '../src/milkdown/manuscript-sync.js';
import { ensureSectionIds } from '../src/milkdown/identity.js';
import { clearFocus, dimmedSectionIds, focusSection, focusedSectionId } from '../src/milkdown/focus.js';

describe('focus mode state', () => {
  it('starts unfocused with no dimmed sections', () => {
    const doc = ensureSectionIds(
      createManuscriptDoc('# Intro {#intro}\n\na\n\n# Methods {#methods}\n\nb'),
    );
    const state = clearFocus();
    expect(focusedSectionId(state)).toBeNull();
    expect(dimmedSectionIds(doc, state)).toEqual([]);
  });

  it('dims every section except the focused one', () => {
    const doc = ensureSectionIds(
      createManuscriptDoc('# Intro {#intro}\n\na\n\n# Methods {#methods}\n\nb'),
    );
    const state = focusSection(clearFocus(), 'intro');
    expect(focusedSectionId(state)).toBe('intro');
    expect(dimmedSectionIds(doc, state)).toEqual(['methods']);
  });

  it('clears focus back to the full document', () => {
    const doc = ensureSectionIds(
      createManuscriptDoc('# Intro {#intro}\n\na\n\n# Methods {#methods}\n\nb'),
    );
    const state = clearFocus(focusSection(clearFocus(), 'methods'));
    expect(focusedSectionId(state)).toBeNull();
    expect(dimmedSectionIds(doc, state)).toEqual([]);
  });
});