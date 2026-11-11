import { describe, expect, it } from 'vitest';
import { loadTurtle, validateShacl } from '../src/index.js';
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