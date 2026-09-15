/**
 * Citation plugin for Quarto markdown.
 *
 * Handles @citekey syntax with dropdown for citekey selection
 * and DOI resolution for adding new citations.
 */

export { citationReducer, createInitialState } from './state';
export type { CitationState, CitationAction, CitationTrigger, ComparisonState } from './types';
export { matchCitationTrigger } from './input-rule';
export { insertCitation } from './insert';
export { resolveDoi, cleanupBibtex } from './doi-resolver';
export { appendReference, replaceReference } from './file-write';
