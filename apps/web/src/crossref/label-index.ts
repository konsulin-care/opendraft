/**
 * In-memory cache of Quarto cross-reference labels per block file.
 *
 * The index keeps one entry per file, keyed by file name and refreshed only
 * when the file text changes. It serves the `@` autocomplete from the web app,
 * so it is plain synchronous state with no persistence or worker.
 */

import { extractCrossrefLabels } from '@opendraft/manuscript';
import type { CrossrefLabel } from '@opendraft/manuscript';

/** A scanner that turns one file's markdown into its cross-reference labels. */
export type LabelScanner = (md: string, file: string) => CrossrefLabel[];

/** Cached scan result for a single block file. */
interface FileEntry {
  text: string;
  labels: CrossrefLabel[];
}

/** The label cache consumed by the `@` suggestion builder. */
export interface LabelIndex {
  /**
   * Store the current markdown of a file, scanning only when the text differs.
   *
   * @param file - The block file name the text belongs to.
   * @param text - The latest markdown text of that file.
   * @returns Nothing.
   */
  update(file: string, text: string): void;
  /**
   * Forget a file and its labels.
   *
   * @param file - The block file name to drop.
   * @returns Nothing.
   */
  remove(file: string): void;
  /**
   * Keep only the listed files, dropping every other entry.
   *
   * @param files - The block file names that still exist.
   * @returns Nothing.
   */
  retain(files: string[]): void;
  /**
   * Read all labels, merged in first-insertion file order.
   *
   * @returns The merged label list, cached until any file changes.
   */
  labels(): CrossrefLabel[];
}

/**
 * Create a label index backed by the given scanner.
 *
 * @param scan - Scanner used to extract labels; defaults to `extractCrossrefLabels`.
 * @returns A new, empty label index.
 */
export function createLabelIndex(scan: LabelScanner = extractCrossrefLabels): LabelIndex {
  const files = new Map<string, FileEntry>();
  let merged: CrossrefLabel[] | null = null;

  return {
    update(file, text) {
      const existing = files.get(file);
      if (existing !== undefined && existing.text === text) {
        return;
      }
      files.set(file, { text, labels: scan(text, file) });
      merged = null;
    },

    remove(file) {
      if (files.delete(file)) {
        merged = null;
      }
    },

    retain(keep) {
      const wanted = new Set(keep);
      let changed = false;
      for (const file of [...files.keys()]) {
        if (!wanted.has(file)) {
          files.delete(file);
          changed = true;
        }
      }
      if (changed) {
        merged = null;
      }
    },

    labels() {
      if (merged === null) {
        const next: CrossrefLabel[] = [];
        for (const entry of files.values()) {
          next.push(...entry.labels);
        }
        merged = next;
      }
      return merged;
    },
  };
}
