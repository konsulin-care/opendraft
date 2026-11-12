/**
 * Canonical heading line utilities for block files.
 *
 * Re-export shim: the implementation lives in `@opendraft/manuscript` so the
 * web app and the manuscript package share identical behavior. See the
 * package for the parsing, joining and retitling rules.
 */
export { joinHeading, retitleHeading, splitHeading } from '@opendraft/manuscript';
export type { BlockHeading, SplitHeading } from '@opendraft/manuscript';
