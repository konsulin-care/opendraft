import { describe, expect, it } from 'vitest';
import { loadTurtle, parseTurtle, validateShacl } from '../src/index.js';
import type { ShaclValidationReport } from '../src/types.js';
import { fileURLToPath } from 'node:url';

// Repo-root paths, resolved from this file: suites run with cwd = packages/rdf.
const protocol = (path: string): string => fileURLToPath(new URL(`../../../protocol/${path}`, import.meta.url));
const conformance = (path: string): string => fileURLToPath(new URL(`../../../tests/conformance/${path}`, import.meta.url));

const ARTICLE_SHAPES = protocol('article.shacl.ttl');
const VALID_ARTICLE = protocol('examples/article.ttl');
const VALID_COLLECTION = protocol('registry.ttl');
const VALID_PUB_REGISTRY = protocol('examples/publication-registry.ttl');
const REGISTRY_SHAPES = protocol('registry.shacl.ttl');
const INVALID_MISSING_TITLE = conformance('fixtures/invalid/article-missing-title.ttl');
const INVALID_BAD_REVISION = conformance('fixtures/invalid/article-invalid-revision.ttl');
const INVALID_MIXED_REGISTRY = conformance('fixtures/invalid/registry-mixed-types.ttl');

describe('parseTurtle', () => {
  it('returns a dataset containing the triples of the Turtle string', () => {
    const dataset = parseTurtle(`
      @prefix ex: <https://example.org/> .
      ex:alpha ex:label "Alpha" .
      ex:alpha ex:related ex:beta .
    `);

    expect(dataset.size).toBe(2);
    const triples = [...dataset].map((quad) => [
      quad.subject.value,
      quad.predicate.value,
      quad.object.value,
    ]);
    expect(triples).toContainEqual([
      'https://example.org/alpha',
      'https://example.org/label',
      'Alpha',
    ]);
    expect(triples).toContainEqual([
      'https://example.org/alpha',
      'https://example.org/related',
      'https://example.org/beta',
    ]);
  });

  it('parses prefixed names, base IRIs and blank nodes', () => {
    const dataset = parseTurtle(`
      @base <https://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      <#alice> foaf:name "Alice" ;
               foaf:nick [ foaf:note "hi" ] .
    `);

    expect(dataset.size).toBe(3);
    const predicates = new Set([...dataset].map((quad) => quad.predicate.value));
    expect(predicates).toContain('http://xmlns.com/foaf/0.1/name');
    expect(predicates).toContain('http://xmlns.com/foaf/0.1/nick');
    expect(predicates).toContain('http://xmlns.com/foaf/0.1/note');
  });

  it('throws on invalid Turtle', () => {
    expect(() => parseTurtle('<http://example.org/a> <http://example.org/b>')).toThrow();
  });
});

describe('loadTurtle', () => {
  it('parses a Turtle file into an RDF/JS dataset', async () => {
    const dataset = await loadTurtle(VALID_ARTICLE);
    expect(dataset.size).toBeGreaterThan(0);
  });

  it('throws on a missing file', async () => {
    await expect(loadTurtle('does/not/exist.ttl')).rejects.toThrow();
  });
});

describe('validateShacl', () => {
  it('returns conforms=true for a valid article', async () => {
    const [shapes, data] = await Promise.all([loadTurtle(ARTICLE_SHAPES), loadTurtle(VALID_ARTICLE)]);
    const report: ShaclValidationReport = await validateShacl(data, shapes);
    expect(report.conforms).toBe(true);
    expect(report.results).toHaveLength(0);
  });

  it('reports the violated path and constraint message', async () => {
    const [shapes, data] = await Promise.all([loadTurtle(ARTICLE_SHAPES), loadTurtle(INVALID_MISSING_TITLE)]);
    const report: ShaclValidationReport = await validateShacl(data, shapes);
    expect(report.conforms).toBe(false);
    expect(report.results[0]?.path?.value).toBe('http://purl.org/dc/terms/title');
    const messages = report.results[0]?.message.map((m) => m.value);
    expect(messages).toContain('A publication must have exactly one title.');
  });

  it('returns conforms=false with results for a missing title', async () => {
    const [shapes, data] = await Promise.all([loadTurtle(ARTICLE_SHAPES), loadTurtle(INVALID_MISSING_TITLE)]);
    const report: ShaclValidationReport = await validateShacl(data, shapes);
    expect(report.conforms).toBe(false);
    expect(report.results.length).toBeGreaterThan(0);
  });

  it('returns conforms=false for a non-40-hex source revision', async () => {
    const [shapes, data] = await Promise.all([loadTurtle(ARTICLE_SHAPES), loadTurtle(INVALID_BAD_REVISION)]);
    const report: ShaclValidationReport = await validateShacl(data, shapes);
    expect(report.conforms).toBe(false);
  });

  it('validates a collection registry against registry shapes', async () => {
    const [shapes, data] = await Promise.all([loadTurtle(REGISTRY_SHAPES), loadTurtle(VALID_COLLECTION)]);
    const report: ShaclValidationReport = await validateShacl(data, shapes);
    expect(report.conforms).toBe(true);
  });

  it('validates a publication registry against registry shapes', async () => {
    const [shapes, data] = await Promise.all([loadTurtle(REGISTRY_SHAPES), loadTurtle(VALID_PUB_REGISTRY)]);
    const report: ShaclValidationReport = await validateShacl(data, shapes);
    expect(report.conforms).toBe(true);
  });

  it('rejects a mixed collection/publication registry', async () => {
    const [shapes, data] = await Promise.all([loadTurtle(REGISTRY_SHAPES), loadTurtle(INVALID_MIXED_REGISTRY)]);
    const report: ShaclValidationReport = await validateShacl(data, shapes);
    expect(report.conforms).toBe(false);
    expect(report.results.length).toBeGreaterThan(0);
  });
});