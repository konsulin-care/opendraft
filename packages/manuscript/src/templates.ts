/**
 * Shared starter manuscript templates.
 *
 * The same file contents are used by `scaffoldProject` (new project),
 * `addManuscript` (additional manuscript), and the init repair flow, so
 * that every generated manuscript directory is byte-identical.
 */

/** Container article text with metadata frontmatter and a refs fence. */
const CONTAINER_ARTICLE = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

::: {#refs}
:::
`;

/** Starter author metadata, mirroring templates/manuscript/_author.yml. */
const AUTHOR_YML = `authors: []
affiliations: []
`;

/** Starter abstract, mirroring templates/manuscript/_abstract.yml. */
const ABSTRACT_YML = `abstract: ""\n`;

/** Starter shared bibliography, mirroring templates/project/manuscripts/references.bib. */
export const STARTER_REFERENCES_BIB = `@article{doe2024,
  title = {Example Article},
  author = {Doe, Jane},
  journal = {Journal of Examples},
  year = {2024},
  volume = {1},
  pages = {1--10}
}
`;

/**
 * Build the starter frontmatter with a fixed publication date.
 *
 * @param date - Publication date as `YYYY-MM-DD`.
 * @returns Frontmatter YAML text with the given date.
 */
function frontmatterYml(date: string): string {
  return `title: "Article Title"
date: ${date}
keywords:
  - keyword1
  - keyword2
license: "CC BY 4.0"
`;
}

/**
 * Build the starter manuscript files for a given date.
 *
 * Keys are file names relative to the manuscript directory; values are
 * the file contents.
 *
 * @param date - Publication date as `YYYY-MM-DD` for `_frontmatter.yml`.
 * @returns Record of relative file name to starter content.
 */
export function starterManuscriptFiles(date: string): Record<string, string> {
  return {
    'article.qmd': CONTAINER_ARTICLE,
    '_author.yml': AUTHOR_YML,
    '_abstract.yml': ABSTRACT_YML,
    '_frontmatter.yml': frontmatterYml(date),
  };
}

/**
 * Format today's date as `YYYY-MM-DD` in local time.
 *
 * @returns The local-date stamp for scaffolded frontmatter.
 */
export function todayIsoDate(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}
