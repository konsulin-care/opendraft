import { validateMetadata, type MetadataType } from './metadata.js';
import { checkPublishReadiness } from './publish-profile.js';
import type { PublishIssue, PublishIssueLevel, PublishReadinessInput } from './publish-profile.js';

/** Rank of each level so results can be ordered commit, publish, warning. */
const LEVEL_ORDER: Record<PublishIssueLevel, number> = { commit: 0, publish: 1, warning: 2 };

/** Metadata documents validated against their Ajv schema, keyed by file. */
const SCHEMA_FILES: readonly { key: string; type: MetadataType }[] = [
  { key: 'frontmatter', type: 'frontmatter' },
  { key: 'author', type: 'author' },
  { key: 'abstract', type: 'abstract' },
];

/**
 * Convert a dotted path with numeric segments to bracket index notation.
 *
 * @param path - Dotted path such as 'authors.0.name'.
 * @returns Path such as 'authors[0].name'; non-numeric segments unchanged.
 */
function bracketize(path: string): string {
  let out = '';
  for (const segment of path.split('.')) {
    if (/^\d+$/.test(segment)) {
      out += `[${segment}]`;
    } else {
      out = out ? `${out}.${segment}` : segment;
    }
  }
  return out;
}

/**
 * Prefix a schema error path with its file key.
 *
 * @param key - File key: 'frontmatter', 'author' or 'abstract'.
 * @param path - Error path from validateMetadata ('root' when at the root).
 * @returns Prefixed path, e.g. 'author.authors[0].name'.
 */
function prefixedPath(key: string, path: string): string {
  if (path === 'root' || path === '') return key;
  return `${key}.${bracketize(path)}`;
}

/**
 * Run Ajv schema validation on each present metadata document.
 *
 * Files that failed to parse (listed in `parseErrors`) are skipped, as are
 * documents that are absent.
 *
 * @param input - Publish readiness input carrying the parsed documents.
 * @returns One commit-level issue per schema error, prefixed by file key.
 */
function schemaIssues(input: PublishReadinessInput): PublishIssue[] {
  const parseErrors = input.parseErrors ?? {};
  const documents: Record<string, unknown> = {
    frontmatter: input.frontmatter,
    author: input.author,
    abstract: input.abstract,
  };
  const issues: PublishIssue[] = [];
  for (const { key, type } of SCHEMA_FILES) {
    const data = documents[key];
    if (data === undefined || parseErrors[key as keyof typeof parseErrors] !== undefined) continue;
    const result = validateMetadata(data, type);
    for (const error of result.errors) {
      issues.push({ level: 'commit', path: prefixedPath(key, error.path), message: error.message });
    }
  }
  return issues;
}

/**
 * Check a manuscript's metadata documents against schemas and the publish profile.
 *
 * Runs `validateMetadata` (Ajv) on the frontmatter, author and abstract
 * documents when they are present and did not fail to parse, reporting each
 * schema error as a commit-level issue whose path is prefixed by the file
 * key (e.g. 'author.authors[0].name'). The issues of `checkPublishReadiness`
 * are appended, keeping the order commit, publish, warning; exact duplicates
 * (same level, path and message) are dropped, keeping the first occurrence.
 *
 * @param input - Parsed metadata documents plus publish context.
 * @returns Issues ordered commit, publish, warning; empty when clean.
 */
export function checkMetadata(input: PublishReadinessInput): PublishIssue[] {
  const combined = [...schemaIssues(input), ...checkPublishReadiness(input)];
  combined.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  const seen = new Set<string>();
  const issues: PublishIssue[] = [];
  for (const issue of combined) {
    const key = `${issue.level}\u0000${issue.path}\u0000${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }
  return issues;
}
