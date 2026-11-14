import { Parser } from 'n3';
import rdf from '@rdfjs/dataset';
import type { Quad } from '@rdfjs/types';
import type { TurtleDataset } from './types.js';

/**
 * Parses a Turtle string into an RDF/JS dataset.
 *
 * Uses the pure-JavaScript `n3` parser and statically imports no Node
 * built-ins, so this module is safe to load in browsers.
 *
 * @param text - Turtle document source.
 * @returns Dataset containing every triple in the string.
 * @throws When the text is not valid Turtle.
 */
export function parseTurtle(text: string): TurtleDataset {
  const quads: Quad[] = new Parser().parse(text);
  return rdf.dataset(quads);
}
